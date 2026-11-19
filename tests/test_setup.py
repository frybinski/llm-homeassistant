"""Tests for setup, unload, the panel and the WebSocket API."""

import hashlib
import json
from pathlib import Path
from typing import Any
from unittest.mock import patch

from homeassistant.components.frontend import DATA_PANELS
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import (
    ClientSessionGenerator,
    WebSocketGenerator,
)

from custom_components.ai_drafts.changeset import (
    STORAGE_KEY,
    ChangeSet,
    Operation,
    OperationKind,
    OperationType,
)
from custom_components.ai_drafts.const import DOMAIN

BUNDLE = (
    Path(__file__).parent.parent
    / "custom_components/ai_drafts/frontend/ai-drafts-panel.js"
)
API_KEY = "sk-super-secret-key"

OPENAI_DATA = {
    "model_source": "openai_compatible",
    "base_url": "http://localhost:11434/v1",
    "api_key": API_KEY,
    "model": "llama3.1",
}
AI_TASK_DATA = {"model_source": "ai_task", "ai_task_entity": "ai_task.my_model"}


def make_entry(data: dict[str, Any]) -> MockConfigEntry:
    return MockConfigEntry(domain=DOMAIN, data=data, title="AI Drafts")


async def setup_entry(hass: HomeAssistant, data: dict[str, Any]) -> MockConfigEntry:
    entry = make_entry(data)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.LOADED
    return entry


async def test_panel_registered_and_removed(hass: HomeAssistant) -> None:
    entry = await setup_entry(hass, OPENAI_DATA)

    panel = hass.data[DATA_PANELS]["ai-drafts"]
    assert panel.require_admin is True
    assert panel.sidebar_icon == "mdi:floor-plan"
    assert panel.sidebar_title == "AI Drafts"
    custom = panel.config["_panel_custom"]
    assert custom["name"] == "ai-drafts-panel"
    digest = hashlib.sha256(BUNDLE.read_bytes()).hexdigest()[:12]
    assert custom["module_url"] == f"/ai_drafts_static/ai-drafts-panel.js?v={digest}"

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.NOT_LOADED
    assert "ai-drafts" not in hass.data[DATA_PANELS]

    # Reload brings it back (static path and commands are registered only once).
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert "ai-drafts" in hass.data[DATA_PANELS]


async def test_info_bundle_hash_matches_panel_url(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    await setup_entry(hass, OPENAI_DATA)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "ai_drafts/info"})
    response = await client.receive_json()
    module_url = hass.data[DATA_PANELS]["ai-drafts"].config["_panel_custom"][
        "module_url"
    ]
    assert module_url.endswith(f"?v={response['result']['bundle_hash']}")


async def test_bundle_is_served(
    hass: HomeAssistant, hass_client_no_auth: ClientSessionGenerator
) -> None:
    await setup_entry(hass, OPENAI_DATA)
    client = await hass_client_no_auth()
    response = await client.get("/ai_drafts_static/ai-drafts-panel.js")
    assert response.status == 200
    assert "ai-drafts-panel" in await response.text()


async def test_refuses_old_home_assistant(hass: HomeAssistant) -> None:
    entry = make_entry(OPENAI_DATA)
    entry.add_to_hass(hass)
    with patch("custom_components.ai_drafts.HA_VERSION", "2026.9.9"):
        assert not await hass.config_entries.async_setup(entry.entry_id)
    assert entry.state is ConfigEntryState.SETUP_ERROR
    assert "2026.10.0" in (entry.reason or "")
    assert "ai-drafts" not in hass.data[DATA_PANELS]


async def test_info_for_openai_source(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    await setup_entry(hass, OPENAI_DATA)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "ai_drafts/info"})
    response = await client.receive_json()
    assert response["success"]
    assert response["result"] == {
        "version": "0.1.0",
        "model_source": "openai_compatible",
        "model": "llama3.1",
        "bundle_hash": hashlib.sha256(BUNDLE.read_bytes()).hexdigest()[:12],
    }
    assert API_KEY not in json.dumps(response)


async def test_info_for_ai_task_source(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    await setup_entry(hass, AI_TASK_DATA)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "ai_drafts/info"})
    response = await client.receive_json()
    assert response["result"] == {
        "version": "0.1.0",
        "model_source": "ai_task",
        "model": "ai_task.my_model",
        "bundle_hash": hashlib.sha256(BUNDLE.read_bytes()).hexdigest()[:12],
    }


async def test_info_for_preferred_ai_task(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    await setup_entry(hass, {"model_source": "ai_task", "ai_task_entity": None})
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "ai_drafts/info"})
    response = await client.receive_json()
    assert response["result"]["model"] is None


async def test_changesets_list_newest_first(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_storage: dict[str, Any],
) -> None:
    older = ChangeSet.new(
        "older",
        [Operation(OperationKind.AUTOMATION, OperationType.CREATE, after={"a": 1})],
        "m",
    )
    newer = ChangeSet.new("newer", [], "m")
    newer.created = older.created.replace(year=older.created.year + 1)
    hass_storage[STORAGE_KEY] = {
        "version": 1,
        "minor_version": 1,
        "key": STORAGE_KEY,
        "data": {"changesets": [older.to_dict(), newer.to_dict()]},
    }
    await setup_entry(hass, OPENAI_DATA)

    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "ai_drafts/changesets/list"})
    response = await client.receive_json()
    assert response["success"]
    assert [cs["request"] for cs in response["result"]] == ["newer", "older"]
    assert response["result"][1] == older.to_dict()
    assert API_KEY not in json.dumps(response)


@pytest.mark.parametrize("command", ["ai_drafts/info", "ai_drafts/changesets/list"])
async def test_commands_are_admin_only(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
    command: str,
) -> None:
    await setup_entry(hass, OPENAI_DATA)
    client = await hass_ws_client(hass, hass_read_only_access_token)
    await client.send_json_auto_id({"type": command})
    response = await client.receive_json()
    assert not response["success"]
    assert response["error"]["code"] == "unauthorized"


@pytest.mark.parametrize("command", ["ai_drafts/info", "ai_drafts/changesets/list"])
async def test_commands_error_when_entry_not_loaded(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, command: str
) -> None:
    # Only async_setup ran: the commands exist, but there is no loaded entry.
    assert await async_setup_component(hass, DOMAIN, {})
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": command})
    response = await client.receive_json()
    assert not response["success"]
    assert response["error"]["code"] == "not_loaded"
