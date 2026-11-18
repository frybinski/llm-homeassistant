"""WebSocket API of AI Drafts. All commands require an administrator."""

from __future__ import annotations

from typing import Any

from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.loader import async_get_integration
import voluptuous as vol

from .apply import ApplyError, RevertRefusedError, async_apply, async_revert
from .changeset import (
    ApplyBlockedError,
    ChangeSet,
    ChangeSetError,
    InvalidTransitionError,
)
from .const import (
    CONF_AI_TASK_ENTITY,
    CONF_MODEL,
    CONF_MODEL_SOURCE,
    DOMAIN,
    MODEL_SOURCE_AI_TASK,
    WS_TYPE_CHANGESETS_APPLY,
    WS_TYPE_CHANGESETS_DISCARD,
    WS_TYPE_CHANGESETS_GET,
    WS_TYPE_CHANGESETS_LIST,
    WS_TYPE_CHANGESETS_REVERT,
    WS_TYPE_DRAFT,
    WS_TYPE_INFO,
    WS_TYPE_JOURNAL_LIST,
)
from .data import AIDraftsData
from .drafting import ModelError
from .journal import EVENT_DISCARDED
from .pipeline import DraftBusyError, async_create_draft

ERR_NOT_LOADED = "not_loaded"
ERR_NOT_FOUND = "not_found"
ERR_WRONG_STATE = "wrong_state"
ERR_APPLY_BLOCKED = "apply_blocked"
ERR_APPLY_FAILED = "apply_failed"
ERR_REVERT_REFUSED = "revert_refused"
ERR_BUSY = "busy"
ERR_MODEL = "model_error"

# Sent by the panel with a decision: which view was active, which were opened.
DECISION_FIELDS = {
    vol.Optional("decided_in"): vol.All(str, vol.Length(max=64)),
    vol.Optional("views_opened"): [vol.All(str, vol.Length(max=64))],
}


@callback
def async_register_websocket_commands(hass: HomeAssistant) -> None:
    """Register all commands. Commands cannot be unregistered, so do this once."""
    websocket_api.async_register_command(hass, ws_info)
    websocket_api.async_register_command(hass, ws_changesets_list)
    websocket_api.async_register_command(hass, ws_draft)
    websocket_api.async_register_command(hass, ws_changesets_get)
    websocket_api.async_register_command(hass, ws_changesets_apply)
    websocket_api.async_register_command(hass, ws_changesets_discard)
    websocket_api.async_register_command(hass, ws_changesets_revert)
    websocket_api.async_register_command(hass, ws_journal_list)


@callback
def _get_loaded_entry(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg_id: int
) -> ConfigEntry[AIDraftsData] | None:
    """Return the loaded config entry, or answer with an error and return None."""
    entries = hass.config_entries.async_loaded_entries(DOMAIN)
    if not entries:
        connection.send_error(msg_id, ERR_NOT_LOADED, "AI Drafts is not set up")
        return None
    return entries[0]


@websocket_api.websocket_command({vol.Required("type"): WS_TYPE_INFO})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_info(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the version and the configured model source (never the API key)."""
    if (entry := _get_loaded_entry(hass, connection, msg["id"])) is None:
        return
    integration = await async_get_integration(hass, DOMAIN)
    source = entry.data.get(CONF_MODEL_SOURCE)
    if source == MODEL_SOURCE_AI_TASK:
        model = entry.data.get(CONF_AI_TASK_ENTITY)
    else:
        model = entry.data.get(CONF_MODEL)
    connection.send_result(
        msg["id"],
        {
            "version": str(integration.version),
            "model_source": source,
            "model": model or None,
        },
    )


@websocket_api.websocket_command({vol.Required("type"): WS_TYPE_CHANGESETS_LIST})
@websocket_api.require_admin
@callback
def ws_changesets_list(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the stored change sets, newest first."""
    if (entry := _get_loaded_entry(hass, connection, msg["id"])) is None:
        return
    connection.send_result(
        msg["id"], [cs.to_dict() for cs in entry.runtime_data.changesets.list()]
    )


def _get_change_set(
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
    data: AIDraftsData,
) -> ChangeSet | None:
    """Return the change set named in the message, or answer with an error."""
    change_set = data.changesets.get(msg["change_set_id"])
    if change_set is None:
        connection.send_error(
            msg["id"], ERR_NOT_FOUND, f"Unknown change set {msg['change_set_id']}"
        )
    return change_set


def _send_change_set_error(
    connection: websocket_api.ActiveConnection, msg_id: int, err: Exception
) -> None:
    """Map an error of apply, discard or revert to its error code."""
    if isinstance(err, ApplyBlockedError):
        code = ERR_APPLY_BLOCKED
    elif isinstance(err, InvalidTransitionError):
        code = ERR_WRONG_STATE
    elif isinstance(err, RevertRefusedError):
        code = ERR_REVERT_REFUSED
    else:
        code = ERR_APPLY_FAILED
    connection.send_error(msg_id, code, str(err))


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_DRAFT,
        vol.Required("request"): vol.All(str, vol.Strip, vol.Length(min=1, max=4000)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_draft(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Draft a change set for a request and return it."""
    if (entry := _get_loaded_entry(hass, connection, msg["id"])) is None:
        return
    try:
        change_set = await async_create_draft(hass, entry.runtime_data, msg["request"])
    except DraftBusyError:
        connection.send_error(msg["id"], ERR_BUSY, "Another draft is still running")
    except ModelError as err:
        suffix = f" (recorded as {err.change_set_id})" if err.change_set_id else ""
        connection.send_error(msg["id"], ERR_MODEL, f"{err}{suffix}")
    else:
        connection.send_result(msg["id"], change_set.to_dict())


# The change set id travels as "change_set_id": "id" is the message id of the
# WebSocket envelope and cannot be used for anything else.
@websocket_api.websocket_command(
    {vol.Required("type"): WS_TYPE_CHANGESETS_GET, vol.Required("change_set_id"): str}
)
@websocket_api.require_admin
@callback
def ws_changesets_get(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return one change set."""
    if (entry := _get_loaded_entry(hass, connection, msg["id"])) is None:
        return
    if (change_set := _get_change_set(connection, msg, entry.runtime_data)) is None:
        return
    connection.send_result(msg["id"], change_set.to_dict())


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_CHANGESETS_APPLY,
        vol.Required("change_set_id"): str,
        **DECISION_FIELDS,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_changesets_apply(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Write a checked change set. This is the only way anything gets written."""
    if (entry := _get_loaded_entry(hass, connection, msg["id"])) is None:
        return
    data = entry.runtime_data
    if (change_set := _get_change_set(connection, msg, data)) is None:
        return
    try:
        await async_apply(
            hass,
            data,
            change_set,
            decided_in=msg.get("decided_in"),
            views_opened=msg.get("views_opened"),
        )
    except (ChangeSetError, ApplyError) as err:
        _send_change_set_error(connection, msg["id"], err)
    else:
        connection.send_result(msg["id"], change_set.to_dict())


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_CHANGESETS_DISCARD,
        vol.Required("change_set_id"): str,
        **DECISION_FIELDS,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_changesets_discard(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Throw a change set away without applying it."""
    if (entry := _get_loaded_entry(hass, connection, msg["id"])) is None:
        return
    data = entry.runtime_data
    if (change_set := _get_change_set(connection, msg, data)) is None:
        return
    # Under the write lock, so discard and apply of one change set cannot race.
    async with data.write_lock:
        try:
            change_set.discard()
        except ChangeSetError as err:
            _send_change_set_error(connection, msg["id"], err)
            return
        await data.changesets.async_update(change_set)
        await data.journal.async_log(
            change_set.id,
            EVENT_DISCARDED,
            {
                "decided_in": msg.get("decided_in"),
                "views_opened": msg.get("views_opened") or [],
            },
        )
    connection.send_result(msg["id"], change_set.to_dict())


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_CHANGESETS_REVERT,
        vol.Required("change_set_id"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_changesets_revert(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Take an applied change set out again."""
    if (entry := _get_loaded_entry(hass, connection, msg["id"])) is None:
        return
    data = entry.runtime_data
    if (change_set := _get_change_set(connection, msg, data)) is None:
        return
    try:
        await async_revert(hass, data, change_set)
    except (ChangeSetError, RevertRefusedError) as err:
        _send_change_set_error(connection, msg["id"], err)
    else:
        connection.send_result(msg["id"], change_set.to_dict())


@websocket_api.websocket_command(
    {vol.Required("type"): WS_TYPE_JOURNAL_LIST, vol.Optional("change_set_id"): str}
)
@websocket_api.require_admin
@callback
def ws_journal_list(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the journal entries, oldest first, optionally of one change set."""
    if (entry := _get_loaded_entry(hass, connection, msg["id"])) is None:
        return
    connection.send_result(
        msg["id"], entry.runtime_data.journal.list(msg.get("change_set_id"))
    )
