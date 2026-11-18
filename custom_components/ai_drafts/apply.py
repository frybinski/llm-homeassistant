"""Writing, snapshots and reverting.

This is the only module that writes Home Assistant configuration. It writes
``automations.yaml`` itself with the same building blocks as Home Assistant's
config view (``load_yaml``, ``dump``, ``write_utf8_file_atomic``) and the same key
order, then reloads the single automation. Every read-modify-write runs in one
executor job under ``AIDraftsData.write_lock``.

Nothing here is reachable except through the admin WebSocket commands.
"""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime
import json
import logging
import os
import re
from typing import TYPE_CHECKING, Any, Final
from uuid import uuid4

from homeassistant.components import automation
from homeassistant.config import AUTOMATION_CONFIG_PATH
from homeassistant.const import CONF_ID, SERVICE_RELOAD
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.storage import Store
from homeassistant.util.file import write_utf8_file_atomic
from homeassistant.util.yaml import dump, load_yaml

from .changeset import (
    ApplyBlockedError,
    ChangeSetStatus,
    InvalidTransitionError,
)
from .checks.validity import async_run_checks
from .journal import EVENT_APPLIED, EVENT_REVERTED

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .changeset import ChangeSet, Finding
    from .data import AIDraftsData

_LOGGER = logging.getLogger(__name__)

STORAGE_KEY: Final = "ai_drafts.snapshots"
STORAGE_VERSION: Final = 1

# The keys Home Assistant's own editor writes first, in this order
# (EditAutomationConfigView._write_value).
_KEY_ORDER: Final = (
    "alias",
    "description",
    "triggers",
    "trigger",
    "conditions",
    "condition",
    "actions",
    "action",
)


# Tags that `load_yaml` resolves. Dumping the loaded data would write their values
# into the file in plain text, which for `!secret` exposes the secret.
_RESOLVED_TAG: Final = re.compile(r"(?:^|\s)!(?:secret|include\w*|env_var)\b")


class ApplyError(Exception):
    """Writing failed or the automation did not come up; nothing was kept."""


class RevertRefusedError(Exception):
    """Reverting would destroy changes made since, or cannot be done safely."""


class SnapshotStore:
    """Snapshots keyed by change set id, in ``.storage/ai_drafts.snapshots``."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize an empty store; call ``async_load`` before use."""
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._items: dict[str, dict[str, Any]] = {}

    async def async_load(self) -> None:
        """Load the stored snapshots."""
        data = await self._store.async_load()
        items = data.get("snapshots") if isinstance(data, dict) else None
        self._items = items if isinstance(items, dict) else {}

    def get(self, change_set_id: str) -> dict[str, Any] | None:
        """Return the snapshot of a change set."""
        return self._items.get(change_set_id)

    async def async_set(self, change_set_id: str, snapshot: dict[str, Any]) -> None:
        """Store a snapshot and persist."""
        self._items[change_set_id] = snapshot
        await self._store.async_save({"snapshots": self._items})

    async def async_remove(self, change_set_id: str) -> None:
        """Forget a snapshot and persist."""
        if self._items.pop(change_set_id, None) is not None:
            await self._store.async_save({"snapshots": self._items})


# --- file access (runs in the executor) ----------------------------------------


def _normalize(value: Any) -> Any:
    """Return plain JSON types, so YAML loader subclasses compare equal."""
    return json.loads(json.dumps(value, default=str))


def _read_entries(path: str) -> list[Any]:
    """Read the file; a missing or empty file is an empty list."""
    if not os.path.isfile(path):
        return []
    with open(path, encoding="utf-8") as file:
        if _RESOLVED_TAG.search(file.read()):
            raise ApplyError(
                "automations.yaml uses !secret, !include or !env_var. Rewriting "
                "the file would replace them by their values, so it is not "
                "changed automatically"
            )
    try:
        data = load_yaml(path)
    except HomeAssistantError as err:
        raise ApplyError(f"automations.yaml cannot be read: {err}") from None
    if not data:
        return []
    if not isinstance(data, list):
        raise ApplyError(
            "automations.yaml does not contain a list of automations, so it is "
            "not safe to change it automatically"
        )
    return data


def _write_entries(path: str, entries: list[Any]) -> None:
    # Dump before opening the file: if dumping fails nothing is truncated.
    write_utf8_file_atomic(path, dump(entries))


def _ordered_entry(automation_id: str, after: dict[str, Any]) -> dict[str, Any]:
    entry: dict[str, Any] = {CONF_ID: automation_id}
    for key in _KEY_ORDER:
        if key in after:
            entry[key] = after[key]
    entry.update(after)
    entry[CONF_ID] = automation_id
    return entry


def _append_sync(path: str, new_entries: list[dict[str, Any]]) -> bool:
    """Append the entries; return whether the file existed before."""
    existed = os.path.isfile(path)
    entries = _read_entries(path)
    taken = {e.get(CONF_ID) for e in entries if isinstance(e, dict)}
    for new in new_entries:
        if new[CONF_ID] in taken:
            raise ApplyError(
                f"automations.yaml already contains an automation with id "
                f"'{new[CONF_ID]}'"
            )
    _write_entries(path, [*entries, *new_entries])
    return existed


def _remove_sync(
    path: str,
    expected: dict[str, dict[str, Any] | None],
    *,
    delete_file_if_empty: bool,
) -> list[str]:
    """Remove the entries by id; return the ids that were removed.

    A value in ``expected`` that is not None is what the entry must still equal;
    otherwise RevertRefusedError. An entry that is already gone is skipped.
    """
    entries = _read_entries_for_revert(path)
    kept: list[Any] = []
    removed: list[str] = []
    for entry in entries:
        entry_id = entry.get(CONF_ID) if isinstance(entry, dict) else None
        if entry_id in expected:
            wanted = expected[entry_id]
            if wanted is not None and _normalize(entry) != _normalize(wanted):
                raise RevertRefusedError(
                    f"The automation '{entry_id}' was changed after AI Drafts "
                    "wrote it. Revert it by hand in the automation editor."
                )
            removed.append(entry_id)
        else:
            kept.append(entry)
    if not removed:
        return removed
    if not kept and delete_file_if_empty:
        os.unlink(path)
    else:
        _write_entries(path, kept)
    return removed


def _read_entries_for_revert(path: str) -> list[Any]:
    try:
        return _read_entries(path)
    except ApplyError as err:
        raise RevertRefusedError(str(err)) from None


# --- apply ----------------------------------------------------------------------


def _find_automation_entity(hass: HomeAssistant, automation_id: str) -> Any | None:
    component = hass.data.get(automation.DATA_COMPONENT)
    if component is None:
        return None
    return next(
        (e for e in component.entities if e.unique_id == automation_id),
        None,
    )


def _automation_is_up(hass: HomeAssistant, automation_id: str) -> bool:
    entity = _find_automation_entity(hass, automation_id)
    if entity is None or entity.entity_id is None:
        return False
    state = hass.states.get(entity.entity_id)
    return state is not None and state.state != "unavailable"


async def _async_reload(hass: HomeAssistant, automation_id: str) -> None:
    await hass.services.async_call(
        automation.DOMAIN, SERVICE_RELOAD, {CONF_ID: automation_id}, blocking=True
    )


def _remove_registry_entry(hass: HomeAssistant, automation_id: str) -> None:
    """Remove the entity registry entry like Home Assistant's delete hook."""
    ent_reg = er.async_get(hass)
    entity_id = ent_reg.async_get_entity_id(
        automation.DOMAIN, automation.DOMAIN, automation_id
    )
    if entity_id is not None:
        ent_reg.async_remove(entity_id)


async def _async_roll_back(
    hass: HomeAssistant, path: str, ids: list[str], *, file_existed: bool
) -> None:
    """Take our entries out of the file again and drop the half-loaded entities."""
    try:
        await hass.async_add_executor_job(_remove_rollback, path, ids, file_existed)
    except Exception:
        _LOGGER.exception("Could not take the written automations out of %s", path)
    for automation_id in ids:
        try:
            await _async_reload(hass, automation_id)
        except Exception:
            _LOGGER.exception("Reload after rollback of %s failed", automation_id)
        _remove_registry_entry(hass, automation_id)


def _remove_rollback(path: str, ids: list[str], file_existed: bool) -> None:
    # A file that did not exist before is deleted again, not left empty.
    _remove_sync(path, dict.fromkeys(ids), delete_file_if_empty=not file_existed)


def _blocked_message(findings: list[Finding]) -> str:
    errors = [f for f in findings if f.severity.value == "error"]
    first = "; ".join(f.message for f in errors[:3])
    more = f" (and {len(errors) - 3} more)" if len(errors) > 3 else ""
    return f"The checks fail now, nothing was written: {first}{more}"


async def async_apply(
    hass: HomeAssistant,
    data: AIDraftsData,
    change_set: ChangeSet,
    *,
    decided_in: str | None = None,
    views_opened: list[str] | None = None,
) -> None:
    """Write a checked change set, then mark it applied.

    Raises InvalidTransitionError if it is not ``checked``, ApplyBlockedError if
    the checks now find errors, ApplyError if the write or the load failed. In
    every error case the file and the change set are as they were.
    """
    path = hass.config.path(AUTOMATION_CONFIG_PATH)
    async with data.write_lock:
        if change_set.status is not ChangeSetStatus.CHECKED:
            raise InvalidTransitionError(
                f"cannot apply a change set in status '{change_set.status}'"
            )
        # The house may have changed since the draft was checked.
        findings = await async_run_checks(hass, change_set)
        if any(f.severity.value == "error" for f in findings):
            raise ApplyBlockedError(_blocked_message(findings))

        original_operations = change_set.operations
        operations = list(original_operations)
        entries: list[dict[str, Any]] = []
        for index, operation in enumerate(operations):
            after = operation.after or {}
            automation_id = str(after.get(CONF_ID) or uuid4().hex)
            entries.append(_ordered_entry(automation_id, after))
            operations[index] = replace(operation, target_id=automation_id)
        ids = [entry[CONF_ID] for entry in entries]

        await data.snapshots.async_set(
            change_set.id,
            {
                "created": datetime.now(UTC).isoformat(),
                "file": AUTOMATION_CONFIG_PATH,
                "operations": [
                    {
                        "kind": op.kind.value,
                        "op": op.op.value,
                        "target_id": op.target_id,
                        "before": None,
                        "written": _normalize(entry),
                    }
                    for op, entry in zip(operations, entries, strict=True)
                ],
            },
        )
        try:
            file_existed = await hass.async_add_executor_job(
                _append_sync, path, entries
            )
        except (ApplyError, OSError, HomeAssistantError) as err:
            await data.snapshots.async_remove(change_set.id)
            if isinstance(err, ApplyError):
                raise
            raise ApplyError(f"automations.yaml could not be written: {err}") from err

        try:
            for automation_id in ids:
                await _async_reload(hass, automation_id)
            missing = [i for i in ids if not _automation_is_up(hass, i)]
            if missing:
                raise ApplyError(
                    "The automation was written but Home Assistant did not load "
                    f"it ({', '.join(missing)}). Is automations.yaml included in "
                    "the configuration (automation: !include automations.yaml)? "
                    "The file was restored."
                )
            change_set.operations = operations
            change_set.apply()
        except Exception as err:
            # Whatever went wrong after the write, the file must not keep it.
            change_set.operations = original_operations
            await _async_roll_back(hass, path, ids, file_existed=file_existed)
            await data.snapshots.async_remove(change_set.id)
            if isinstance(err, ApplyError):
                raise
            raise ApplyError(
                f"The automation could not be put into service: {err}. "
                "The file was restored."
            ) from err

        await data.changesets.async_update(change_set)
        await data.journal.async_log(
            change_set.id,
            EVENT_APPLIED,
            {
                "automation_ids": ids,
                "decided_in": decided_in,
                "views_opened": views_opened or [],
            },
        )


async def async_revert(
    hass: HomeAssistant, data: AIDraftsData, change_set: ChangeSet
) -> None:
    """Take an applied change set out again, unless it was edited since.

    Raises InvalidTransitionError if it is not ``applied`` and RevertRefusedError
    if the written automations no longer equal what was written. Then nothing
    changes.
    """
    path = hass.config.path(AUTOMATION_CONFIG_PATH)
    async with data.write_lock:
        if change_set.status is not ChangeSetStatus.APPLIED:
            raise InvalidTransitionError(
                f"cannot revert a change set in status '{change_set.status}'"
            )
        snapshot = data.snapshots.get(change_set.id)
        if snapshot is None:
            raise RevertRefusedError("There is no snapshot of this change set.")
        expected = {
            item["target_id"]: item["written"]
            for item in snapshot["operations"]
            if item["op"] == "create"
        }
        try:
            await hass.async_add_executor_job(_revert_sync, path, expected)
        except OSError as err:
            raise RevertRefusedError(
                f"automations.yaml could not be written: {err}"
            ) from err
        for automation_id in expected:
            _remove_registry_entry(hass, automation_id)

        change_set.revert()
        await data.changesets.async_update(change_set)
        await data.journal.async_log(
            change_set.id, EVENT_REVERTED, {"automation_ids": list(expected)}
        )


def _revert_sync(path: str, expected: dict[str, dict[str, Any] | None]) -> None:
    _remove_sync(path, expected, delete_file_if_empty=False)
