"""Config flow: choice of the model source."""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.helpers import config_validation as cv, selector
import voluptuous as vol

from .const import (
    CONF_AI_TASK_ENTITY,
    CONF_API_KEY,
    CONF_BASE_URL,
    CONF_MODEL,
    CONF_MODEL_SOURCE,
    DOMAIN,
    MODEL_SOURCE_AI_TASK,
    MODEL_SOURCE_OPENAI_COMPATIBLE,
)

AI_TASK_SCHEMA = vol.Schema(
    {
        vol.Optional(CONF_AI_TASK_ENTITY): selector.EntitySelector(
            selector.EntitySelectorConfig(domain="ai_task")
        ),
    }
)

OPENAI_COMPATIBLE_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_BASE_URL): selector.TextSelector(
            selector.TextSelectorConfig(type=selector.TextSelectorType.URL)
        ),
        vol.Optional(CONF_API_KEY): selector.TextSelector(
            selector.TextSelectorConfig(type=selector.TextSelectorType.PASSWORD)
        ),
        vol.Required(CONF_MODEL): selector.TextSelector(),
    }
)


class AIDraftsConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle the config flow for AI Drafts."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Let the user choose where the model comes from."""
        return self.async_show_menu(
            step_id="user",
            menu_options=[MODEL_SOURCE_AI_TASK, MODEL_SOURCE_OPENAI_COMPATIBLE],
        )

    async def async_step_ai_task(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Use a Home Assistant AI Task entity."""
        if user_input is not None:
            return self.async_create_entry(
                title="AI Drafts",
                data={
                    CONF_MODEL_SOURCE: MODEL_SOURCE_AI_TASK,
                    # None means: use Home Assistant's preferred AI Task entity.
                    CONF_AI_TASK_ENTITY: user_input.get(CONF_AI_TASK_ENTITY) or None,
                },
            )
        return self.async_show_form(step_id="ai_task", data_schema=AI_TASK_SCHEMA)

    async def async_step_openai_compatible(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Use an OpenAI-compatible server such as Ollama."""
        errors: dict[str, str] = {}
        if user_input is not None:
            base_url = user_input[CONF_BASE_URL].strip()
            try:
                cv.url(base_url)
            except vol.Invalid:
                errors[CONF_BASE_URL] = "invalid_url"
            else:
                return self.async_create_entry(
                    title="AI Drafts",
                    data={
                        CONF_MODEL_SOURCE: MODEL_SOURCE_OPENAI_COMPATIBLE,
                        CONF_BASE_URL: base_url,
                        CONF_API_KEY: user_input.get(CONF_API_KEY) or None,
                        CONF_MODEL: user_input[CONF_MODEL].strip(),
                    },
                )
        return self.async_show_form(
            step_id="openai_compatible",
            data_schema=self.add_suggested_values_to_schema(
                OPENAI_COMPATIBLE_SCHEMA, user_input
            ),
            errors=errors,
        )
