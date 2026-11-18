"""Tests for the WebSocket commands of M1."""

import asyncio
import json
from pathlib import Path
from typing import Any
from unittest.mock import patch

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
import pytest
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.ai_drafts.changeset import ChangeSetStatus
from custom_components.ai_drafts.const import DOMAIN
from custom_components.ai_drafts.data import AIDraftsData
from custom_components.ai_drafts.drafting import ModelError

from .common import (
    OPENAI_DATA,
    ScriptedClient,
    flur_automation,
    make_change_set,
    operations_json,
    setup_entry,
)
from .test_apply import checked, read_file, start

PIPELINE_CLIENT = "custom_components.ai_drafts.pipeline.async_client_from_entry_data"
REQUEST = "Schalte das Flurlicht bei Bewegung nach Sonnenuntergang für 3 Minuten ein"
API_KEY = OPENAI_DATA["api_key"]

NEW_COMMANDS = [
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
