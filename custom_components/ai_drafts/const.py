"""Constants for the AI Drafts integration."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "ai_drafts"

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
PANEL_URL_PATH: Final = "ai-drafts"
PANEL_TITLE: Final = "AI Drafts"
PANEL_ICON: Final = "mdi:floor-plan"
PANEL_COMPONENT_NAME: Final = "ai-drafts-panel"
PANEL_BUNDLE_FILE: Final = "ai-drafts-panel.js"
PANEL_STATIC_URL: Final = "/ai_drafts_static"

# WebSocket command types.
WS_TYPE_INFO: Final = f"{DOMAIN}/info"
WS_TYPE_CHANGESETS_LIST: Final = f"{DOMAIN}/changesets/list"
WS_TYPE_MODELS: Final = f"{DOMAIN}/models"
WS_TYPE_DRAFT: Final = f"{DOMAIN}/draft"
WS_TYPE_CHANGESETS_GET: Final = f"{DOMAIN}/changesets/get"
WS_TYPE_CHANGESETS_APPLY: Final = f"{DOMAIN}/changesets/apply"
WS_TYPE_CHANGESETS_DISCARD: Final = f"{DOMAIN}/changesets/discard"
WS_TYPE_CHANGESETS_REVERT: Final = f"{DOMAIN}/changesets/revert"
WS_TYPE_JOURNAL_LIST: Final = f"{DOMAIN}/journal/list"
WS_TYPE_NET_GET: Final = f"{DOMAIN}/net/get"
WS_TYPE_NET_EXPORT: Final = f"{DOMAIN}/net/export"
