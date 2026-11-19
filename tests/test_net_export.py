"""Export: JSON round trip and PNML with the expansion of read and write arcs."""

from __future__ import annotations

import json
import re
from typing import Any
import xml.etree.ElementTree as ET

import pytest

from custom_components.ai_drafts.net import (
    NetError,
    add_environment_transitions,
    export_json,
    export_pnml,
    merge,
    translate_automation,
)
from custom_components.ai_drafts.net.export import MAX_VARIANTS
from custom_components.ai_drafts.net.model import Net

NS = {"p": "http://www.pnml.org/version-2009/grammar/pnml"}
XML_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_.\-]*$")

# Two automations, small enough to count by hand.
#   a: motion on  -> light.l on        (reads bm:on, writes l:on)
#   b: light.l off -> switch.s on      (reads l:off, writes s:on)
A = {
    "triggers": [{"trigger": "state", "entity_id": "binary_sensor.m", "to": "on"}],
    "actions": [{"action": "light.turn_on", "target": {"entity_id": "light.l"}}],
}
B = {
    "triggers": [{"trigger": "state", "entity_id": "light.l", "to": "off"}],
    "actions": [{"action": "switch.turn_on", "target": {"entity_id": "switch.s"}}],
}


def small_net() -> Net:
    return merge(
        translate_automation(A, automation_id="a", source="ui"),
        translate_automation(B, automation_id="b", source="ui"),
    )


def parse(text: str) -> ET.Element:
    return ET.fromstring(text)


def tool(element: ET.Element) -> dict[str, str]:
    node = element.find("p:toolspecific", NS)
    assert node is not None
    assert node.get("tool") == "ai_drafts"
    return {child.tag.split("}")[1]: child.text or "" for child in node}


def test_json_export_round_trips_through_from_dict() -> None:
    net = add_environment_transitions(small_net())
    text = export_json(net)
    assert text.endswith("\n")
    assert Net.from_dict(json.loads(text)) == net
    assert json.loads(text) == net.to_dict()


def test_json_export_keeps_non_ascii() -> None:
    net = translate_automation(
        {
            "alias": "Küchenlicht",
            "triggers": [{"trigger": "time", "at": "07:00:00"}],
            "actions": [{"delay": "00:00:01"}],
        },
        automation_id="k",
        source="ui",
    )
    assert "Küchenlicht" in export_json(net)


def test_pnml_is_well_formed_xml_of_a_place_transition_net() -> None:
    text = export_pnml(small_net())
    assert text.startswith('<?xml version="1.0" encoding="UTF-8"?>')
    root = parse(text)
    assert root.tag == "{http://www.pnml.org/version-2009/grammar/pnml}pnml"
    nets = root.findall("p:net", NS)
    assert len(nets) == 1
    assert nets[0].get("type") == "http://www.pnml.org/version-2009/grammar/ptnet"
    pages = nets[0].findall("p:page", NS)
    assert len(pages) == 1

    places = pages[0].findall("p:place", NS)
    transitions = pages[0].findall("p:transition", NS)
    arcs = pages[0].findall("p:arc", NS)
    ids = [e.get("id") for e in (*places, *transitions, *arcs)]
    assert len(ids) == len(set(ids)), "ids must be unique"
    assert all(i and XML_NAME.match(i) for i in ids), "ids must be XML names"

    place_ids = {e.get("id") for e in places}
    transition_ids = {e.get("id") for e in transitions}
    assert not place_ids & transition_ids
    for arc in arcs:
        source, target = arc.get("source"), arc.get("target")
        # A place/transition net: arcs run between a place and a transition.
        assert (source in place_ids and target in transition_ids) or (
            source in transition_ids and target in place_ids
        )
    # Every place and transition has a name (the original id).
    for element in (*places, *transitions):
        assert element.findtext("p:name/p:text", namespaces=NS)


def test_pnml_counts_after_expansion() -> None:
    root = parse(export_pnml(small_net()))
    page = root.find("p:net/p:page", NS)
    assert page is not None
    # Places: triggered and done of a and b (4), and the state places
    # binary_sensor.m:on, light.l:on, light.l:off, switch.s:on (4).
    assert len(page.findall("p:place", NS)) == 8
    # Transitions: trigger of a (1); the action of a writes light.l:on and light.l
    # has two places, so it expands to two (2); trigger of b (1); the action
    # of b writes switch.s:on, the only place of switch.s (1).
    assert len(page.findall("p:transition", NS)) == 5
    # Arcs: trigger of a: in, back, produce (3). Action of a, two variants of
    # consume, produce, take, put (8). Trigger of b: 3. Action of b: 4.
    assert len(page.findall("p:arc", NS)) == 18


def test_pnml_read_arc_is_an_arc_in_and_an_arc_back() -> None:
    page = parse(export_pnml(small_net())).find("p:net/p:page", NS)
    assert page is not None
    names = {e.get("id"): e.findtext("p:name/p:text", namespaces=NS) for e in page}
    trigger = next(i for i, n in names.items() if n == "t:a:triggers[0]")
    motion = next(i for i, n in names.items() if n == "p:binary_sensor.m:on")
    edges = {
        (a.get("source"), a.get("target")): tool(a) for a in page.findall("p:arc", NS)
    }
    assert edges[(motion, trigger)]["kind"] == "read"
    assert edges[(trigger, motion)]["kind"] == "read"
    assert (
        tool(page.find(f"p:place[@id='{motion}']", NS))["entity_id"]
        == "binary_sensor.m"
    )
    assert edges[(motion, trigger)]["role"] == "trigger"


def test_pnml_write_arc_has_one_transition_per_state_place_of_the_entity() -> None:
    page = parse(export_pnml(small_net())).find("p:net/p:page", NS)
    assert page is not None
    variants = [
        t
        for t in page.findall("p:transition", NS)
        if tool(t)["element"] == "t:a:actions[0]"
    ]
    assert len(variants) == 2
    moves = sorted(json.loads(tool(t)["moves"])[0]["from"] for t in variants)
    # One takes the token from light.l:off, one leaves it where it already is.
    assert moves == ["p:light.l:off", "p:light.l:on"]
    assert {json.loads(tool(t)["moves"])[0]["to"] for t in variants} == {"p:light.l:on"}


def test_pnml_toolspecific_carries_kind_origin_and_annotations() -> None:
    config = {
        "mode": "restart",
        "triggers": [{"trigger": "time", "at": "07:00:00"}],
        "actions": [{"delay": "00:00:01"}],
    }
    page = parse(
        export_pnml(translate_automation(config, automation_id="a", source="ui"))
    ).find("p:net/p:page", NS)
    assert page is not None
    trigger = next(
        t
        for t in page.findall("p:transition", NS)
        if tool(t)["element"] == "t:a:triggers[0]"
    )
    info = tool(trigger)
    assert info["kind"] == "trigger"
    assert json.loads(info["annotations"]) == [
        {"name": "mode", "value": "restart"},
        {"name": "event", "value": {"platform": "time", "at": "07:00:00"}},
    ]
    origin = trigger.find("p:toolspecific/p:origin", NS)
    assert origin is not None
    assert origin.attrib == {"automation_id": "a", "path": "triggers[0]"}


def test_pnml_environment_transition_has_no_input_and_expands_too() -> None:
    net = add_environment_transitions(small_net())
    # light.l:on is written by a; switch.s:on by b; read and never written:
    # binary_sensor.m:on and light.l:off.
    environment = {t.id for t in net.transitions if t.kind.value == "environment"}
    assert environment == {"t:env:binary_sensor.m:on", "t:env:light.l:off"}
    page = parse(export_pnml(net)).find("p:net/p:page", NS)
    assert page is not None
    # a, b: 5 as before; binary_sensor.m has one place (1); light.l has two (2).
    assert len(page.findall("p:transition", NS)) == 5 + 1 + 2


def test_pnml_escapes_special_characters() -> None:
    net = translate_automation(
        {
            "alias": "a<b & c",
            "triggers": [{"trigger": "event", "event_type": 'x"y<z>&'}],
            "actions": [{"delay": "00:00:01"}],
        },
        automation_id="a&b",
        source="ui",
    )
    root = parse(export_pnml(net))
    assert root is not None
    names = {
        e.findtext("p:name/p:text", namespaces=NS)
        for e in root.iter("{" + NS["p"] + "}place")
    }
    assert "p:a&b:triggered" in names


def test_pnml_refuses_an_invalid_net() -> None:
    net = small_net()
    broken = Net(
        net.automations, net.places, net.transitions, (*net.arcs[:-1], net.arcs[0])
    )
    with pytest.raises(NetError):
        export_pnml(broken)


def wide_net(entities: int) -> Net:
    """One action that writes ``entities`` lights; each light has two state places."""
    names = [f"light.l{i}" for i in range(entities)]
    writer = {
        "triggers": [{"trigger": "time", "at": "07:00:00"}],
        "actions": [{"action": "light.turn_on", "target": {"entity_id": names}}],
    }
    reader = {
        "triggers": [
            {"trigger": "state", "entity_id": name, "to": "off"} for name in names
        ],
        "actions": [{"delay": "00:00:01"}],
    }
    return merge(
        translate_automation(writer, automation_id="w", source="ui"),
        translate_automation(reader, automation_id="r", source="ui"),
    )


def count(root: ET.Element, tag: str) -> int:
    return len(root.findall(f"p:net/p:page/p:{tag}", NS))


def test_pnml_expands_atomically_as_long_as_the_product_is_small() -> None:
    root = parse(export_pnml(wide_net(3)))
    # 3 entities with 2 places each: 2**3 variants of the writing action; the
    # time trigger (1) and the three state triggers of `r` and its delay (1 + 3).
    assert count(root, "transition") == 8 + 1 + 3 + 1


def test_pnml_writes_one_after_the_other_when_the_product_explodes() -> None:
    entities = 9  # 2**9 = 512 > MAX_VARIANTS
    assert 2**entities > MAX_VARIANTS
    root = parse(export_pnml(wide_net(entities)))
    # Nine stages of two variants each, instead of 512 transitions.
    writer = [
        t
        for t in root.iterfind("p:net/p:page/p:transition", NS)
        if tool(t)["element"] == "t:w:actions[0]"
    ]
    assert len(writer) == 2 * entities
    # The stages are joined by eight places that belong to no net element.
    stage_places = [
        p
        for p in root.iterfind("p:net/p:page/p:place", NS)
        if tool(p).get("kind") == "expansion"
    ]
    assert len(stage_places) == entities - 1
    # Still a net: every arc connects a place and a transition.
    page = root.find("p:net/p:page", NS)
    assert page is not None
    places = {e.get("id") for e in page.findall("p:place", NS)}
    transitions = {e.get("id") for e in page.findall("p:transition", NS)}
    for arc in page.findall("p:arc", NS):
        pair = (arc.get("source") in places, arc.get("target") in places)
        assert pair in ((True, False), (False, True))
        assert {arc.get("source"), arc.get("target")} <= places | transitions


def test_empty_net_exports() -> None:
    root = parse(export_pnml(Net()))
    assert count(root, "place") == count(root, "transition") == count(root, "arc") == 0
    assert Net.from_dict(json.loads(export_json(Net()))) == Net()


def test_export_of_any_json_value_in_annotations() -> None:
    config: dict[str, Any] = {
        "triggers": [{"trigger": "time", "at": "07:00:00"}],
        "actions": [{"delay": {"hours": 1, "minutes": 2}}],
    }
    net = translate_automation(config, automation_id="d", source="ui")
    text = export_pnml(net)
    assert '"hours": 1' in text
