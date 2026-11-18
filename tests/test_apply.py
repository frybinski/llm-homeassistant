"""Tests for apply, snapshot and revert against a real automations.yaml.

Nothing here mocks the write: each test runs with a temporary configuration
directory that has a real ``configuration.yaml``, a real ``automations.yaml`` and
the real ``automation.reload`` service.
"""

import asyncio
import copy
from pathlib import Path
from typing import Any
from unittest.mock import patch

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_registry as er
from homeassistant.util.yaml import dump, load_yaml
import pytest

from custom_components.ai_drafts import apply
from custom_components.ai_drafts.apply import (
    ApplyError,
    RevertRefusedError,
    async_apply,
    async_revert,
)
from custom_components.ai_drafts.changeset import (
    ApplyBlockedError,
    ChangeSet,
    ChangeSetStatus,
    InvalidTransitionError,
)
from custom_components.ai_drafts.data import AIDraftsData

from .common import (
    build_house,
    create_op,
    flur_automation,
    make_change_set,
    setup_entry,
)

ENTITY_ID = "automation.flurlicht_bei_bewegung"
OTHER = {
    "id": "handmade",
    "alias": "Handgemacht",
    "triggers": [{"trigger": "homeassistant", "event": "start"}],
    "actions": [],
}


async def start(
    hass: HomeAssistant, config_dir: Path, existing: Any = None
) -> AIDraftsData:
    """Set up the house and the integration, with an optional existing file."""
    # Home Assistant creates an empty automations.yaml when it writes its
    # default configuration, and `!include` of a missing file is an error.
    (config_dir / "automations.yaml").write_text(
        "" if existing is None else dump(existing), encoding="utf-8"
    )
    await build_house(hass)
    entry = await setup_entry(hass)
    # The dependency set automation up with an empty config; load the file.
    await hass.services.async_call("automation", "reload", blocking=True)
    await hass.async_block_till_done()
    return entry.runtime_data


async def checked(data: AIDraftsData, *afters: dict[str, Any]) -> ChangeSet:
    change_set = ChangeSet.new(
        "request", [create_op(a) for a in afters] or [create_op(flur_automation())], "m"
    )
    change_set.complete_check([])
    assert change_set.status is ChangeSetStatus.CHECKED
    await data.changesets.async_add(change_set)
    return change_set


def read_file(config_dir: Path) -> Any:
    return load_yaml(str(config_dir / "automations.yaml"))


def entity_exists(hass: HomeAssistant, entity_id: str = ENTITY_ID) -> bool:
    return hass.states.get(entity_id) is not None


async def test_apply_writes_the_file_and_loads_the_automation(
    hass: HomeAssistant, config_dir: Path
) -> None:
    data = await start(hass, config_dir)
    change_set = await checked(data)

    await async_apply(
        hass, data, change_set, decided_in="domain", views_opened=["domain", "yaml"]
    )

    # The file: a list with the automation, id first, then the editor's key order.
    entries = read_file(config_dir)
    assert len(entries) == 1
    entry = entries[0]
    automation_id = entry["id"]
    assert len(automation_id) == 32
    assert list(entry) == [
        "id",
        "alias",
        "description",
        "triggers",
        "conditions",
        "actions",
        "mode",
    ]
    assert {k: v for k, v in entry.items() if k != "id"} == flur_automation()

    # The automation exists and is on.
    state = hass.states.get(ENTITY_ID)
    assert state is not None
    assert state.state == "on"
    assert state.attributes["id"] == automation_id

    # The change set is applied, knows the id, and is persisted.
    assert change_set.status is ChangeSetStatus.APPLIED
    assert change_set.decided is not None
    assert change_set.operations[0].target_id == automation_id
    assert data.changesets.get(change_set.id).status is ChangeSetStatus.APPLIED

    # The snapshot: nothing before, exactly what was written.
    snapshot = data.snapshots.get(change_set.id)
    assert snapshot["file"] == "automations.yaml"
    [op] = snapshot["operations"]
    assert op["before"] is None
    assert op["target_id"] == automation_id
    assert op["written"] == entry

    # The journal.
    [applied] = [e for e in data.journal.list(change_set.id) if e["event"] == "applied"]
    assert applied["data"] == {
        "automation_ids": [automation_id],
        "decided_in": "domain",
        "views_opened": ["domain", "yaml"],
    }


async def test_apply_uses_the_id_from_the_model(
    hass: HomeAssistant, config_dir: Path
) -> None:
    data = await start(hass, config_dir)
    change_set = await checked(data, flur_automation(id="my-own-id"))
    await async_apply(hass, data, change_set)
    assert read_file(config_dir)[0]["id"] == "my-own-id"
    assert change_set.operations[0].target_id == "my-own-id"
    assert hass.states.get(ENTITY_ID).attributes["id"] == "my-own-id"


async def test_apply_keeps_existing_automations(
    hass: HomeAssistant, config_dir: Path
) -> None:
    data = await start(hass, config_dir, existing=[OTHER])
    assert entity_exists(hass, "automation.handgemacht")
    change_set = await checked(data)
    await async_apply(hass, data, change_set)
    entries = read_file(config_dir)
    assert entries[0]["id"] == "handmade"
    assert len(entries) == 2
    assert entity_exists(hass, "automation.handgemacht")
    assert entity_exists(hass)


async def test_apply_several_operations(hass: HomeAssistant, config_dir: Path) -> None:
    data = await start(hass, config_dir)
    second = flur_automation(alias="Zweite")
    change_set = await checked(data, flur_automation(), second)
    await async_apply(hass, data, change_set)
    assert len(read_file(config_dir)) == 2
    assert entity_exists(hass)
    assert entity_exists(hass, "automation.zweite")
    ids = [op.target_id for op in change_set.operations]
    assert len(set(ids)) == 2


async def test_apply_refuses_when_the_file_is_not_included(
    hass: HomeAssistant, config_dir: Path
) -> None:
    (config_dir / "configuration.yaml").write_text("homeassistant:\n", encoding="utf-8")
    data = await start(hass, config_dir)
    (config_dir / "automations.yaml").unlink()  # not part of this configuration
    change_set = await checked(data)

    with pytest.raises(ApplyError, match=r"automation: !include automations\.yaml"):
        await async_apply(hass, data, change_set)

    # The file did not exist before and does not exist now.
    assert not (config_dir / "automations.yaml").exists()
    assert not entity_exists(hass)
    assert change_set.status is ChangeSetStatus.CHECKED
    assert change_set.operations[0].target_id is None
    assert data.changesets.get(change_set.id).status is ChangeSetStatus.CHECKED
    assert data.snapshots.get(change_set.id) is None
    assert [e["event"] for e in data.journal.list(change_set.id)] == []


async def test_not_included_restores_an_existing_file_exactly(
    hass: HomeAssistant, config_dir: Path
) -> None:
    data = await start(hass, config_dir, existing=[OTHER])
    # From now on the file is no longer part of the configuration.
    (config_dir / "configuration.yaml").write_text("homeassistant:\n", encoding="utf-8")
    before = (config_dir / "automations.yaml").read_text(encoding="utf-8")
    change_set = await checked(data)

    with pytest.raises(ApplyError, match="did not load"):
        await async_apply(hass, data, change_set)

    assert (config_dir / "automations.yaml").read_text(encoding="utf-8") == before
    assert read_file(config_dir) == [OTHER]
    assert not entity_exists(hass)
    assert change_set.status is ChangeSetStatus.CHECKED


async def test_apply_rechecks_and_refuses_on_errors_without_writing(
    hass: HomeAssistant, config_dir: Path
) -> None:
    data = await start(hass, config_dir)
    change_set = await checked(data)
    # Between check and apply the light disappears from the house.
    hass.states.async_remove("light.flurlicht")
    er.async_get(hass).async_remove("light.flurlicht")

    with pytest.raises(ApplyBlockedError, match=r"light\.flurlicht"):
        await async_apply(hass, data, change_set)

    assert (config_dir / "automations.yaml").read_text(encoding="utf-8") == ""
    assert change_set.status is ChangeSetStatus.CHECKED
    assert change_set.operations[0].target_id is None
    assert data.snapshots.get(change_set.id) is None
    assert not entity_exists(hass)


async def test_apply_refuses_when_the_alias_was_taken_in_the_meantime(
    hass: HomeAssistant, config_dir: Path
) -> None:
    data = await start(hass, config_dir)
    first = await checked(data)
    second = await checked(data)
    await async_apply(hass, data, first)
    before = (config_dir / "automations.yaml").read_text(encoding="utf-8")

    with pytest.raises(ApplyBlockedError, match="already exists"):
        await async_apply(hass, data, second)
    assert (config_dir / "automations.yaml").read_text(encoding="utf-8") == before
    assert second.status is ChangeSetStatus.CHECKED


@pytest.mark.parametrize(
    "status",
    [
        ChangeSetStatus.DRAFT,
        ChangeSetStatus.FAILED,
        ChangeSetStatus.DISCARDED,
        ChangeSetStatus.APPLIED,
        ChangeSetStatus.REVERTED,
    ],
)
async def test_apply_only_from_checked(
    hass: HomeAssistant, config_dir: Path, status: ChangeSetStatus
) -> None:
    data = await start(hass, config_dir)
    change_set = make_change_set()
    change_set.status = status
    await data.changesets.async_add(change_set)
    with pytest.raises(InvalidTransitionError):
        await async_apply(hass, data, change_set)
    assert (config_dir / "automations.yaml").read_text(encoding="utf-8") == ""


@pytest.mark.parametrize(
    "content",
    ["alias: not a list\ntriggers: []\n", "- alias: [unclosed\n  broken: {\n"],
)
async def test_apply_does_not_overwrite_a_file_that_is_not_a_list(
    hass: HomeAssistant, config_dir: Path, content: str
) -> None:
    data = await start(hass, config_dir)
    (config_dir / "automations.yaml").write_text(content, encoding="utf-8")
    change_set = await checked(data)
    with pytest.raises(ApplyError):
        await async_apply(hass, data, change_set)
    assert (config_dir / "automations.yaml").read_text(encoding="utf-8") == content
    assert change_set.status is ChangeSetStatus.CHECKED
    assert data.snapshots.get(change_set.id) is None


async def test_apply_refuses_an_id_that_is_already_in_the_file(
    hass: HomeAssistant, config_dir: Path
) -> None:
    data = await start(hass, config_dir)
    # In the file but never loaded, so the checks cannot see it.
    taken = [{**OTHER, "id": "taken"}]
    (config_dir / "automations.yaml").write_text(dump(taken), encoding="utf-8")
    change_set = await checked(data, flur_automation(id="taken"))
    with pytest.raises(
        ApplyError, match="already contains an automation with id 'taken'"
    ):
        await async_apply(hass, data, change_set)
    assert read_file(config_dir) == taken


async def test_failed_reload_restores_the_file(
    hass: HomeAssistant, config_dir: Path
) -> None:
    data = await start(hass, config_dir, existing=[OTHER])
    before = (config_dir / "automations.yaml").read_text(encoding="utf-8")
    change_set = await checked(data)
    real_reload = apply._async_reload
    calls = 0

    async def failing_reload(hass: HomeAssistant, automation_id: str) -> None:
        nonlocal calls
        calls += 1
        if calls == 1:  # the reload after writing; the one after rollback works
            raise HomeAssistantError("reload exploded")
        await real_reload(hass, automation_id)

    with (
        patch.object(apply, "_async_reload", failing_reload),
        pytest.raises(ApplyError, match="reload exploded"),
    ):
        await async_apply(hass, data, change_set)
    assert (config_dir / "automations.yaml").read_text(encoding="utf-8") == before
    assert change_set.status is ChangeSetStatus.CHECKED
    assert data.snapshots.get(change_set.id) is None


async def test_concurrent_applies_do_not_lose_writes(
    hass: HomeAssistant, config_dir: Path
) -> None:
    data = await start(hass, config_dir)
    first = await checked(data, flur_automation(alias="Eins"))
    second = await checked(data, flur_automation(alias="Zwei"))
    await asyncio.gather(
        async_apply(hass, data, first), async_apply(hass, data, second)
    )
    assert sorted(e["alias"] for e in read_file(config_dir)) == ["Eins", "Zwei"]
    assert entity_exists(hass, "automation.eins")
    assert entity_exists(hass, "automation.zwei")


# --- revert ---------------------------------------------------------------------


async def test_revert_removes_entry_entity_and_registry_entry(
    hass: HomeAssistant, config_dir: Path
) -> None:
    data = await start(hass, config_dir, existing=[OTHER])
    change_set = await checked(data)
    await async_apply(hass, data, change_set)
    automation_id = change_set.operations[0].target_id
    ent_reg = er.async_get(hass)
    assert ent_reg.async_get_entity_id("automation", "automation", automation_id)

    await async_revert(hass, data, change_set)
    await hass.async_block_till_done()

    assert read_file(config_dir) == [OTHER]
    assert not entity_exists(hass)
    assert (
        ent_reg.async_get_entity_id("automation", "automation", automation_id) is None
    )
    assert entity_exists(hass, "automation.handgemacht")
    assert change_set.status is ChangeSetStatus.REVERTED
    assert data.changesets.get(change_set.id).status is ChangeSetStatus.REVERTED
    assert [e["event"] for e in data.journal.list(change_set.id)] == [
        "applied",
        "reverted",
    ]


async def test_revert_of_the_only_automation_leaves_an_empty_list(
    hass: HomeAssistant, config_dir: Path
) -> None:
    data = await start(hass, config_dir)
    change_set = await checked(data)
    await async_apply(hass, data, change_set)
    await async_revert(hass, data, change_set)
    await hass.async_block_till_done()
    assert (config_dir / "automations.yaml").read_text(encoding="utf-8").strip() == "[]"
    assert not entity_exists(hass)


async def test_revert_refuses_after_a_manual_edit(
    hass: HomeAssistant, config_dir: Path
) -> None:
    data = await start(hass, config_dir)
    change_set = await checked(data)
    await async_apply(hass, data, change_set)

    entries = copy.deepcopy(read_file(config_dir))
    entries[0]["description"] = "Von Hand geändert"
    (config_dir / "automations.yaml").write_text(dump(entries), encoding="utf-8")
    edited = (config_dir / "automations.yaml").read_text(encoding="utf-8")

    with pytest.raises(RevertRefusedError, match="changed after AI Drafts wrote it"):
        await async_revert(hass, data, change_set)

    assert (config_dir / "automations.yaml").read_text(encoding="utf-8") == edited
    assert entity_exists(hass)
    assert change_set.status is ChangeSetStatus.APPLIED
    assert data.changesets.get(change_set.id).status is ChangeSetStatus.APPLIED


async def test_revert_refuses_when_the_file_is_no_longer_a_list(
    hass: HomeAssistant, config_dir: Path
) -> None:
    data = await start(hass, config_dir)
    change_set = await checked(data)
    await async_apply(hass, data, change_set)
    (config_dir / "automations.yaml").write_text("alias: x\n", encoding="utf-8")
    with pytest.raises(RevertRefusedError, match="not safe"):
        await async_revert(hass, data, change_set)
    assert change_set.status is ChangeSetStatus.APPLIED


async def test_revert_when_the_user_already_deleted_it(
    hass: HomeAssistant, config_dir: Path
) -> None:
    data = await start(hass, config_dir, existing=[OTHER])
    change_set = await checked(data)
    await async_apply(hass, data, change_set)
    (config_dir / "automations.yaml").write_text(dump([OTHER]), encoding="utf-8")
    await async_revert(hass, data, change_set)
    await hass.async_block_till_done()
    assert read_file(config_dir) == [OTHER]
    assert change_set.status is ChangeSetStatus.REVERTED
    assert not entity_exists(hass)


@pytest.mark.parametrize(
    "status",
    [
        ChangeSetStatus.DRAFT,
        ChangeSetStatus.CHECKED,
        ChangeSetStatus.FAILED,
        ChangeSetStatus.DISCARDED,
        ChangeSetStatus.REVERTED,
    ],
)
async def test_revert_only_from_applied(
    hass: HomeAssistant, config_dir: Path, status: ChangeSetStatus
) -> None:
    data = await start(hass, config_dir)
    change_set = make_change_set()
    change_set.status = status
    await data.changesets.async_add(change_set)
    with pytest.raises(InvalidTransitionError):
        await async_revert(hass, data, change_set)


async def test_revert_without_snapshot_is_refused(
    hass: HomeAssistant, config_dir: Path
) -> None:
    data = await start(hass, config_dir)
    change_set = make_change_set()
    change_set.status = ChangeSetStatus.APPLIED
    await data.changesets.async_add(change_set)
    with pytest.raises(RevertRefusedError, match="no snapshot"):
        await async_revert(hass, data, change_set)


async def test_snapshots_are_persisted_per_change_set(
    hass: HomeAssistant, config_dir: Path, hass_storage: dict[str, Any]
) -> None:
    data = await start(hass, config_dir)
    first = await checked(data, flur_automation(alias="Eins"))
    second = await checked(data, flur_automation(alias="Zwei"))
    await async_apply(hass, data, first)
    await async_apply(hass, data, second)
    stored = hass_storage["ai_drafts.snapshots"]["data"]["snapshots"]
    assert set(stored) == {first.id, second.id}
    assert stored[first.id]["operations"][0]["written"]["alias"] == "Eins"


SECRET_FILE = """\
- id: handmade
  alias: Handgemacht
  description: !secret flur_note
  triggers:
  - trigger: homeassistant
    event: start
  actions: []
"""


async def test_apply_refuses_a_file_that_uses_secrets(
    hass: HomeAssistant, config_dir: Path
) -> None:
    # Rewriting would replace `!secret flur_note` by the secret itself.
    data = await start(hass, config_dir)
    (config_dir / "secrets.yaml").write_text("flur_note: geheim\n", encoding="utf-8")
    (config_dir / "automations.yaml").write_text(SECRET_FILE, encoding="utf-8")
    change_set = await checked(data)

    with pytest.raises(ApplyError, match="!secret"):
        await async_apply(hass, data, change_set)

    assert (config_dir / "automations.yaml").read_text(encoding="utf-8") == SECRET_FILE
    assert change_set.status is ChangeSetStatus.CHECKED
    assert data.snapshots.get(change_set.id) is None


async def test_revert_refuses_a_file_that_uses_secrets(
    hass: HomeAssistant, config_dir: Path
) -> None:
    data = await start(hass, config_dir)
    change_set = await checked(data)
    await async_apply(hass, data, change_set)
    (config_dir / "secrets.yaml").write_text("flur_note: geheim\n", encoding="utf-8")
    path = config_dir / "automations.yaml"
    edited = path.read_text(encoding="utf-8") + SECRET_FILE
    path.write_text(edited, encoding="utf-8")

    with pytest.raises(RevertRefusedError, match="!secret"):
        await async_revert(hass, data, change_set)

    assert path.read_text(encoding="utf-8") == edited
    assert change_set.status is ChangeSetStatus.APPLIED
