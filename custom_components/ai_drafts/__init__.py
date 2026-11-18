"""The AI Drafts integration: LLM-assisted design of Home Assistant configuration."""

from __future__ import annotations

import hashlib
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

type AIDraftsConfigEntry = ConfigEntry[ChangeSetStore]


def _content_hash(path: Path) -> str:
    """Return a short hash of a file's content."""
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


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


async def async_setup_entry(hass: HomeAssistant, entry: AIDraftsConfigEntry) -> bool:
    """Set up AI Drafts from a config entry."""
    if AwesomeVersion(HA_VERSION) < AwesomeVersion(MIN_HA_VERSION):
        raise ConfigEntryError(
            f"AI Drafts requires Home Assistant {MIN_HA_VERSION} or newer, "
            f"but this is {HA_VERSION}"
        )

    store = ChangeSetStore(hass)
    await store.async_load()
    entry.runtime_data = store

    # The static path sends long cache headers, so the URL must change whenever
    # the bundle does: version the URL by the content of the file.
    bundle = Path(__file__).parent / "frontend" / PANEL_BUNDLE_FILE
    cache_buster = await hass.async_add_executor_job(_content_hash, bundle)
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_COMPONENT_NAME,
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        module_url=f"{PANEL_STATIC_URL}/{PANEL_BUNDLE_FILE}?v={cache_buster}",
        require_admin=True,
    )
    return True


async def async_unload_entry(hass: HomeAssistant, entry: AIDraftsConfigEntry) -> bool:
    """Unload a config entry and remove the sidebar panel."""
    frontend.async_remove_panel(hass, PANEL_URL_PATH)
    return True
