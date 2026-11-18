"""WebSocket API of AI Drafts. All commands require an administrator."""

from __future__ import annotations

from typing import Any

from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.loader import async_get_integration
import voluptuous as vol

from .changeset import ChangeSetStore
from .const import (
    CONF_AI_TASK_ENTITY,
    CONF_MODEL,
    CONF_MODEL_SOURCE,
    DOMAIN,
    MODEL_SOURCE_AI_TASK,
    WS_TYPE_CHANGESETS_LIST,
    WS_TYPE_INFO,
)

ERR_NOT_LOADED = "not_loaded"


@callback
def async_register_websocket_commands(hass: HomeAssistant) -> None:
    """Register all commands. Commands cannot be unregistered, so do this once."""
    websocket_api.async_register_command(hass, ws_info)
    websocket_api.async_register_command(hass, ws_changesets_list)


@callback
def _get_loaded_entry(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg_id: int
) -> ConfigEntry[ChangeSetStore] | None:
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
        msg["id"], [cs.to_dict() for cs in entry.runtime_data.list()]
    )
