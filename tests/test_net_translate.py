"""Translation of automations into nets: one hand-written expectation per rule."""

from __future__ import annotations

import json
from typing import Any

import pytest

from custom_components.ai_drafts.net import StaticResolver, translate_automation
from custom_components.ai_drafts.net.model import Net, Source

from .net_support import (
    DEMO,
    case_ids,
    describe,
    expected,
    load_cases,
    load_yaml,
    resolver_from,
    structure_violations,
)

RULE_CASES = load_cases("triggers.yaml", "conditions.yaml", "actions.yaml")


def translate(case: dict[str, Any]) -> Net:
    return translate_automation(
        case["config"],
        automation_id="x",
        source="ui",
        resolver=resolver_from(case.get("resolver")),
    )


@pytest.mark.parametrize("case", RULE_CASES, ids=case_ids(RULE_CASES))
def test_rule(case: dict[str, Any]) -> None:
    net = translate(case)
    assert describe(net) == expected(case["expect"])
    if (record := case["expect"].get("record")) is not None:
        assert net.automations[0].mode == record["mode"]
        assert net.automations[0].complete == record["complete"]
    # The complete flag follows from the opaque list.
    assert net.automations[0].complete == (not case["expect"].get("opaque"))


def test_every_rule_fixture_has_a_rule_and_an_expectation() -> None:
    for case in RULE_CASES:
        assert case["rule"], case["id"]
        assert case["expect"]["places"], case["id"]


# --- details that are not in the table ----------------------------------------


def test_state_places_carry_entity_and_area() -> None:
    resolver = StaticResolver(areas={"light.a": "flur"})
    net = translate_automation(
        {
            "triggers": [{"trigger": "state", "entity_id": "light.a", "to": "on"}],
            "actions": [
                {"action": "light.turn_off", "target": {"entity_id": "light.b"}}
            ],
        },
        automation_id="x",
        source=Source.YAML,
        resolver=resolver,
    )
    places = {p.id: p for p in net.places}
    assert places["p:light.a:on"].entity_id == "light.a"
    assert places["p:light.a:on"].state == "on"
    assert places["p:light.a:on"].origin.to_dict() == {
        "entity_id": "light.a",
        "area_id": "flur",
    }
    # No area known for light.b: the origin has the entity only.
    assert places["p:light.b:off"].origin.to_dict() == {"entity_id": "light.b"}
    assert places["p:light.a:on"].to_dict()["state"] == "on"


def test_any_place_has_state_null_in_json() -> None:
    net = translate_automation(
        {
            "triggers": [{"trigger": "state", "entity_id": "light.a"}],
            "actions": [{"delay": "00:00:01"}],
        },
        automation_id="x",
        source="ui",
    )
    place = next(p for p in net.places if p.id == "p:light.a:*")
    assert place.to_dict() == {
        "id": "p:light.a:*",
        "kind": "state",
        "entity_id": "light.a",
        "state": None,
        "origin": {"entity_id": "light.a"},
    }


def test_record_of_an_automation() -> None:
    net = translate_automation(
        {
            "alias": "Nachtruhe im Flur",
            "mode": "queued",
            "triggers": [{"trigger": "time", "at": "23:00:00"}],
            "actions": [{"action": "script.night"}],
        },
        automation_id="nachtruhe_flur",
        source="ui",
        entity_id="automation.nachtruhe_im_flur",
        enabled=False,
    )
    assert net.automations[0].to_dict() == {
        "id": "nachtruhe_flur",
        "entity_id": "automation.nachtruhe_im_flur",
        "alias": "Nachtruhe im Flur",
        "mode": "queued",
        "enabled": False,
        "source": "ui",
        "complete": False,
        "opaque": [
            {
                "path": "actions[0]",
                "reason": "calls script.night; its effects are not followed",
            }
        ],
    }


def test_wait_template_has_no_read_arcs_but_a_template_trigger_has() -> None:
    config = {
        "triggers": [
            {"trigger": "template", "value_template": "{{ is_state('light.a','on') }}"}
        ],
        "actions": [{"wait_template": "{{ is_state('light.b','on') }}"}],
    }
    net = translate_automation(
        config, automation_id="x", source="ui", resolver=StaticResolver()
    )
    reads = sorted(a.source for a in net.arcs if a.kind.value == "read")
    assert reads == ["p:light.a:*"]


def test_translation_is_independent_of_python_dict_subclasses() -> None:
    # Home Assistant hands over dict subclasses and str subclasses; the result
    # must still serialize.
    class Text(str):
        pass

    config = {
        "triggers": [{"trigger": "time", "at": Text("07:00:00")}],
        "actions": [{"delay": Text("00:00:01")}],
    }
    net = translate_automation(config, automation_id="x", source="ui")
    json.dumps(net.to_dict())


def test_not_a_mapping_raises() -> None:
    from custom_components.ai_drafts.net import TranslationError

    with pytest.raises(TranslationError):
        translate_automation([], automation_id="x", source="ui")  # type: ignore[arg-type]
    with pytest.raises(TranslationError):
        translate_automation({}, automation_id="x", source="nowhere")


# --- the five example automations -----------------------------------------------


def demo_automations() -> dict[str, dict[str, Any]]:
    data = json.loads((DEMO / "automations.json").read_text(encoding="utf-8"))
    return {a["id"]: a for a in data}


def demo_proposals() -> dict[str, dict[str, Any]]:
    data = json.loads((DEMO / "changesets.json").read_text(encoding="utf-8"))
    return {
        op["after"]["id"]: op["after"]
        for change_set in data
        for op in change_set["operations"]
        if op["kind"] == "automation" and op["after"]
    }


DEMO_EXPECTED = load_yaml(
    __import__("pathlib").Path(__file__).parent / "fixtures" / "net" / "demo.yaml"
)


@pytest.mark.parametrize("automation_id", sorted(DEMO_EXPECTED))
def test_demo_automation_in_full(automation_id: str) -> None:
    configs = demo_automations() | demo_proposals()
    net = translate_automation(
        configs[automation_id], automation_id=automation_id, source="ui"
    )
    assert describe(net) == expected(DEMO_EXPECTED[automation_id])
    assert net.automations[0].complete
    assert net.automations[0].mode == DEMO_EXPECTED[automation_id]["mode"]


ALL_DEMO = sorted((demo_automations() | demo_proposals()).items())


@pytest.mark.parametrize(("automation_id", "config"), ALL_DEMO)
def test_demo_automation_structure(automation_id: str, config: dict[str, Any]) -> None:
    net = translate_automation(config, automation_id=automation_id, source="ui")
    assert structure_violations(net) == []
    assert net.automations[0].complete
    triggers = [t for t in net.transitions if t.kind.value == "trigger"]
    assert len(triggers) == len(config["triggers"])
    writes = {a.target for a in net.arcs if a.kind.value == "write"}
    wanted = {
        f"p:{action['target']['entity_id']}:{action['action'].split('.')[1][5:]}"
        for action in config["actions"]
        if "target" in action
    }
    assert writes == wanted


def test_demo_five_automations_merge_into_one_net_with_shared_places() -> None:
    from custom_components.ai_drafts.net import merge

    configs = demo_automations() | demo_proposals()
    ids = [
        "nachtmodus_an",
        "nachtruhe_flur",
        "kuechenlicht_bewegung",
        "kinoabend",
        "flurlicht_bewegung",
    ]
    net = merge(
        *(translate_automation(configs[i], automation_id=i, source="ui") for i in ids)
    )
    assert structure_violations(net) == []
    # One place for "the night mode is on": written by nachtmodus_an, read by
    # nachtruhe_flur. One for the hallway light being on: written by the
    # proposal, read by nachtruhe_flur. One for the sun being below the horizon.
    for place_id in (
        "p:input_boolean.nachtmodus:on",
        "p:light.flurlicht:on",
        "p:sun.sun:below_horizon",
    ):
        assert sum(p.id == place_id for p in net.places) == 1
    touching = lambda pid: {  # noqa: E731
        (a.kind.value, a.source if a.target == pid else a.target)
        for a in net.arcs
        if pid in (a.source, a.target)
    }
    assert touching("p:input_boolean.nachtmodus:on") == {
        ("write", "t:nachtmodus_an:actions[0]"),
        ("read", "t:nachtruhe_flur:triggers[0]"),
    }
    assert touching("p:sun.sun:below_horizon") == {
        ("read", "t:kinoabend:triggers[0]"),
        ("read", "t:flurlicht_bewegung:triggers[0]"),
    }
