"""WebSocket commands ai_drafts/net/get and ai_drafts/net/export."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from unittest.mock import patch
import xml.etree.ElementTree as ET

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
import pytest
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.ai_drafts.const import DOMAIN
from custom_components.ai_drafts.data import AIDraftsData
from custom_components.ai_drafts.net import MergeError, NetError
from custom_components.ai_drafts.net.model import Net

from .common import OPENAI_DATA, flur_automation, make_change_set, setup_entry
from .test_apply import start
from .test_net_build import HOUSE
from .test_websocket import call

COMMANDS = [
    ("ai_drafts/net/get", {}),
    ("ai_drafts/net/export", {"format": "json"}),
]


@pytest.fixture
async def data(hass: HomeAssistant, config_dir: Path) -> AIDraftsData:
    return await start(hass, config_dir, HOUSE)


async def stored_change_set(data: AIDraftsData, **after: Any) -> str:
    change_set = make_change_set(flur_automation(id="flur_new", **after))
    await data.changesets.async_add(change_set)
    return change_set.id


@pytest.mark.parametrize(("command", "payload"), COMMANDS)
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


@pytest.mark.parametrize(("command", "payload"), COMMANDS)
async def test_commands_need_the_integration(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    command: str,
    payload: dict[str, Any],
) -> None:
    # Only async_setup ran: the commands exist, but there is no loaded entry.
    assert await async_setup_component(hass, DOMAIN, {})
    client = await hass_ws_client(hass)
    response = await call(client, command, **payload)
    assert not response["success"]
    assert response["error"]["code"] == "not_loaded"


async def test_net_get_returns_the_net_of_all_automations(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, data: AIDraftsData
) -> None:
    client = await hass_ws_client(hass)
    response = await call(client, "ai_drafts/net/get")
    assert response["success"]
    result = response["result"]
    net = Net.from_dict(result)
    net.validate()
    assert result["format"] == "ai_drafts.net"
    assert result["version"] == 1
    assert {a["id"]: a["source"] for a in result["automations"]} == {
        "hallway_motion": "ui",
        "night_hallway_off": "yaml",
        "paused": "ui",
    }
    assert not any(t["kind"] == "environment" for t in result["transitions"])


async def test_net_get_with_a_change_set_adds_the_proposal(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, data: AIDraftsData
) -> None:
    change_set_id = await stored_change_set(data)
    client = await hass_ws_client(hass)
    response = await call(client, "ai_drafts/net/get", change_set_id=change_set_id)
    assert response["success"]
    sources = {a["id"]: a["source"] for a in response["result"]["automations"]}
    assert sources == {
        "hallway_motion": "ui",
        "night_hallway_off": "yaml",
        "paused": "ui",
        "flur_new": "proposal",
    }
    Net.from_dict(response["result"]).validate()
    # Without the change set the proposal is not there.
    plain = await call(client, "ai_drafts/net/get")
    assert "flur_new" not in {a["id"] for a in plain["result"]["automations"]}


async def test_net_get_with_environment(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, data: AIDraftsData
) -> None:
    client = await hass_ws_client(hass)
    response = await call(client, "ai_drafts/net/get", environment=True)
    kinds = [t["kind"] for t in response["result"]["transitions"]]
    assert kinds.count("environment") == 3
    off = await call(client, "ai_drafts/net/get", environment=False)
    assert "environment" not in [t["kind"] for t in off["result"]["transitions"]]


async def test_net_get_with_an_unknown_change_set(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, data: AIDraftsData
) -> None:
    client = await hass_ws_client(hass)
    response = await call(client, "ai_drafts/net/get", change_set_id="cs_nothing")
    assert not response["success"]
    assert response["error"]["code"] == "not_found"


async def test_net_export_json(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, data: AIDraftsData
) -> None:
    client = await hass_ws_client(hass)
    response = await call(client, "ai_drafts/net/export", format="json")
    assert response["success"]
    assert response["result"]["filename"] == "ai_drafts_net.json"
    exported = json.loads(response["result"]["content"])
    direct = await call(client, "ai_drafts/net/get")
    assert exported == direct["result"]


async def test_net_export_pnml(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, data: AIDraftsData
) -> None:
    client = await hass_ws_client(hass)
    response = await call(client, "ai_drafts/net/export", format="pnml")
    assert response["success"]
    assert response["result"]["filename"] == "ai_drafts_net.pnml"
    root = ET.fromstring(response["result"]["content"])
    ns = {"p": "http://www.pnml.org/version-2009/grammar/pnml"}
    assert len(root.findall("p:net/p:page/p:place", ns)) > 0
    assert len(root.findall("p:net/p:page/p:transition", ns)) > 0


async def test_net_export_with_change_set_and_environment(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, data: AIDraftsData
) -> None:
    change_set_id = await stored_change_set(data)
    client = await hass_ws_client(hass)
    response = await call(
        client,
        "ai_drafts/net/export",
        format="json",
        change_set_id=change_set_id,
        environment=True,
    )
    net = Net.from_dict(json.loads(response["result"]["content"]))
    assert "flur_new" in {a.id for a in net.automations}
    assert any(t.kind.value == "environment" for t in net.transitions)
    pnml = await call(
        client,
        "ai_drafts/net/export",
        format="pnml",
        change_set_id=change_set_id,
        environment=True,
    )
    names = {
        e.findtext(
            "{http://www.pnml.org/version-2009/grammar/pnml}name/{http://www.pnml.org/version-2009/grammar/pnml}text"
        )
        for e in ET.fromstring(pnml["result"]["content"]).iter()
    }
    assert "p:flur_new:triggered" in names


async def test_net_export_rejects_unknown_formats_and_options(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, data: AIDraftsData
) -> None:
    client = await hass_ws_client(hass)
    for payload in ({"format": "dot"}, {}, {"format": "json", "environment": "yes"}):
        response = await call(client, "ai_drafts/net/export", **payload)
        assert not response["success"]
        assert response["error"]["code"] == "invalid_format"


async def test_a_net_that_cannot_be_built_or_exported_is_an_error_not_a_crash(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, data: AIDraftsData
) -> None:
    client = await hass_ws_client(hass)
    with patch(
        "custom_components.ai_drafts.websocket.async_build_net",
        side_effect=MergeError("two different definitions of place p:x"),
    ):
        response = await call(client, "ai_drafts/net/get")
    assert not response["success"]
    assert response["error"]["code"] == "net_error"
    assert "two different definitions" in response["error"]["message"]

    with patch(
        "custom_components.ai_drafts.websocket.export_pnml",
        side_effect=NetError("broken"),
    ):
        response = await call(client, "ai_drafts/net/export", format="pnml")
    assert not response["success"]
    assert response["error"]["code"] == "net_error"
