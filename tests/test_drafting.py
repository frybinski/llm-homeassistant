"""Tests for prompts, parsing and the two model clients."""

import asyncio
import importlib.util
import json
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch

import aiohttp
import homeassistant
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
import pytest
from pytest_homeassistant_custom_component.test_util.aiohttp import (
    AiohttpClientMocker,
    AiohttpClientMockResponse,
)

from custom_components.ai_drafts import drafting
from custom_components.ai_drafts.changeset import (
    Finding,
    OperationKind,
    OperationType,
    Severity,
)
from custom_components.ai_drafts.context import (
    ContextArea,
    ContextEntity,
    DraftContext,
)
from custom_components.ai_drafts.drafting import (
    USE_DEFAULT,
    AITaskClient,
    CannotConnectError,
    InvalidAuthError,
    InvalidModelError,
    MalformedOutputError,
    ModelError,
    NotOpenAICompatibleError,
    OpenAICompatibleClient,
    async_client_from_entry_data,
    async_list_models,
    build_ai_task_structure,
    build_prompts,
    parse_operations,
)

from .common import FLUR_AUTOMATION, OPENAI_DATA, create_op, operations_json

URL = "http://model.test/v1/chat/completions"


def make_context() -> DraftContext:
    return DraftContext(
        areas=(ContextArea("flur", "Flur"),),
        entities=(
            ContextEntity(
                "light.flurlicht", "Flurlicht", "light", None, "Flur", "off", None
            ),
        ),
        automations=(),
        truncated=False,
        selection="matched",
    )


# --- prompts ---------------------------------------------------------------------


def test_first_prompt_has_rules_request_and_context() -> None:
    system, user = build_prompts("Licht im Flur", make_context())
    assert "JSON" in system
    assert "triggers" in system
    assert "conditions" in system
    assert "actions" in system
    assert "action" in system
    assert "Never invent" in system
    assert "Licht im Flur" in user
    assert '"entity_id":"light.flurlicht"' in user
    assert '"area' in user or '"areas"' in user
    assert "previous" not in user.lower()


def test_repair_prompt_carries_operations_and_findings() -> None:
    previous = [create_op({"alias": "Alt", "triggers": []})]
    findings = [
        Finding(Severity.ERROR, "validity.entity", "Entity 'light.x' does not exist."),
        Finding(Severity.WARNING, "validity.template_render", "renders badly", "p"),
    ]
    _, user = build_prompts("Licht im Flur", make_context(), previous, findings)
    assert "Licht im Flur" in user
    assert '"alias":"Alt"' in user
    assert "Entity 'light.x' does not exist." in user
    assert "validity.entity" in user
    assert '"severity":"warning"' in user
    assert "answer again" in user


def test_german_text_is_not_escaped_in_the_prompt() -> None:
    _, user = build_prompts("Küche größer", make_context())
    assert "Küche größer" in user


# --- parsing ---------------------------------------------------------------------


def test_parse_valid_operations_from_text_and_dict() -> None:
    text = operations_json(FLUR_AUTOMATION)
    [op] = parse_operations(text)
    assert op.kind is OperationKind.AUTOMATION
    assert op.op is OperationType.CREATE
    assert op.after == FLUR_AUTOMATION
    assert op.target_id is None
    assert parse_operations(json.loads(text)) == [op]


def test_parse_strips_code_fences() -> None:
    text = "```json\n" + operations_json(FLUR_AUTOMATION) + "\n```"
    assert len(parse_operations(text)) == 1


def test_parse_accepts_after_as_json_text() -> None:
    data = {
        "operations": [
            {
                "kind": "automation",
                "op": "create",
                "target_id": None,
                "after": json.dumps(FLUR_AUTOMATION),
            }
        ]
    }
    assert parse_operations(data)[0].after == FLUR_AUTOMATION


def test_parse_ignores_a_before_from_the_model() -> None:
    data = json.loads(operations_json(FLUR_AUTOMATION))
    data["operations"][0]["before"] = {"x": 1}
    assert parse_operations(data)[0].before is None


@pytest.mark.parametrize(
    ("data", "message"),
    [
        ("not json at all", "not valid JSON"),
        ("", "not valid JSON"),
        ("[1, 2]", "must be a JSON object"),
        ({"ops": []}, "'operations' list"),
        ({"operations": "x"}, "'operations' list"),
        ({"operations": []}, "empty"),
        ({"operations": ["x"]}, r"operations\[0\] must be an object"),
        ({"operations": [{"kind": "x", "op": "create", "after": {}}]}, "kind"),
        ({"operations": [{"kind": "automation", "op": "zap", "after": {}}]}, "op"),
        ({"operations": [{"kind": "automation", "op": "create"}]}, "after"),
        (
            {"operations": [{"kind": "automation", "op": "create", "after": "{nope"}]},
            "after is not valid JSON",
        ),
        (
            {"operations": [{"kind": "automation", "op": "create", "after": []}]},
            "after",
        ),
    ],
)
def test_parse_rejects_malformed_output(data: Any, message: str) -> None:
    with pytest.raises(MalformedOutputError, match=message):
        parse_operations(data)


def test_parse_error_names_the_operation_index() -> None:
    data = json.loads(operations_json(FLUR_AUTOMATION, FLUR_AUTOMATION))
    del data["operations"][1]["after"]
    with pytest.raises(MalformedOutputError, match=r"operations\[1\]"):
        parse_operations(data)


# --- OpenAI-compatible client ----------------------------------------------------


def completion(content: Any) -> dict[str, Any]:
    return {"choices": [{"message": {"role": "assistant", "content": content}}]}


async def test_openai_request_shape(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker
) -> None:
    aioclient_mock.post(URL, json=completion('{"operations": []}'))
    client = OpenAICompatibleClient(hass, "http://model.test/v1/", "m1", "sk-abc")
    assert client.name == "m1"
    result = await client.async_generate("SYSTEM", "USER")
    assert result == '{"operations": []}'

    assert aioclient_mock.call_count == 1
    method, url, body, headers = aioclient_mock.mock_calls[0]
    assert method.lower() == "post"
    assert str(url) == URL
    assert headers["Authorization"] == "Bearer sk-abc"
    assert body["model"] == "m1"
    assert body["temperature"] == 0
    assert body["messages"] == [
        {"role": "system", "content": "SYSTEM"},
        {"role": "user", "content": "USER"},
    ]
    response_format = body["response_format"]
    assert response_format["type"] == "json_schema"
    assert response_format["json_schema"]["strict"] is False
    schema = response_format["json_schema"]["schema"]
    assert schema["properties"]["operations"]["type"] == "array"
    assert "stream" not in body


async def test_openai_without_api_key_sends_no_authorization(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker
) -> None:
    aioclient_mock.post(URL, json=completion("{}"))
    await OpenAICompatibleClient(hass, "http://model.test/v1", "m1").async_generate(
        "s", "u"
    )
    assert "Authorization" not in aioclient_mock.mock_calls[0][3]


async def test_openai_retries_once_with_json_object_on_400(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker
) -> None:
    async def side_effect(method: str, url: Any, data: Any) -> Any:
        if data["response_format"]["type"] == "json_schema":
            return AiohttpClientMockResponse(method, url, status=400, text="bad")
        return AiohttpClientMockResponse(method, url, json=completion("{}"))

    aioclient_mock.post(URL, side_effect=side_effect)
    client = OpenAICompatibleClient(hass, "http://model.test/v1", "m1")
    assert await client.async_generate("s", "u") == "{}"
    formats = [call[2]["response_format"] for call in aioclient_mock.mock_calls]
    assert [f["type"] for f in formats] == ["json_schema", "json_object"]
    assert formats[1] == {"type": "json_object"}


async def test_openai_second_400_is_a_model_error(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker
) -> None:
    aioclient_mock.post(URL, status=400, text="still bad")
    client = OpenAICompatibleClient(hass, "http://model.test/v1", "m1")
    with pytest.raises(ModelError, match="HTTP 400"):
        await client.async_generate("s", "u")
    assert aioclient_mock.call_count == 2  # exactly one retry


@pytest.mark.parametrize("status", [401, 404, 500, 503])
async def test_openai_non_2xx_is_a_model_error(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker, status: int
) -> None:
    aioclient_mock.post(URL, status=status, text="nope")
    client = OpenAICompatibleClient(hass, "http://model.test/v1", "m1", "sk-secret")
    with pytest.raises(ModelError, match=f"HTTP {status}") as err:
        await client.async_generate("s", "u")
    assert "sk-secret" not in str(err.value)
    assert aioclient_mock.call_count == 1  # only a 400 is retried


@pytest.mark.parametrize("status", [404, 405])
async def test_openai_404_405_name_the_url_and_hint(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker, status: int
) -> None:
    aioclient_mock.post(
        "http://owui.test/ollama/chat/completions",
        status=status,
        text='{"detail":"Method Not Allowed"}',
    )
    client = OpenAICompatibleClient(hass, "http://owui.test/ollama", "m1", "sk-secret")
    with pytest.raises(ModelError) as err:
        await client.async_generate("s", "u")
    message = str(err.value)
    assert f"HTTP {status}" in message
    assert "http://owui.test/ollama/chat/completions" in message
    assert "/v1" in message
    assert "followed by /api" in message
    assert "sk-secret" not in message


@pytest.mark.parametrize("status", [401, 403])
async def test_openai_401_403_say_the_key_was_rejected(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker, status: int
) -> None:
    aioclient_mock.post(URL, status=status, text="sk-secret is wrong")
    client = OpenAICompatibleClient(hass, "http://model.test/v1", "m1", "sk-secret")
    with pytest.raises(ModelError) as err:
        await client.async_generate("s", "u")
    message = str(err.value)
    assert "rejected the API key" in message
    assert f"HTTP {status}" in message
    assert "sk-secret" not in message
    assert aioclient_mock.call_count == 1


# --- async_list_models ------------------------------------------------------------

MODELS_URL = "http://model.test/v1/models"


async def test_list_models_returns_ids_and_sends_the_key(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker
) -> None:
    aioclient_mock.get(
        MODELS_URL,
        json={"data": [{"id": "a"}, {"id": "b"}, {"id": "a"}, {"nope": 1}, "x"]},
    )
    models = await async_list_models(hass, "http://model.test/v1/", "sk-abc")
    assert models == ["a", "b"]
    assert aioclient_mock.mock_calls[0][3]["Authorization"] == "Bearer sk-abc"


async def test_list_models_without_key_sends_no_authorization(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker
) -> None:
    aioclient_mock.get(MODELS_URL, json={"data": []})
    assert await async_list_models(hass, "http://model.test/v1") == []
    assert "Authorization" not in aioclient_mock.mock_calls[0][3]


@pytest.mark.parametrize(
    ("mock_kwargs", "error"),
    [
        ({"exc": aiohttp.ClientConnectionError("refused")}, CannotConnectError),
        ({"exc": OSError("unreachable")}, CannotConnectError),
        ({"status": 500, "text": "boom"}, CannotConnectError),
        ({"status": 401}, InvalidAuthError),
        ({"status": 403}, InvalidAuthError),
        ({"status": 404}, NotOpenAICompatibleError),
        ({"status": 405}, NotOpenAICompatibleError),
        ({"text": "not json"}, NotOpenAICompatibleError),
        ({"json": {"object": "list"}}, NotOpenAICompatibleError),
        ({"json": {"data": {}}}, NotOpenAICompatibleError),
        ({"json": {"models": "x"}}, NotOpenAICompatibleError),
        ({"json": "x"}, NotOpenAICompatibleError),
        ({"json": 3}, NotOpenAICompatibleError),
    ],
)
async def test_list_models_errors_never_contain_the_key(
    hass: HomeAssistant,
    aioclient_mock: AiohttpClientMocker,
    mock_kwargs: dict[str, Any],
    error: type[Exception],
) -> None:
    aioclient_mock.get(MODELS_URL, **mock_kwargs)
    with pytest.raises(error) as err:
        await async_list_models(hass, "http://model.test/v1", "sk-secret")
    assert "sk-secret" not in str(err.value)


async def test_list_models_timeout_is_cannot_connect(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker
) -> None:
    async def slow(method: str, url: Any, data: Any) -> Any:
        await asyncio.sleep(5)

    aioclient_mock.get(MODELS_URL, side_effect=slow)
    with (
        patch.object(drafting, "MODELS_TIMEOUT", 0.05),
        pytest.raises(CannotConnectError, match="within"),
    ):
        await async_list_models(hass, "http://model.test/v1")


@pytest.mark.parametrize(
    ("answer", "expected"),
    [
        ({"data": [{"id": "a"}, {"id": "b"}]}, ["a", "b"]),
        ({"models": [{"id": "a"}, {"id": "b"}]}, ["a", "b"]),
        ([{"id": "a"}, {"id": "b"}], ["a", "b"]),
        ([], []),
        ({"models": []}, []),
        # The id is taken from id, else model, else name.
        ({"models": [{"model": "m", "name": "n"}]}, ["m"]),
        ({"models": [{"name": "n"}]}, ["n"]),
        ({"data": [{"id": "i", "model": "m", "name": "n"}]}, ["i"]),
        ({"data": [{"id": "", "name": "n"}, {"id": 5, "model": "m"}]}, ["n", "m"]),
        # "data" wins over "models" when both are lists; junk entries are skipped.
        ({"data": [{"id": "a"}], "models": [{"id": "b"}]}, ["a"]),
        ([{"id": "a"}, 1, "x", {"other": 1}, {"id": "a"}], ["a"]),
    ],
)
async def test_list_models_accepts_the_common_shapes(
    hass: HomeAssistant,
    aioclient_mock: AiohttpClientMocker,
    answer: Any,
    expected: list[str],
) -> None:
    aioclient_mock.get(MODELS_URL, json=answer)
    assert await async_list_models(hass, "http://model.test/v1") == expected


def test_models_timeout_is_15_seconds() -> None:
    assert drafting.MODELS_TIMEOUT == 15


@pytest.mark.parametrize(
    "exc", [aiohttp.ClientConnectionError("refused"), OSError("unreachable")]
)
async def test_openai_network_error_is_a_model_error(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker, exc: Exception
) -> None:
    aioclient_mock.post(URL, exc=exc)
    client = OpenAICompatibleClient(hass, "http://model.test/v1", "m1")
    with pytest.raises(ModelError, match="could not reach"):
        await client.async_generate("s", "u")


async def test_openai_timeout_is_a_model_error(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker
) -> None:
    async def slow(method: str, url: Any, data: Any) -> Any:
        await asyncio.sleep(5)
        return AiohttpClientMockResponse(method, url, json=completion("{}"))

    aioclient_mock.post(URL, side_effect=slow)
    client = OpenAICompatibleClient(hass, "http://model.test/v1", "m1")
    with (
        patch.object(drafting, "REQUEST_TIMEOUT", 0.05),
        pytest.raises(ModelError, match="did not answer"),
    ):
        await client.async_generate("s", "u")


def test_request_timeout_is_120_seconds() -> None:
    assert drafting.REQUEST_TIMEOUT == 120


@pytest.mark.parametrize(
    "body",
    [
        "this is not json",
        "[]",
        "{}",
        json.dumps({"choices": []}),
        json.dumps({"choices": [{"message": {}}]}),
        json.dumps({"choices": [{"message": {"content": None}}]}),
        json.dumps({"choices": [{"message": {"content": 5}}]}),
    ],
)
async def test_openai_unusable_body_is_a_model_error(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker, body: str
) -> None:
    aioclient_mock.post(URL, text=body)
    client = OpenAICompatibleClient(hass, "http://model.test/v1", "m1")
    with pytest.raises(ModelError):
        await client.async_generate("s", "u")


# --- AI Task client --------------------------------------------------------------


async def test_ai_task_client_calls_generate_data(hass: HomeAssistant) -> None:
    hass.config.components.add("ai_task")  # as if loaded; the call is patched
    result = AsyncMock()
    result.data = {"operations": []}
    with patch(
        "homeassistant.components.ai_task.async_generate_data", return_value=result
    ) as generate:
        client = AITaskClient(hass, "ai_task.my_model")
        assert client.name == "ai_task.my_model"
        assert await client.async_generate("SYSTEM", "USER") == {"operations": []}

    generate.assert_awaited_once()
    kwargs = generate.await_args.kwargs
    assert kwargs["entity_id"] == "ai_task.my_model"
    assert kwargs["task_name"]
    assert kwargs["instructions"] == "SYSTEM\n\nUSER"
    assert kwargs["structure"] is not None


async def test_ai_task_client_without_entity_uses_the_preferred_one(
    hass: HomeAssistant,
) -> None:
    hass.config.components.add("ai_task")  # as if loaded; the call is patched
    result = AsyncMock()
    result.data = {}
    with patch(
        "homeassistant.components.ai_task.async_generate_data", return_value=result
    ) as generate:
        client = AITaskClient(hass, None)
        await client.async_generate("s", "u")
    assert generate.await_args.kwargs["entity_id"] is None


async def test_ai_task_failure_is_a_model_error(hass: HomeAssistant) -> None:
    hass.config.components.add("ai_task")  # as if loaded; the call is patched
    with (
        patch(
            "homeassistant.components.ai_task.async_generate_data",
            side_effect=HomeAssistantError("entity gone"),
        ),
        pytest.raises(ModelError, match="entity gone"),
    ):
        await AITaskClient(hass, "ai_task.x").async_generate("s", "u")


async def test_ai_task_not_loaded_is_a_model_error(hass: HomeAssistant) -> None:
    with pytest.raises(ModelError, match="not loaded"):
        await AITaskClient(hass, "ai_task.x").async_generate("s", "u")


async def test_a_free_form_object_would_be_refused_by_openai_strict_mode() -> None:
    """Why ``after`` is text in the AI Task structure."""
    from homeassistant.helpers import llm, selector
    import probatio

    adjust_schema = _load_openai_schema_module().adjust_schema
    free_form = probatio.Schema(
        {
            probatio.Required("operations"): selector.ObjectSelector(
                {
                    "multiple": True,
                    "fields": {"after": {"required": True, "selector": {"object": {}}}},
                }
            )
        }
    )
    schema = probatio.to_openapi(
        free_form, custom_serializer=llm.selector_serializer, openapi_version="3.1.0"
    )
    with pytest.raises(HomeAssistantError, match="explicitly defined object fields"):
        adjust_schema(schema)


async def test_ai_task_structure_is_a_selector_schema(hass: HomeAssistant) -> None:
    from homeassistant.helpers import llm
    import probatio

    structure = build_ai_task_structure()
    schema = probatio.to_openapi(
        structure, custom_serializer=llm.selector_serializer, openapi_version="3.1.0"
    )
    operations = schema["properties"]["operations"]
    assert operations["type"] == "array"
    item = operations["items"]
    assert set(item["properties"]) == {"kind", "op", "target_id", "after"}
    assert item["properties"]["kind"]["enum"] == ["automation"]
    assert item["properties"]["op"]["enum"] == ["create"]
    assert item["properties"]["after"]["type"] == "string"
    assert set(item["required"]) == {"kind", "op", "after"}
    assert schema["required"] == ["operations"]


def _load_openai_schema_module() -> Any:
    """Load Home Assistant's strict-mode adjuster by path.

    The openai_conversation package itself needs the ``openai`` library, which is
    not installed here; its schema module does not.
    """
    path = (
        Path(homeassistant.__file__).parent / "components/openai_conversation/schema.py"
    )
    spec = importlib.util.spec_from_file_location("ha_openai_schema", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


async def test_ai_task_structure_is_accepted_by_openai_strict_mode() -> None:
    from homeassistant.helpers import llm
    import probatio

    adjust_schema = _load_openai_schema_module().adjust_schema

    schema = probatio.to_openapi(
        build_ai_task_structure(),
        custom_serializer=llm.selector_serializer,
        openapi_version="3.1.0",
    )
    adjust_schema(schema)  # raises for free-form objects
    assert schema["additionalProperties"] is False


# --- choice of client ------------------------------------------------------------


async def test_client_chosen_from_entry_data(hass: HomeAssistant) -> None:
    client = async_client_from_entry_data(hass, OPENAI_DATA)
    assert isinstance(client, OpenAICompatibleClient)
    assert client.name == "test-model"
    ai_task = async_client_from_entry_data(
        hass, {"model_source": "ai_task", "ai_task_entity": None}
    )
    assert isinstance(ai_task, AITaskClient)
    with pytest.raises(ModelError, match="unknown model source"):
        async_client_from_entry_data(hass, {"model_source": "carrier pigeon"})


async def test_client_model_override_for_the_server_source(
    hass: HomeAssistant,
) -> None:
    client = async_client_from_entry_data(hass, OPENAI_DATA, "other-model")
    assert isinstance(client, OpenAICompatibleClient)
    assert client.name == "other-model"
    assert async_client_from_entry_data(hass, OPENAI_DATA).name == "test-model"
    for bad in (None, ""):
        with pytest.raises(InvalidModelError):
            async_client_from_entry_data(hass, OPENAI_DATA, bad)


@pytest.mark.parametrize(
    ("data", "model", "name"),
    [
        ({"ai_task_entity": "ai_task.a"}, USE_DEFAULT, "ai_task.a"),
        ({"ai_task_entity": "ai_task.a"}, "ai_task.b", "ai_task.b"),
        ({"ai_task_entity": None}, "ai_task.b", "ai_task.b"),
        # None is a choice: the preferred entity, whatever the entry holds.
        ({"ai_task_entity": "ai_task.a"}, None, "ai_task (preferred entity)"),
    ],
)
async def test_client_model_override_for_the_ai_task_source(
    hass: HomeAssistant, data: dict[str, Any], model: Any, name: str
) -> None:
    client = async_client_from_entry_data(
        hass, {"model_source": "ai_task", **data}, model
    )
    assert isinstance(client, AITaskClient)
    assert client.name == name


@pytest.mark.parametrize(
    "bad", ["light.kitchen", "ai_task", "ai_task.", "ai_task.Bad Name", "gpt-4o"]
)
async def test_client_rejects_a_model_that_is_no_ai_task_entity(
    hass: HomeAssistant, bad: str
) -> None:
    with pytest.raises(InvalidModelError, match="not an AI Task entity id"):
        async_client_from_entry_data(hass, {"model_source": "ai_task"}, bad)
