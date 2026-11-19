"""Tests for the config flow."""

import asyncio
from typing import Any
from unittest.mock import patch

import aiohttp
from homeassistant.config_entries import SOURCE_USER, ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
import pytest
from pytest_homeassistant_custom_component.test_util.aiohttp import (
    AiohttpClientMocker,
)

from custom_components.ai_drafts import drafting
from custom_components.ai_drafts.const import DOMAIN

from .common import OPENAI_DATA, setup_entry

MODELS_URL = "http://llm.test/v1/models"
MODEL_LIST = {"object": "list", "data": [{"id": "llama3.1"}, {"id": "qwen3"}]}


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


async def _to_connection_step(hass: HomeAssistant):
    result = await _start(hass)
    return await hass.config_entries.flow.async_configure(
        result["flow_id"], {"next_step_id": "openai_compatible"}
    )


def _model_field_selector(result) -> Any:
    schema = result["data_schema"].schema
    return next(v for k, v in schema.items() if k == "model")


async def test_openai_compatible_two_steps_with_api_key(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker
) -> None:
    aioclient_mock.get(MODELS_URL, json=MODEL_LIST)
    result = await _to_connection_step(hass)
    assert result["step_id"] == "openai_compatible"
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        {"base_url": "  http://llm.test/v1/ ", "api_key": "secret"},
    )
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "openai_model"
    assert aioclient_mock.mock_calls[0][3]["Authorization"] == "Bearer secret"
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"model": "llama3.1"}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["data"] == {
        "model_source": "openai_compatible",
        "base_url": "http://llm.test/v1",
        "api_key": "secret",
        "model": "llama3.1",
    }


async def test_openai_compatible_two_steps_without_api_key(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker
) -> None:
    aioclient_mock.get(MODELS_URL, json=MODEL_LIST)
    result = await _to_connection_step(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"base_url": "http://llm.test/v1"}
    )
    assert "Authorization" not in aioclient_mock.mock_calls[0][3]
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"model": "qwen3"}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["data"]["api_key"] is None
    assert result["data"]["model"] == "qwen3"


async def test_model_step_offers_the_servers_models(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker
) -> None:
    aioclient_mock.get(MODELS_URL, json=MODEL_LIST)
    result = await _to_connection_step(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"base_url": "http://llm.test/v1"}
    )
    selector = _model_field_selector(result)
    assert selector.config["options"] == ["llama3.1", "qwen3"]
    assert selector.config["custom_value"] is True
    # A model that is not in the list is accepted.
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"model": "my-own-model"}
    )
    assert result["data"]["model"] == "my-own-model"


async def test_model_step_is_a_text_field_for_an_empty_list(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker
) -> None:
    aioclient_mock.get(MODELS_URL, json={"object": "list", "data": []})
    result = await _to_connection_step(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"base_url": "http://llm.test/v1"}
    )
    assert result["step_id"] == "openai_model"
    selector = _model_field_selector(result)
    assert type(selector).__name__ == "TextSelector"
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"model": "typed"}
    )
    assert result["data"]["model"] == "typed"


@pytest.mark.parametrize(
    ("mock_kwargs", "error"),
    [
        ({"exc": aiohttp.ClientConnectionError("refused")}, "cannot_connect"),
        ({"exc": OSError("unreachable")}, "cannot_connect"),
        ({"status": 500, "text": "boom"}, "cannot_connect"),
        ({"status": 401, "text": "no"}, "invalid_auth"),
        ({"status": 403, "text": "no"}, "invalid_auth"),
        ({"status": 404, "text": "nope"}, "not_openai_compatible"),
        ({"status": 405, "text": "Method Not Allowed"}, "not_openai_compatible"),
        ({"text": "<html>hello</html>"}, "not_openai_compatible"),
        ({"json": {"models": []}}, "not_openai_compatible"),
        ({"json": {"data": "x"}}, "not_openai_compatible"),
        ({"json": []}, "not_openai_compatible"),
    ],
)
async def test_connection_test_maps_errors(
    hass: HomeAssistant,
    aioclient_mock: AiohttpClientMocker,
    mock_kwargs: dict[str, Any],
    error: str,
) -> None:
    aioclient_mock.get(MODELS_URL, **mock_kwargs)
    result = await _to_connection_step(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"base_url": "http://llm.test/v1", "api_key": "secret"}
    )
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "openai_compatible"
    assert result["errors"] == {"base": error}

    # The form can be corrected and completed.
    aioclient_mock.clear_requests()
    aioclient_mock.get(MODELS_URL, json=MODEL_LIST)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"base_url": "http://llm.test/v1"}
    )
    assert result["step_id"] == "openai_model"


async def test_connection_test_timeout_is_cannot_connect(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker
) -> None:
    async def slow(method: str, url: Any, data: Any) -> Any:
        await asyncio.sleep(5)

    aioclient_mock.get(MODELS_URL, side_effect=slow)
    result = await _to_connection_step(hass)
    with patch.object(drafting, "MODELS_TIMEOUT", 0.05):
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"], {"base_url": "http://llm.test/v1"}
        )
    assert result["errors"] == {"base": "cannot_connect"}


async def test_openai_compatible_rejects_invalid_url(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker
) -> None:
    result = await _to_connection_step(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"base_url": "not a url"}
    )
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"base_url": "invalid_url"}
    assert aioclient_mock.call_count == 0  # nothing was sent


async def test_second_flow_aborts(hass: HomeAssistant) -> None:
    result = await _start(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"next_step_id": "ai_task"}
    )
    await hass.config_entries.flow.async_configure(result["flow_id"], {})

    second = await _start(hass)
    assert second["type"] is FlowResultType.ABORT
    assert second["reason"] == "single_instance_allowed"


async def test_second_flow_aborts_with_an_openai_entry(hass: HomeAssistant) -> None:
    await setup_entry(hass)
    second = await _start(hass)
    assert second["type"] is FlowResultType.ABORT
    assert second["reason"] == "single_instance_allowed"


def test_ai_task_selector_filters_on_generate_data() -> None:
    from custom_components.ai_drafts.config_flow import _ai_task_schema

    selector = next(iter(_ai_task_schema().schema.values()))
    config = selector.config["filter"][0]
    assert config["domain"] == ["ai_task"]
    assert config["supported_features"]


# --- reconfigure ------------------------------------------------------------------


async def _reconfigure(hass: HomeAssistant, entry):
    return await entry.start_reconfigure_flow(hass)


async def test_reconfigure_openai_prefills_and_updates(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker
) -> None:
    entry = await setup_entry(hass)
    aioclient_mock.get("http://other.test/api/models", json=MODEL_LIST)
    result = await _reconfigure(hass, entry)
    assert result["type"] is FlowResultType.MENU
    assert result["step_id"] == "reconfigure"
    assert result["menu_options"] == ["ai_task", "openai_compatible"]
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"next_step_id": "openai_compatible"}
    )
    suggested = {
        str(k): k.description["suggested_value"]
        for k in result["data_schema"].schema
        if k.description
    }
    assert suggested == {"base_url": OPENAI_DATA["base_url"], "api_key": "sk-test-key"}
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"base_url": "http://other.test/api/"}
    )
    assert result["step_id"] == "openai_model"
    key = next(k for k in result["data_schema"].schema if k == "model")
    assert key.description["suggested_value"] == "test-model"
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"model": "qwen3"}
    )
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "reconfigure_successful"
    assert entry.data == {
        "model_source": "openai_compatible",
        "base_url": "http://other.test/api",
        "api_key": None,
        "model": "qwen3",
    }
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.LOADED
    assert len(hass.config_entries.async_entries(DOMAIN)) == 1


async def test_reconfigure_openai_to_ai_task_drops_server_keys(
    hass: HomeAssistant,
) -> None:
    entry = await setup_entry(hass)
    result = await _reconfigure(hass, entry)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"next_step_id": "ai_task"}
    )
    assert result["step_id"] == "ai_task"
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"ai_task_entity": "ai_task.my_model"}
    )
    assert result["reason"] == "reconfigure_successful"
    assert entry.data == {
        "model_source": "ai_task",
        "ai_task_entity": "ai_task.my_model",
    }
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.LOADED


async def test_reconfigure_ai_task_to_openai_drops_entity_key(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker
) -> None:
    entry = await setup_entry(
        hass, {"model_source": "ai_task", "ai_task_entity": "ai_task.old"}
    )
    aioclient_mock.get(MODELS_URL, json=MODEL_LIST)
    result = await _reconfigure(hass, entry)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"next_step_id": "openai_compatible"}
    )
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"base_url": "http://llm.test/v1", "api_key": "k"}
    )
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"model": "llama3.1"}
    )
    assert result["reason"] == "reconfigure_successful"
    assert entry.data == {
        "model_source": "openai_compatible",
        "base_url": "http://llm.test/v1",
        "api_key": "k",
        "model": "llama3.1",
    }
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.LOADED


async def test_reconfigure_keeps_the_entry_on_a_failed_connection_test(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker
) -> None:
    entry = await setup_entry(hass)
    aioclient_mock.get("http://bad.test/v1/models", status=404, text="nope")
    result = await _reconfigure(hass, entry)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"next_step_id": "openai_compatible"}
    )
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"base_url": "http://bad.test/v1"}
    )
    assert result["errors"] == {"base": "not_openai_compatible"}
    assert dict(entry.data) == OPENAI_DATA


async def test_ai_task_step_survives_an_unimportable_ai_task(
    hass: HomeAssistant,
) -> None:
    # Resolving the feature name imports ai_task; if that fails the step must
    # still show a form, with every ai_task entity on offer.
    import importlib
    import sys

    real_import = importlib.import_module

    def failing_import(name: str, *args: object, **kwargs: object) -> object:
        if name.endswith("components.ai_task"):
            raise ModuleNotFoundError("No module named 'hassil'")
        return real_import(name, *args, **kwargs)

    with (
        patch.dict(sys.modules),
        patch("importlib.import_module", side_effect=failing_import),
    ):
        sys.modules.pop("homeassistant.components.ai_task", None)
        result = await hass.config_entries.flow.async_init(
            DOMAIN, context={"source": "user"}
        )
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"], {"next_step_id": "ai_task"}
        )

    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "ai_task"
