"""Tests for the config flow."""

from homeassistant.config_entries import SOURCE_USER
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType

from custom_components.blaupause.const import DOMAIN


async def _start(hass: HomeAssistant):
    return await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": SOURCE_USER}
    )


async def test_first_step_is_a_menu(hass: HomeAssistant) -> None:
    result = await _start(hass)
    assert result["type"] is FlowResultType.MENU
    assert result["menu_options"] == ["ai_task", "openai_compatible"]


async def test_ai_task_with_entity(hass: HomeAssistant) -> None:
    result = await _start(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"next_step_id": "ai_task"}
    )
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "ai_task"
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"ai_task_entity": "ai_task.my_model"}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["data"] == {
        "model_source": "ai_task",
        "ai_task_entity": "ai_task.my_model",
    }


async def test_ai_task_without_entity_means_preferred(hass: HomeAssistant) -> None:
    result = await _start(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"next_step_id": "ai_task"}
    )
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["data"] == {"model_source": "ai_task", "ai_task_entity": None}


async def test_openai_compatible(hass: HomeAssistant) -> None:
    result = await _start(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"next_step_id": "openai_compatible"}
    )
    assert result["step_id"] == "openai_compatible"
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        {
            "base_url": "http://localhost:11434/v1",
            "api_key": "secret",
            "model": "llama3.1",
        },
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["data"] == {
        "model_source": "openai_compatible",
        "base_url": "http://localhost:11434/v1",
        "api_key": "secret",
        "model": "llama3.1",
    }


async def test_openai_compatible_api_key_is_optional(hass: HomeAssistant) -> None:
    result = await _start(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"next_step_id": "openai_compatible"}
    )
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        {"base_url": "http://ollama.local:11434/v1", "model": "llama3.1"},
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["data"]["api_key"] is None


async def test_openai_compatible_rejects_invalid_url(hass: HomeAssistant) -> None:
    result = await _start(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"next_step_id": "openai_compatible"}
    )
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"base_url": "not a url", "model": "m"}
    )
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"base_url": "invalid_url"}
    # The form is shown again and can still be completed.
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"base_url": "https://api.example.com/v1", "model": "m"}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY


async def test_second_flow_aborts(hass: HomeAssistant) -> None:
    result = await _start(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"next_step_id": "ai_task"}
    )
    await hass.config_entries.flow.async_configure(result["flow_id"], {})

    second = await _start(hass)
    assert second["type"] is FlowResultType.ABORT
    assert second["reason"] == "single_instance_allowed"
