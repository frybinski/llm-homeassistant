"""The net model, merging and the environment option."""

from __future__ import annotations

import dataclasses
import json
from typing import Any

import pytest

from custom_components.ai_drafts.net import (
    MergeError,
    NetError,
    StaticResolver,
    add_environment_transitions,
    merge,
    remove_automation,
    translate_automation,
)
from custom_components.ai_drafts.net.model import (
    Arc,
    ArcKind,
    ArcRole,
    Net,
    Origin,
    Place,
    PlaceKind,
    Transition,
    TransitionKind,
)

from .net_support import describe, structure_violations

NIGHT = {
    "triggers": [{"trigger": "state", "entity_id": "light.hall", "to": "on"}],
    "conditions": [
        {"condition": "state", "entity_id": "input_boolean.night", "state": "on"}
    ],
    "actions": [{"action": "light.turn_off", "target": {"entity_id": "light.hall"}}],
}
SWITCH_ON = {
    "triggers": [{"trigger": "time", "at": "23:00:00"}],
    "actions": [
        {
            "action": "input_boolean.turn_on",
            "target": {"entity_id": "input_boolean.night"},
        }
    ],
}


def net_of(config: dict[str, Any], automation_id: str, **kwargs: Any) -> Net:
    return translate_automation(
        config, automation_id=automation_id, source="ui", **kwargs
    )


# --- model ----------------------------------------------------------------------


def test_json_round_trip_keeps_everything() -> None:
    net = merge(net_of(NIGHT, "night"), net_of(SWITCH_ON, "switch"))
    data = json.loads(json.dumps(net.to_dict()))
    assert data["format"] == "ai_drafts.net"
    assert data["version"] == 1
    assert Net.from_dict(data) == net
    assert Net.from_dict(data).to_dict() == data


def test_json_matches_the_specification() -> None:
    net = net_of(NIGHT, "night", entity_id="automation.nachtruhe", alias="Nachtruhe")
    data = net.to_dict()
    assert set(data) == {
        "format",
        "version",
        "automations",
        "places",
        "transitions",
        "arcs",
    }
    assert data["automations"] == [
        {
            "id": "night",
            "entity_id": "automation.nachtruhe",
            "alias": "Nachtruhe",
            "mode": "single",
            "enabled": True,
            "source": "ui",
            "complete": True,
            "opaque": [],
        }
    ]
    assert {t["id"]: t["origin"] for t in data["transitions"]} == {
        "t:night:triggers[0]": {"automation_id": "night", "path": "triggers[0]"},
        "t:night:conditions": {"automation_id": "night", "path": "conditions"},
        "t:night:conditions:stop": {"automation_id": "night", "path": "conditions"},
        "t:night:actions[0]": {"automation_id": "night", "path": "actions[0]"},
    }
    arcs = {(a["kind"], a["source"], a["target"], a.get("role")) for a in data["arcs"]}
    assert ("read", "p:light.hall:on", "t:night:triggers[0]", "trigger") in arcs
    assert ("write", "t:night:actions[0]", "p:light.hall:off", None) in arcs


@pytest.mark.parametrize(
    "mutate",
    [
        lambda d: d.update(format="other"),
        lambda d: d.update(version=0),
        lambda d: d["places"][0].update(kind="nonsense"),
        lambda d: d["arcs"][0].update(kind="teleport"),
        lambda d: d["arcs"][0].update(role="boss"),
        lambda d: d["automations"][0].update(complete=False),
        lambda d: d["automations"][0].update(source="cloud"),
        lambda d: d.pop("arcs"),
        lambda d: d["transitions"][0].update(annotations="no"),
    ],
)
def test_from_dict_rejects_malformed_json(mutate: Any) -> None:
    data = net_of(NIGHT, "night").to_dict()
    mutate(data)
    with pytest.raises(NetError):
        Net.from_dict(data)


def test_a_valid_net_validates() -> None:
    net_of(NIGHT, "night").validate()
    Net().validate()


def replace_arc(net: Net, index: int, **changes: Any) -> Net:
    arcs = list(net.arcs)
    arcs[index] = dataclasses.replace(arcs[index], **changes)
    return dataclasses.replace(net, arcs=tuple(arcs))


def arc_index(net: Net, kind: ArcKind) -> int:
    return next(i for i, a in enumerate(net.arcs) if a.kind is kind)


def test_validate_rejects_duplicate_ids() -> None:
    net = net_of(NIGHT, "night")
    with pytest.raises(NetError, match="duplicate place"):
        dataclasses.replace(net, places=(*net.places, net.places[0])).validate()
    with pytest.raises(NetError, match="duplicate transition"):
        dataclasses.replace(
            net, transitions=(*net.transitions, net.transitions[0])
        ).validate()
    with pytest.raises(NetError, match="duplicate automation"):
        dataclasses.replace(
            net, automations=(*net.automations, net.automations[0])
        ).validate()
    with pytest.raises(NetError, match="duplicate arc"):
        dataclasses.replace(net, arcs=(*net.arcs, net.arcs[0])).validate()


def test_validate_rejects_arcs_to_nothing() -> None:
    net = net_of(NIGHT, "night")
    index = arc_index(net, ArcKind.CONSUME)
    with pytest.raises(NetError, match="no such place"):
        replace_arc(net, index, source="p:night:nowhere").validate()
    with pytest.raises(NetError, match="no such transition"):
        replace_arc(net, index, target="t:night:nowhere").validate()


def test_validate_rejects_the_wrong_direction() -> None:
    net = net_of(NIGHT, "night")
    consume = net.arcs[arc_index(net, ArcKind.CONSUME)]
    # A consume arc that starts at the transition cannot name a place there.
    swapped = dataclasses.replace(consume, source=consume.target, target=consume.source)
    with pytest.raises(NetError):
        dataclasses.replace(net, arcs=(*net.arcs, swapped)).validate()


@pytest.mark.parametrize(
    ("kind", "wrong_place"),
    [
        (ArcKind.READ, "p:night:triggered"),
        (ArcKind.WRITE, "p:night:triggered"),
        (ArcKind.CONSUME, "p:light.hall:on"),
        (ArcKind.PRODUCE, "p:light.hall:on"),
    ],
)
def test_validate_rejects_the_wrong_kind_of_place(
    kind: ArcKind, wrong_place: str
) -> None:
    net = net_of(NIGHT, "night")
    index = arc_index(net, kind)
    arc = net.arcs[index]
    field = "source" if arc.source.startswith("p:") else "target"
    with pytest.raises(NetError, match="must touch a"):
        replace_arc(net, index, **{field: wrong_place}).validate()


def test_validate_requires_a_role_on_read_arcs_and_only_there() -> None:
    net = net_of(NIGHT, "night")
    with pytest.raises(NetError, match="read arc without role"):
        replace_arc(net, arc_index(net, ArcKind.READ), role=None).validate()
    with pytest.raises(NetError, match="only read arcs have a role"):
        replace_arc(net, arc_index(net, ArcKind.WRITE), role=ArcRole.TRIGGER).validate()


def test_validate_reports_every_problem() -> None:
    net = net_of(NIGHT, "night")
    broken = dataclasses.replace(
        replace_arc(net, arc_index(net, ArcKind.READ), role=None),
        places=(*net.places, net.places[0]),
    )
    with pytest.raises(NetError) as raised:
        broken.validate()
    assert len(raised.value.problems) == 2


def test_validate_knows_the_owner_of_every_element() -> None:
    net = net_of(NIGHT, "night")
    with pytest.raises(NetError, match="unknown automation"):
        dataclasses.replace(net, automations=()).validate()


# --- merge ----------------------------------------------------------------------


def test_merge_unifies_state_places_shared_between_automations() -> None:
    first, second = net_of(NIGHT, "night"), net_of(SWITCH_ON, "switch")
    net = merge(first, second)
    net.validate()
    assert sum(p.id == "p:input_boolean.night:on" for p in net.places) == 1
    assert {a.id for a in net.automations} == {"night", "switch"}
    assert len(net.places) == len(first.places) + len(second.places) - 1
    assert len(net.transitions) == len(first.transitions) + len(second.transitions)
    assert len(net.arcs) == len(first.arcs) + len(second.arcs)
    assert structure_violations(net) == []


def test_merge_is_idempotent_and_order_independent() -> None:
    first, second = net_of(NIGHT, "night"), net_of(SWITCH_ON, "switch")
    assert merge(first, first) == first
    assert describe(merge(first, second)) == describe(merge(second, first))
    assert merge() == Net()


def test_merge_of_conflicting_automations_raises() -> None:
    renamed = {**NIGHT, "alias": "Another"}
    with pytest.raises(MergeError, match="automation night"):
        merge(net_of(NIGHT, "night"), net_of(renamed, "night"))
    # The same id with a different body clashes at the first element that differs.
    other = {**SWITCH_ON, "actions": [{"delay": "00:00:01"}]}
    with pytest.raises(MergeError, match="two different definitions"):
        merge(net_of(NIGHT, "night"), net_of(other, "night"))


def test_merge_of_conflicting_state_places_raises() -> None:
    with_area = StaticResolver(areas={"light.hall": "flur"})
    with pytest.raises(MergeError, match=r"place p:light\.hall:on"):
        merge(net_of(NIGHT, "a"), net_of(NIGHT, "b", resolver=with_area))


def test_merge_of_conflicting_transitions_raises() -> None:
    net = net_of(NIGHT, "night")
    changed = dataclasses.replace(
        net.transitions[0],
        annotations=(
            *net.transitions[0].annotations,
            net.transitions[0].annotations[0],
        ),
    )
    other = dataclasses.replace(net, transitions=(changed, *net.transitions[1:]))
    with pytest.raises(MergeError, match="transition"):
        merge(net, other)


def test_merge_error_is_a_net_error() -> None:
    assert issubclass(MergeError, NetError)


# --- removing an automation -------------------------------------------------------


def test_remove_automation_takes_its_places_and_what_only_it_used() -> None:
    first, second = net_of(NIGHT, "night"), net_of(SWITCH_ON, "switch")
    net = remove_automation(merge(first, second), "night")
    net.validate()
    assert describe(net) == describe(second)
    # The place both used stays, because "switch" writes it.
    assert any(p.id == "p:input_boolean.night:on" for p in net.places)
    assert not any(p.id == "p:light.hall:on" for p in net.places)
    assert remove_automation(net, "unknown") == net


# --- environment -----------------------------------------------------------------


def test_environment_transitions_for_states_that_are_read_and_never_written() -> None:
    net = merge(net_of(NIGHT, "night"), net_of(SWITCH_ON, "switch"))
    with_env = add_environment_transitions(net)
    with_env.validate()
    environment = {
        t.id for t in with_env.transitions if t.kind is TransitionKind.ENVIRONMENT
    }
    # Read by `night`: light.hall:on (nobody writes it: `night` writes ...:off),
    # input_boolean.night:on (written by `switch`, so no environment).
    assert environment == {"t:env:light.hall:on"}
    arcs = [a for a in with_env.arcs if "t:env:light.hall:on" in (a.source, a.target)]
    assert [(a.kind.value, a.source, a.target) for a in arcs] == [
        ("write", "t:env:light.hall:on", "p:light.hall:on")
    ]
    env = next(t for t in with_env.transitions if t.kind is TransitionKind.ENVIRONMENT)
    assert env.origin == Origin(entity_id="light.hall")
    assert env.annotations == ()
    assert structure_violations(with_env) == []


def test_environment_is_off_by_default_and_idempotent() -> None:
    net = merge(net_of(NIGHT, "night"), net_of(SWITCH_ON, "switch"))
    assert not any(t.kind is TransitionKind.ENVIRONMENT for t in net.transitions)
    once = add_environment_transitions(net)
    assert add_environment_transitions(once) == once


def test_environment_for_the_any_place() -> None:
    config = {
        "triggers": [{"trigger": "numeric_state", "entity_id": "sensor.t", "above": 3}],
        "actions": [{"action": "light.toggle", "target": {"entity_id": "light.a"}}],
    }
    net = add_environment_transitions(net_of(config, "x"))
    # sensor.t:* is read and not written; light.a:* is written and not read.
    assert [t.id for t in net.transitions if t.kind is TransitionKind.ENVIRONMENT] == [
        "t:env:sensor.t:*"
    ]


def test_places_and_transitions_are_frozen() -> None:
    place = Place(
        "p:a:b", PlaceKind.STATE, Origin(entity_id="a"), entity_id="a", state="b"
    )
    with pytest.raises(dataclasses.FrozenInstanceError):
        place.state = "c"  # type: ignore[misc]
    with pytest.raises(dataclasses.FrozenInstanceError):
        Transition("t", TransitionKind.SKIP, Origin()).id = "u"  # type: ignore[misc]
    with pytest.raises(dataclasses.FrozenInstanceError):
        Arc(ArcKind.WRITE, "t", "p").kind = ArcKind.READ  # type: ignore[misc]
