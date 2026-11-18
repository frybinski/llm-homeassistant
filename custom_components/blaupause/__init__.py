"""The Blaupause integration: LLM-assisted design of Home Assistant configuration."""

from __future__ import annotations

import logging
from pathlib import Path

from awesomeversion import AwesomeVersion
from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import __version__ as HA_VERSION
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType
from homeassistant.loader import async_get_integration

from .changeset import ChangeSetStore
from .const import (
    DOMAIN,
    MIN_HA_VERSION,
    PANEL_BUNDLE_FILE,
    PANEL_COMPONENT_NAME,
    PANEL_ICON,
    PANEL_STATIC_URL,
    PANEL_TITLE,
    PANEL_URL_PATH,
)
from .websocket import async_register_websocket_commands

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

type BlaupauseConfigEntry = ConfigEntry[ChangeSetStore]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register what cannot be unregistered: the bundle path and WebSocket commands."""
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                PANEL_STATIC_URL,
                str(Path(__file__).parent / "frontend"),
                cache_headers=True,
            )
        ]
    )
    async_register_websocket_commands(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: BlaupauseConfigEntry) -> bool:
    """Set up Blaupause from a config entry."""
    if AwesomeVersion(HA_VERSION) < AwesomeVersion(MIN_HA_VERSION):
        raise ConfigEntryError(
            f"Blaupause requires Home Assistant {MIN_HA_VERSION} or newer, "
            f"but this is {HA_VERSION}"
        )

    store = ChangeSetStore(hass)
    await store.async_load()
    entry.runtime_data = store

    integration = await async_get_integration(hass, DOMAIN)
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_COMPONENT_NAME,
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        module_url=f"{PANEL_STATIC_URL}/{PANEL_BUNDLE_FILE}?v={integration.version}",
        require_admin=True,
    )
    return True


async def async_unload_entry(hass: HomeAssistant, entry: BlaupauseConfigEntry) -> bool:
    """Unload a config entry and remove the sidebar panel."""
    frontend.async_remove_panel(hass, PANEL_URL_PATH)
    return True
