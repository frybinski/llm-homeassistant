"""Config flow: choice of the model source, with a connection test."""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import (
    SOURCE_RECONFIGURE,
    ConfigFlow,
    ConfigFlowResult,
)
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
from .drafting import (
    CannotConnectError,
    InvalidAuthError,
    ModelListError,
    NotOpenAICompatibleError,
    async_list_models,
)

MENU_OPTIONS = [MODEL_SOURCE_AI_TASK, MODEL_SOURCE_OPENAI_COMPATIBLE]

OPENAI_CONNECTION_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_BASE_URL): selector.TextSelector(
            selector.TextSelectorConfig(type=selector.TextSelectorType.URL)
        ),
        vol.Optional(CONF_API_KEY): selector.TextSelector(
            selector.TextSelectorConfig(type=selector.TextSelectorType.PASSWORD)
        ),
    }
)


def _ai_task_schema() -> vol.Schema:
    # Built on demand: resolving the feature name imports the ai_task integration.
    try:
        field = selector.EntitySelector(
            selector.EntitySelectorConfig(
                filter=selector.EntityFilterSelectorConfig(
                    domain="ai_task",
                    supported_features=["ai_task.AITaskEntityFeature.GENERATE_DATA"],
                )
            )
        )
    except vol.Invalid:
        # ai_task cannot be imported here, so the feature name is unknown.
        # Offer every ai_task entity instead of failing the step.
        field = selector.EntitySelector(selector.EntitySelectorConfig(domain="ai_task"))
    return vol.Schema({vol.Optional(CONF_AI_TASK_ENTITY): field})


def _model_schema(models: list[str]) -> vol.Schema:
    field: selector.Selector[Any]
    if models:
        field = selector.SelectSelector(
            selector.SelectSelectorConfig(
                options=models,
                custom_value=True,
                mode=selector.SelectSelectorMode.DROPDOWN,
            )
        )
    else:
        field = selector.TextSelector()
    return vol.Schema({vol.Required(CONF_MODEL): field})


class AIDraftsConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle the config flow for AI Drafts."""

    VERSION = 1

    def __init__(self) -> None:
        """Initialize the state shared by the two steps of the server source."""
        self._base_url = ""
        self._api_key: str | None = None
        self._models: list[str] = []

    @property
    def _current(self) -> dict[str, Any]:
        """Return the entry data to pre-fill forms with (reconfigure only)."""
        if self.source == SOURCE_RECONFIGURE:
            return dict(self._get_reconfigure_entry().data)
        return {}

    def _finish(self, data: dict[str, Any]) -> ConfigFlowResult:
        """Create the entry, or replace the data of the reconfigured one."""
        if self.source == SOURCE_RECONFIGURE:
            # ``data`` replaces the old data, so keys of the other source vanish.
            return self.async_update_reload_and_abort(
                self._get_reconfigure_entry(),
                data=data,
                reason="reconfigure_successful",
            )
        return self.async_create_entry(title="AI Drafts", data=data)

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Let the user choose where the model comes from."""
        return self.async_show_menu(step_id="user", menu_options=MENU_OPTIONS)

    async def async_step_reconfigure(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Let the user choose the model source again."""
        return self.async_show_menu(step_id="reconfigure", menu_options=MENU_OPTIONS)

    async def async_step_ai_task(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Use a Home Assistant AI Task entity."""
        if user_input is not None:
            return self._finish(
                {
                    CONF_MODEL_SOURCE: MODEL_SOURCE_AI_TASK,
                    # None means: use Home Assistant's preferred AI Task entity.
                    CONF_AI_TASK_ENTITY: user_input.get(CONF_AI_TASK_ENTITY) or None,
                }
            )
        return self.async_show_form(
            step_id="ai_task",
            data_schema=self.add_suggested_values_to_schema(
                _ai_task_schema(), self._current
            ),
        )

    async def async_step_openai_compatible(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Ask for the server's address and test it."""
        errors: dict[str, str] = {}
        if user_input is not None:
            base_url = user_input[CONF_BASE_URL].strip().rstrip("/")
            api_key = (user_input.get(CONF_API_KEY) or "").strip() or None
            try:
                cv.url(base_url)
            except vol.Invalid:
                errors[CONF_BASE_URL] = "invalid_url"
            else:
                try:
                    models = await async_list_models(self.hass, base_url, api_key)
                except CannotConnectError:
                    errors["base"] = "cannot_connect"
                except InvalidAuthError:
                    errors["base"] = "invalid_auth"
                except NotOpenAICompatibleError:
                    errors["base"] = "not_openai_compatible"
                except ModelListError:  # pragma: no cover - future subclasses
                    errors["base"] = "cannot_connect"
                else:
                    self._base_url = base_url
                    self._api_key = api_key
                    self._models = models
                    return await self.async_step_openai_model()
        suggested = user_input if user_input is not None else self._current
        return self.async_show_form(
            step_id="openai_compatible",
            data_schema=self.add_suggested_values_to_schema(
                OPENAI_CONNECTION_SCHEMA, suggested
            ),
            errors=errors,
        )

    async def async_step_openai_model(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Ask for the model, offering the ones the server lists."""
        if user_input is not None:
            return self._finish(
                {
                    CONF_MODEL_SOURCE: MODEL_SOURCE_OPENAI_COMPATIBLE,
                    CONF_BASE_URL: self._base_url,
                    CONF_API_KEY: self._api_key,
                    CONF_MODEL: user_input[CONF_MODEL].strip(),
                }
            )
        return self.async_show_form(
            step_id="openai_model",
            data_schema=self.add_suggested_values_to_schema(
                _model_schema(self._models), self._current
            ),
        )
