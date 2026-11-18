"""Constants for the Blaupause integration."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "blaupause"

# Oldest Home Assistant release this integration is developed and tested against.
MIN_HA_VERSION: Final = "2026.10.0"

# Config entry data keys.
CONF_MODEL_SOURCE: Final = "model_source"
CONF_AI_TASK_ENTITY: Final = "ai_task_entity"
CONF_BASE_URL: Final = "base_url"
CONF_API_KEY: Final = "api_key"
CONF_MODEL: Final = "model"

# Values of CONF_MODEL_SOURCE; they double as the config flow menu step ids.
MODEL_SOURCE_AI_TASK: Final = "ai_task"
MODEL_SOURCE_OPENAI_COMPATIBLE: Final = "openai_compatible"

# Sidebar panel.
PANEL_URL_PATH: Final = "blaupause"
PANEL_TITLE: Final = "Blaupause"
PANEL_ICON: Final = "mdi:floor-plan"
PANEL_COMPONENT_NAME: Final = "blaupause-panel"
PANEL_BUNDLE_FILE: Final = "blaupause-panel.js"
PANEL_STATIC_URL: Final = "/blaupause_static"

# WebSocket command types.
WS_TYPE_INFO: Final = f"{DOMAIN}/info"
WS_TYPE_CHANGESETS_LIST: Final = f"{DOMAIN}/changesets/list"
