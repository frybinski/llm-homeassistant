"""Tests for the showcase example data in ``frontend/src/demo``."""

from collections import Counter
import json
from pathlib import Path
import re
from typing import Any

from homeassistant.components.automation.config import async_validate_config_item
from homeassistant.core import HomeAssistant
import pytest
import voluptuous as vol

from custom_components.ai_drafts.changeset import (
    ChangeSet,
    ChangeSetStatus,
    OperationKind,
    OperationType,
    Severity,
)

DEMO_DIR = Path(__file__).parent.parent / "frontend" / "src" / "demo"


def load(name: str) -> Any:
    return json.loads((DEMO_DIR / name).read_text(encoding="utf-8"))


HOUSE = load("house.json")
EXISTING_AUTOMATIONS: list[dict[str, Any]] = load("automations.json")
CHANGE_SETS: list[dict[str, Any]] = load("changesets.json")
NET_EXISTING = load("net.json")
NET_PROPOSAL = load("net-proposal.json")

PROPOSAL = CHANGE_SETS[0]
PROPOSAL_AUTOMATION = PROPOSAL["operations"][0]["after"]
ALL_AUTOMATIONS = [*EXISTING_AUTOMATIONS, PROPOSAL_AUTOMATION]


def merged_net() -> dict[str, list[dict[str, Any]]]:
    return {
        key: NET_EXISTING[key] + NET_PROPOSAL[key]
        for key in ("places", "transitions", "arcs")
    }


# --- Change sets --------------------------------------------------------------


def test_there_are_four_change_sets_with_the_expected_statuses() -> None:
    assert [cs["status"] for cs in CHANGE_SETS] == [
        "checked",
        "applied",
        "discarded",
        "failed",
    ]
    assert len({cs["id"] for cs in CHANGE_SETS}) == 4


@pytest.mark.parametrize("raw", CHANGE_SETS, ids=[cs["id"] for cs in CHANGE_SETS])
def test_change_set_parses_and_round_trips(raw: dict[str, Any]) -> None:
    parsed = ChangeSet.from_dict(raw)
    assert parsed.to_dict() == ChangeSet.from_dict(parsed.to_dict()).to_dict()
    # The JSON is written in canonical form, so it round-trips exactly,
    # apart from the timezone notation of the timestamps.
    again = parsed.to_dict()
    for key in ("id", "request", "status", "operations", "findings", "model", "rounds"):
        assert again[key] == raw[key]


def test_proposal_is_checked_with_one_warning_and_can_be_applied() -> None:
    cs = ChangeSet.from_dict(PROPOSAL)
    assert cs.status is ChangeSetStatus.CHECKED
    assert not any(f.severity is Severity.ERROR for f in cs.findings)
    assert [(f.severity, f.check) for f in cs.findings] == [
        (Severity.WARNING, "conflicts.opposing_actions")
    ]
    assert len(cs.operations) == 1
    assert cs.operations[0].kind is OperationKind.AUTOMATION
    assert cs.operations[0].op is OperationType.CREATE
    cs.apply()
    assert cs.status is ChangeSetStatus.APPLIED
    cs.revert()
    assert cs.status is ChangeSetStatus.REVERTED


def test_history_covers_failed_with_three_rounds_and_an_error() -> None:
    failed = ChangeSet.from_dict(CHANGE_SETS[3])
    assert failed.rounds == 3
    assert any(f.severity is Severity.ERROR for f in failed.findings)


# --- Automations --------------------------------------------------------------


@pytest.mark.parametrize(
    "config", ALL_AUTOMATIONS, ids=[a["id"] for a in ALL_AUTOMATIONS]
)
async def test_automation_passes_home_assistant_validation(
    hass: HomeAssistant, config: dict[str, Any]
) -> None:
    validated = await async_validate_config_item(hass, config["id"], config)
    assert validated is not None
    assert validated.validation_error is None
    assert validated["alias"] == config["alias"]
    assert len(validated["actions"]) == len(config["actions"])


async def test_home_assistant_validation_does_reject_a_broken_automation(
    hass: HomeAssistant,
) -> None:
    """Negative control: the validation above can fail."""
    broken = {**EXISTING_AUTOMATIONS[0], "actions": [{"action": "not valid"}]}
    with pytest.raises(vol.Invalid):
        await async_validate_config_item(hass, broken["id"], broken)


def entity_ids_of(node: Any) -> list[str]:
    """Collect every ``entity_id`` value in an automation config."""
    if isinstance(node, dict):
        found = [v for k, v in node.items() if k == "entity_id" and isinstance(v, str)]
        return found + [i for v in node.values() for i in entity_ids_of(v)]
    if isinstance(node, list):
        return [i for v in node for i in entity_ids_of(v)]
    return []


def test_automations_are_unique_and_in_the_house() -> None:
    ids = [a["id"] for a in ALL_AUTOMATIONS]
    assert len(ids) == len(set(ids)) == 5
    entities = {e["entity_id"] for e in HOUSE["entities"]}
    for automation in ALL_AUTOMATIONS:
        for entity_id in entity_ids_of(automation):
            assert entity_id in entities, entity_id


def test_house_is_consistent() -> None:
    areas = {a["id"] for a in HOUSE["areas"]}
    assert len(areas) == 3
    entity_ids = [e["entity_id"] for e in HOUSE["entities"]]
    assert len(entity_ids) == len(set(entity_ids)) == 9
    for entity in HOUSE["entities"]:
        assert entity["icon"].startswith("mdi:")
        assert entity["name"]
        assert entity["state"]
        assert entity["area_id"] is None or entity["area_id"] in areas
    assert {e["entity_id"] for e in HOUSE["entities"] if e["area_id"] is None} == {
        "sun.sun",
        "input_boolean.nachtmodus",
    }


# --- Net ----------------------------------------------------------------------


@pytest.mark.parametrize("net", [NET_EXISTING, NET_PROPOSAL], ids=["net", "fragment"])
def test_net_header(net: dict[str, Any]) -> None:
    assert net["format"] == "ai_drafts.net"
    assert net["version"] == 0


def test_net_ids_are_unique_and_arcs_join_place_and_transition() -> None:
    net = merged_net()
    ids = [e["id"] for e in net["places"] + net["transitions"]]
    assert [i for i, n in Counter(ids).items() if n > 1] == []
    places = {p["id"] for p in net["places"]}
    transitions = {t["id"] for t in net["transitions"]}
    assert all(i.startswith("p:") for i in places)
    assert all(i.startswith("t:") for i in transitions)
    for arc in net["arcs"]:
        assert arc["kind"] in {"read", "consume", "produce"}
        if arc["kind"] == "produce":
            assert arc["source"] in transitions, arc
            assert arc["target"] in places, arc
        else:
            assert arc["source"] in places, arc
            assert arc["target"] in transitions, arc
    assert len({(a["source"], a["target"], a["kind"]) for a in net["arcs"]}) == len(
        net["arcs"]
    )


def test_fragment_arcs_do_not_dangle_without_the_existing_net() -> None:
    """The fragment alone may only miss places that the existing net has."""
    own = {e["id"] for e in NET_PROPOSAL["places"] + NET_PROPOSAL["transitions"]}
    existing = {p["id"] for p in NET_EXISTING["places"]}
    assert not own & existing
    for arc in NET_PROPOSAL["arcs"]:
        for end in (arc["source"], arc["target"]):
            assert end in own or end in existing


def test_state_places_match_the_house() -> None:
    states = {p["entity_id"]: p for p in HOUSE["entities"]}
    for place in merged_net()["places"]:
        assert place["kind"] in {"state", "control"}
        assert place["label"]
        if place["kind"] == "state":
            assert place["id"] == f"p:{place['entity_id']}:{place['state']}"
            assert place["entity_id"] in states
            assert place["origin"]["entity_id"] == place["entity_id"]


def test_origins_point_at_existing_things() -> None:
    entities = {e["entity_id"]: e for e in HOUSE["entities"]}
    areas = {a["id"] for a in HOUSE["areas"]}
    automations = {a["id"]: a for a in ALL_AUTOMATIONS}
    net = merged_net()
    for element in net["places"] + net["transitions"]:
        origin = element["origin"]
        assert origin, element["id"]
        if "entity_id" in origin:
            assert origin["entity_id"] in entities
            # area_id is present exactly when the entity has a room.
            room = entities[origin["entity_id"]]["area_id"]
            assert origin.get("area_id") == room
        if "area_id" in origin:
            assert origin["area_id"] in areas
        if "automation_id" in origin:
            assert origin["automation_id"] in automations
        if "path" in origin:
            # "actions[2]" must name an element of that automation's config.
            match = re.fullmatch(r"(\w+)\[(\d+)\]", origin["path"])
            assert match, origin["path"]
            config = automations[origin["automation_id"]]
            assert int(match[2]) < len(config[match[1]])
        if element["id"].startswith("t:"):
            assert element["id"].split(":")[1] == origin["automation_id"]


def test_each_automation_has_trigger_and_action_transitions() -> None:
    kinds = Counter(
        (t["origin"]["automation_id"], t["kind"]) for t in merged_net()["transitions"]
    )
    for automation in ALL_AUTOMATIONS:
        assert kinds[(automation["id"], "trigger")] >= 1, automation["id"]
        assert kinds[(automation["id"], "action")] >= 1, automation["id"]


def test_finding_net_refs_name_existing_elements() -> None:
    net = merged_net()
    ids = {e["id"] for e in net["places"] + net["transitions"]}
    for raw in CHANGE_SETS:
        for finding in ChangeSet.from_dict(raw).findings:
            assert set(finding.net_refs) <= ids
    assert ChangeSet.from_dict(PROPOSAL).findings[0].net_refs
