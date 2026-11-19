"""Tests for the WebSocket commands of M1."""

import asyncio
import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

import aiohttp
from homeassistant.components import ai_task
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
import pytest
from pytest_homeassistant_custom_component.test_util.aiohttp import (
    AiohttpClientMocker,
)
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.ai_drafts.changeset import ChangeSetStatus
from custom_components.ai_drafts.const import DOMAIN
from custom_components.ai_drafts.data import AIDraftsData
from custom_components.ai_drafts.drafting import USE_DEFAULT, ModelError

from .common import (
    OPENAI_DATA,
    ScriptedClient,
    build_house,
    flur_automation,
    make_change_set,
    operations_json,
    setup_entry,
)
from .test_apply import checked, read_file, start

MODELS_URL = "http://model.test/v1/models"
AI_TASK_DATA = {"model_source": "ai_task", "ai_task_entity": "ai_task.cloud"}
PIPELINE_CLIENT = "custom_components.ai_drafts.pipeline.async_client_from_entry_data"
REQUEST = "Schalte das Flurlicht bei Bewegung nach Sonnenuntergang für 3 Minuten ein"
API_KEY = OPENAI_DATA["api_key"]

NEW_COMMANDS = [
    ("ai_drafts/models", {}),
    ("ai_drafts/draft", {"request": "x"}),
    ("ai_drafts/changesets/get", {"change_set_id": "cs_x"}),
    ("ai_drafts/changesets/apply", {"change_set_id": "cs_x"}),
    ("ai_drafts/changesets/discard", {"change_set_id": "cs_x"}),
    ("ai_drafts/changesets/revert", {"change_set_id": "cs_x"}),
    ("ai_drafts/journal/list", {}),
]


async def call(client: Any, command: str, **payload: Any) -> dict[str, Any]:
    await client.send_json_auto_id({"type": command, **payload})
    return await client.receive_json()


@pytest.fixture
async def data(hass: HomeAssistant, config_dir: Path) -> AIDraftsData:
    return await start(hass, config_dir)


# --- access ---------------------------------------------------------------------


@pytest.mark.parametrize(("command", "payload"), NEW_COMMANDS)
async def test_commands_are_admin_only(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
    command: str,
    payload: dict[str, Any],
) -> None:
    await setup_entry(hass, OPENAI_DATA)
    client = await hass_ws_client(hass, hass_read_only_access_token)
    response = await call(client, command, **payload)
    assert not response["success"]
    assert response["error"]["code"] == "unauthorized"


@pytest.mark.parametrize(("command", "payload"), NEW_COMMANDS)
async def test_commands_error_when_entry_not_loaded(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    command: str,
    payload: dict[str, Any],
) -> None:
    assert await async_setup_component(hass, DOMAIN, {})
    client = await hass_ws_client(hass)
    response = await call(client, command, **payload)
    assert not response["success"]
    assert response["error"]["code"] == "not_loaded"


async def test_non_admin_cannot_write_even_with_a_valid_change_set(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
    data: AIDraftsData,
    config_dir: Path,
) -> None:
    change_set = await checked(data)
    client = await hass_ws_client(hass, hass_read_only_access_token)
    response = await call(
        client, "ai_drafts/changesets/apply", change_set_id=change_set.id
    )
    assert response["error"]["code"] == "unauthorized"
    assert change_set.status is ChangeSetStatus.CHECKED
    assert read_file(config_dir) is None or read_file(config_dir) == []


async def test_no_home_assistant_services_are_registered(
    hass: HomeAssistant, data: AIDraftsData
) -> None:
    """Writing must be impossible without the admin WebSocket call."""
    assert DOMAIN not in hass.services.async_services()
    assert not [
        s
        for services in hass.services.async_services().values()
        for s in services
        if "draft" in s or "apply" in s
    ]


# --- models ---------------------------------------------------------------------


async def test_models_of_the_server_source(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    aioclient_mock: AiohttpClientMocker,
    data: AIDraftsData,
) -> None:
    aioclient_mock.get(MODELS_URL, json={"data": [{"id": "a"}, {"id": "test-model"}]})
    client = await hass_ws_client(hass)
    response = await call(client, "ai_drafts/models")
    assert response["success"], response
    assert response["result"] == {
        "model_source": "openai_compatible",
        "default": "test-model",
        "models": [
            {"id": "a", "label": "a"},
            {"id": "test-model", "label": "test-model"},
        ],
        "error": None,
    }
    assert aioclient_mock.mock_calls[0][3]["Authorization"] == f"Bearer {API_KEY}"
    assert API_KEY not in json.dumps(response)


async def test_models_keeps_the_configured_model_when_the_server_does_not_list_it(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    aioclient_mock: AiohttpClientMocker,
    data: AIDraftsData,
) -> None:
    aioclient_mock.get(MODELS_URL, json={"data": [{"id": "a"}]})
    client = await hass_ws_client(hass)
    result = (await call(client, "ai_drafts/models"))["result"]
    assert [m["id"] for m in result["models"]] == ["test-model", "a"]
    assert result["default"] == "test-model"
    assert result["error"] is None


@pytest.mark.parametrize(
    ("mock_kwargs", "reason"),
    [
        ({"exc": aiohttp.ClientConnectionError("refused")}, "could not reach"),
        ({"status": 500, "text": "boom"}, "HTTP 500"),
        ({"status": 401}, "HTTP 401"),
        ({"status": 404}, "HTTP 404"),
        ({"text": "<html></html>"}, "did not answer with a model list"),
    ],
)
async def test_models_answers_with_the_configured_model_when_the_server_is_down(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    aioclient_mock: AiohttpClientMocker,
    data: AIDraftsData,
    mock_kwargs: dict[str, Any],
    reason: str,
) -> None:
    aioclient_mock.get(MODELS_URL, **mock_kwargs)
    client = await hass_ws_client(hass)
    response = await call(client, "ai_drafts/models")
    assert response["success"], response
    result = response["result"]
    assert result["models"] == [{"id": "test-model", "label": "test-model"}]
    assert result["default"] == "test-model"
    assert reason in result["error"]
    assert API_KEY not in json.dumps(response)


class GenerateDataEntity(ai_task.AITaskEntity):
    """An AI Task entity that can generate data."""

    _attr_supported_features = ai_task.AITaskEntityFeature.GENERATE_DATA

    def __init__(self, object_id: str, name: str, features: Any = None) -> None:
        self.entity_id = f"ai_task.{object_id}"
        self._attr_unique_id = object_id
        self._attr_name = name
        if features is not None:
            self._attr_supported_features = features


async def _add_ai_task_entities(hass: HomeAssistant) -> None:
    """Make three AI Task entities visible, without setting up ai_task itself.

    Setting up the real integration pulls in conversation and more; the command
    only reads the component's entity list and the states.
    """
    entities = [
        GenerateDataEntity("local", "Local model"),
        GenerateDataEntity("cloud", "Cloud model"),
        GenerateDataEntity(
            "pictures", "Only pictures", ai_task.AITaskEntityFeature.GENERATE_IMAGE
        ),
    ]
    for entity in entities:
        hass.states.async_set(
            entity.entity_id, "unknown", {"friendly_name": entity.name}
        )
    hass.config.components.add("ai_task")
    hass.data[ai_task.DATA_COMPONENT] = SimpleNamespace(entities=entities)


async def test_models_of_the_ai_task_source(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    await _add_ai_task_entities(hass)
    await setup_entry(hass, AI_TASK_DATA)
    client = await hass_ws_client(hass)
    response = await call(client, "ai_drafts/models")
    assert response["success"], response
    result = response["result"]
    assert result["model_source"] == "ai_task"
    assert result["default"] == "ai_task.cloud"
    assert result["error"] is None
    # The preferred entity first, then the entities that can generate data
    # (not the one that only makes pictures), by friendly name.
    assert [(m["id"], m["label"]) for m in result["models"]] == [
        (None, "ai_task (preferred entity)"),
        ("ai_task.cloud", "Cloud model"),
        ("ai_task.local", "Local model"),
    ]


async def test_models_of_the_ai_task_source_with_the_preferred_entity(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    await _add_ai_task_entities(hass)
    await setup_entry(hass, {"model_source": "ai_task", "ai_task_entity": None})
    client = await hass_ws_client(hass)
    result = (await call(client, "ai_drafts/models"))["result"]
    assert result["default"] is None
    assert [m["id"] for m in result["models"]] == [
        None,
        "ai_task.cloud",
        "ai_task.local",
    ]


async def test_models_of_the_ai_task_source_without_ai_task_loaded(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    await setup_entry(hass, AI_TASK_DATA)
    client = await hass_ws_client(hass)
    response = await call(client, "ai_drafts/models")
    assert response["success"], response
    result = response["result"]
    assert "not loaded" in result["error"]
    assert [m["id"] for m in result["models"]] == [None, "ai_task.cloud"]
    assert result["default"] == "ai_task.cloud"


# --- draft ----------------------------------------------------------------------


async def test_draft_returns_the_checked_change_set(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, data: AIDraftsData
) -> None:
    client = await hass_ws_client(hass)
    scripted = ScriptedClient(operations_json(flur_automation()))
    with patch(PIPELINE_CLIENT, return_value=scripted):
        response = await call(client, "ai_drafts/draft", request=REQUEST)
    assert response["success"], response
    result = response["result"]
    assert result["status"] == "checked"
    assert result["request"] == REQUEST
    assert result["rounds"] == 0
    assert result["operations"][0]["after"]["alias"] == "Flurlicht bei Bewegung"
    assert data.changesets.get(result["id"]) is not None
    assert API_KEY not in json.dumps(response)


async def test_draft_without_model_uses_the_configured_one(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, data: AIDraftsData
) -> None:
    client = await hass_ws_client(hass)
    with patch(
        PIPELINE_CLIENT, return_value=ScriptedClient(operations_json(flur_automation()))
    ) as factory:
        response = await call(client, "ai_drafts/draft", request=REQUEST)
    assert response["success"], response
    assert factory.call_args.args[2] is USE_DEFAULT


async def test_draft_with_model_uses_it(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    aioclient_mock: AiohttpClientMocker,
    data: AIDraftsData,
) -> None:
    """Through the real client: the server is asked for the model that was chosen."""
    aioclient_mock.post(
        "http://model.test/v1/chat/completions",
        json={
            "choices": [{"message": {"content": operations_json(flur_automation())}}]
        },
    )
    client = await hass_ws_client(hass)
    response = await call(client, "ai_drafts/draft", request=REQUEST, model="fake-2")
    assert response["success"], response
    assert response["result"]["model"] == "fake-2"
    assert aioclient_mock.mock_calls[0][2]["model"] == "fake-2"
    assert data.changesets.get(response["result"]["id"]).model == "fake-2"
    created = [
        e
        for e in data.journal.list(response["result"]["id"])
        if e["event"] == "created"
    ]
    assert created[0]["data"]["model"] == "fake-2"

    # Without it, the next draft uses the configured model again.
    response = await call(client, "ai_drafts/draft", request=REQUEST)
    assert response["result"]["model"] == "test-model"
    assert aioclient_mock.mock_calls[1][2]["model"] == "test-model"


async def test_draft_with_model_for_the_ai_task_source(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    await build_house(hass)
    await setup_entry(hass, AI_TASK_DATA)
    client = await hass_ws_client(hass)
    seen: list[str | None] = []

    async def generate(self: Any, system: str, user: str) -> Any:
        seen.append(self._entity_id)
        return operations_json(flur_automation())

    with patch(
        "custom_components.ai_drafts.drafting.AITaskClient.async_generate", generate
    ):
        explicit = await call(
            client, "ai_drafts/draft", request=REQUEST, model="ai_task.local"
        )
        preferred = await call(client, "ai_drafts/draft", request=REQUEST, model=None)
        default = await call(client, "ai_drafts/draft", request=REQUEST)
    assert seen == ["ai_task.local", None, "ai_task.cloud"]
    assert explicit["result"]["model"] == "ai_task.local"
    assert preferred["result"]["model"] == "ai_task (preferred entity)"
    assert default["result"]["model"] == "ai_task.cloud"


@pytest.mark.parametrize("bad", ["gpt-4o", "light.kitchen", "ai_task.", "ai_task.A B"])
async def test_draft_rejects_a_model_that_is_no_ai_task_entity(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, bad: str
) -> None:
    entry = await setup_entry(hass, AI_TASK_DATA)
    client = await hass_ws_client(hass)
    response = await call(client, "ai_drafts/draft", request=REQUEST, model=bad)
    assert not response["success"]
    assert response["error"]["code"] == "invalid_model"
    assert "not an AI Task entity id" in response["error"]["message"]
    assert entry.runtime_data.changesets.list() == []


async def test_draft_rejects_no_model_name_for_the_server_source(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, data: AIDraftsData
) -> None:
    client = await hass_ws_client(hass)
    null = await call(client, "ai_drafts/draft", request=REQUEST, model=None)
    assert null["error"]["code"] == "invalid_model"
    blank = await call(client, "ai_drafts/draft", request=REQUEST, model="  ")
    assert blank["error"]["code"] == "invalid_format"
    assert data.changesets.list() == []


async def test_draft_repairs_and_reports_the_rounds(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, data: AIDraftsData
) -> None:
    bad = flur_automation()
    bad["actions"][0]["target"]["entity_id"] = "light.gartenlicht"
    client = await hass_ws_client(hass)
    scripted = ScriptedClient(operations_json(bad), operations_json(flur_automation()))
    with patch(PIPELINE_CLIENT, return_value=scripted):
        response = await call(client, "ai_drafts/draft", request=REQUEST)
    assert response["result"]["status"] == "checked"
    assert response["result"]["rounds"] == 1


async def test_draft_that_cannot_be_repaired_is_returned_as_failed(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, data: AIDraftsData
) -> None:
    bad = flur_automation()
    bad["actions"][0]["target"]["entity_id"] = "light.gartenlicht"
    client = await hass_ws_client(hass)
    with patch(PIPELINE_CLIENT, return_value=ScriptedClient(operations_json(bad))):
        response = await call(client, "ai_drafts/draft", request=REQUEST)
    assert response["success"]
    assert response["result"]["status"] == "failed"
    assert response["result"]["rounds"] == 3


async def test_draft_model_error_has_its_own_code(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, data: AIDraftsData
) -> None:
    client = await hass_ws_client(hass)
    scripted = ScriptedClient(ModelError("could not reach the model server: refused"))
    with patch(PIPELINE_CLIENT, return_value=scripted):
        response = await call(client, "ai_drafts/draft", request=REQUEST)
    assert not response["success"]
    assert response["error"]["code"] == "model_error"
    assert "refused" in response["error"]["message"]
    [failed] = data.changesets.list()
    assert failed.status is ChangeSetStatus.FAILED
    assert failed.id in response["error"]["message"]


async def test_draft_busy_has_its_own_code(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, data: AIDraftsData
) -> None:
    release = asyncio.Event()

    class Blocking(ScriptedClient):
        async def async_generate(self, system: str, user: str) -> Any:
            await release.wait()
            return await super().async_generate(system, user)

    client = await hass_ws_client(hass)
    blocking = Blocking(operations_json(flur_automation()))
    with patch(PIPELINE_CLIENT, return_value=blocking):
        await client.send_json_auto_id({"type": "ai_drafts/draft", "request": "one"})
        await asyncio.sleep(0.05)
        busy = await call(client, "ai_drafts/draft", request="two")
        release.set()
        first = await client.receive_json()
    assert not busy["success"]
    assert busy["error"]["code"] == "busy"
    assert first["success"]
    assert first["result"]["status"] == "checked"
    assert len(data.changesets.list()) == 1


@pytest.mark.parametrize("request_text", ["", "   ", "x" * 4001])
async def test_draft_rejects_an_empty_or_huge_request(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    data: AIDraftsData,
    request_text: str,
) -> None:
    client = await hass_ws_client(hass)
    response = await call(client, "ai_drafts/draft", request=request_text)
    assert not response["success"]
    assert response["error"]["code"] == "invalid_format"
    assert data.changesets.list() == []


# --- get / list / journal --------------------------------------------------------


async def test_get_returns_one_change_set(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, data: AIDraftsData
) -> None:
    change_set = await checked(data)
    client = await hass_ws_client(hass)
    response = await call(
        client, "ai_drafts/changesets/get", change_set_id=change_set.id
    )
    assert response["success"]
    assert response["result"] == change_set.to_dict()


async def test_get_unknown_change_set(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, data: AIDraftsData
) -> None:
    client = await hass_ws_client(hass)
    response = await call(client, "ai_drafts/changesets/get", change_set_id="cs_nope")
    assert response["error"]["code"] == "not_found"
    assert "cs_nope" in response["error"]["message"]


async def test_journal_list_all_and_by_change_set(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, data: AIDraftsData
) -> None:
    client = await hass_ws_client(hass)
    with patch(
        PIPELINE_CLIENT, return_value=ScriptedClient(operations_json(flur_automation()))
    ):
        first = (await call(client, "ai_drafts/draft", request=REQUEST))["result"]
        second = (await call(client, "ai_drafts/draft", request="Flurlicht"))["result"]
    everything = await call(client, "ai_drafts/journal/list")
    assert everything["success"]
    assert {e["change_set_id"] for e in everything["result"]} == {
        first["id"],
        second["id"],
    }
    mine = await call(client, "ai_drafts/journal/list", change_set_id=first["id"])
    assert [e["event"] for e in mine["result"]] == ["created", "draft_round", "check"]
    assert set(mine["result"][0]) == {"ts", "change_set_id", "event", "data"}
    assert API_KEY not in json.dumps(everything)
    empty = await call(client, "ai_drafts/journal/list", change_set_id="cs_none")
    assert empty["result"] == []


# --- apply / discard / revert ----------------------------------------------------


async def test_apply_writes_and_revert_takes_it_out(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    data: AIDraftsData,
    config_dir: Path,
) -> None:
    change_set = await checked(data)
    client = await hass_ws_client(hass)

    applied = await call(
        client,
        "ai_drafts/changesets/apply",
        change_set_id=change_set.id,
        decided_in="yaml",
        views_opened=["domain", "yaml"],
    )
    assert applied["success"], applied
    assert applied["result"]["status"] == "applied"
    assert applied["result"]["decided"] is not None
    automation_id = applied["result"]["operations"][0]["target_id"]
    assert read_file(config_dir)[0]["id"] == automation_id
    assert hass.states.get("automation.flurlicht_bei_bewegung") is not None

    journal = await call(client, "ai_drafts/journal/list", change_set_id=change_set.id)
    [entry] = [e for e in journal["result"] if e["event"] == "applied"]
    assert entry["data"]["decided_in"] == "yaml"
    assert entry["data"]["views_opened"] == ["domain", "yaml"]

    reverted = await call(
        client, "ai_drafts/changesets/revert", change_set_id=change_set.id
    )
    assert reverted["success"], reverted
    assert reverted["result"]["status"] == "reverted"
    await hass.async_block_till_done()
    assert read_file(config_dir) == []
    assert hass.states.get("automation.flurlicht_bei_bewegung") is None


async def test_apply_without_decision_fields(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    data: AIDraftsData,
) -> None:
    change_set = await checked(data)
    client = await hass_ws_client(hass)
    response = await call(
        client, "ai_drafts/changesets/apply", change_set_id=change_set.id
    )
    assert response["success"]
    [entry] = [e for e in data.journal.list(change_set.id) if e["event"] == "applied"]
    assert entry["data"]["decided_in"] is None
    assert entry["data"]["views_opened"] == []


async def test_apply_error_codes(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    data: AIDraftsData,
    config_dir: Path,
) -> None:
    client = await hass_ws_client(hass)

    unknown = await call(client, "ai_drafts/changesets/apply", change_set_id="cs_x")
    assert unknown["error"]["code"] == "not_found"

    draft = make_change_set()
    await data.changesets.async_add(draft)
    wrong = await call(client, "ai_drafts/changesets/apply", change_set_id=draft.id)
    assert wrong["error"]["code"] == "wrong_state"

    # Checked, but the house no longer has the light: blocked by the re-check.
    change_set = await checked(data)
    hass.states.async_remove("light.flurlicht")
    from homeassistant.helpers import entity_registry as er

    er.async_get(hass).async_remove("light.flurlicht")
    blocked = await call(
        client, "ai_drafts/changesets/apply", change_set_id=change_set.id
    )
    assert blocked["error"]["code"] == "apply_blocked"
    assert "light.flurlicht" in blocked["error"]["message"]
    assert change_set.status is ChangeSetStatus.CHECKED
    assert read_file(config_dir) is None


async def test_apply_failure_has_its_own_code(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    data: AIDraftsData,
    config_dir: Path,
) -> None:
    (config_dir / "configuration.yaml").write_text("homeassistant:\n", encoding="utf-8")
    change_set = await checked(data)
    client = await hass_ws_client(hass)
    response = await call(
        client, "ai_drafts/changesets/apply", change_set_id=change_set.id
    )
    assert response["error"]["code"] == "apply_failed"
    assert "!include automations.yaml" in response["error"]["message"]
    assert change_set.status is ChangeSetStatus.CHECKED


async def test_discard(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, data: AIDraftsData
) -> None:
    change_set = await checked(data)
    client = await hass_ws_client(hass)
    response = await call(
        client,
        "ai_drafts/changesets/discard",
        change_set_id=change_set.id,
        decided_in="domain",
        views_opened=["domain"],
    )
    assert response["success"]
    assert response["result"]["status"] == "discarded"
    assert response["result"]["decided"] is not None
    assert data.changesets.get(change_set.id).status is ChangeSetStatus.DISCARDED
    [entry] = data.journal.list(change_set.id)
    assert entry["event"] == "discarded"
    assert entry["data"] == {"decided_in": "domain", "views_opened": ["domain"]}


async def test_discard_error_codes(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, data: AIDraftsData
) -> None:
    client = await hass_ws_client(hass)
    unknown = await call(client, "ai_drafts/changesets/discard", change_set_id="cs_x")
    assert unknown["error"]["code"] == "not_found"

    change_set = await checked(data)
    await call(client, "ai_drafts/changesets/apply", change_set_id=change_set.id)
    wrong = await call(
        client, "ai_drafts/changesets/discard", change_set_id=change_set.id
    )
    assert wrong["error"]["code"] == "wrong_state"
    assert change_set.status is ChangeSetStatus.APPLIED


async def test_revert_error_codes(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    data: AIDraftsData,
    config_dir: Path,
) -> None:
    client = await hass_ws_client(hass)
    unknown = await call(client, "ai_drafts/changesets/revert", change_set_id="cs_x")
    assert unknown["error"]["code"] == "not_found"

    change_set = await checked(data)
    wrong = await call(
        client, "ai_drafts/changesets/revert", change_set_id=change_set.id
    )
    assert wrong["error"]["code"] == "wrong_state"

    await call(client, "ai_drafts/changesets/apply", change_set_id=change_set.id)
    path = config_dir / "automations.yaml"
    path.write_text(
        path.read_text(encoding="utf-8").replace("Flurlicht", "Flurlampe"),
        encoding="utf-8",
    )
    refused = await call(
        client, "ai_drafts/changesets/revert", change_set_id=change_set.id
    )
    assert refused["error"]["code"] == "revert_refused"
    assert change_set.status is ChangeSetStatus.APPLIED
    assert "Flurlampe" in path.read_text(encoding="utf-8")


async def test_the_api_key_never_appears_in_any_response(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    data: AIDraftsData,
    config_dir: Path,
) -> None:
    client = await hass_ws_client(hass)
    seen: list[dict[str, Any]] = []
    with patch(
        PIPELINE_CLIENT, return_value=ScriptedClient(operations_json(flur_automation()))
    ):
        seen.append(await call(client, "ai_drafts/info"))
        draft = await call(client, "ai_drafts/draft", request=REQUEST)
    seen.append(draft)
    change_set_id = draft["result"]["id"]
    seen.append(await call(client, "ai_drafts/changesets/list"))
    seen.append(
        await call(client, "ai_drafts/changesets/get", change_set_id=change_set_id)
    )
    seen.append(
        await call(client, "ai_drafts/changesets/apply", change_set_id=change_set_id)
    )
    seen.append(await call(client, "ai_drafts/journal/list"))
    seen.append(
        await call(client, "ai_drafts/changesets/revert", change_set_id=change_set_id)
    )
    assert all(r["success"] for r in seen), seen
    assert API_KEY not in json.dumps(seen)
    assert "api_key" not in json.dumps(seen)
