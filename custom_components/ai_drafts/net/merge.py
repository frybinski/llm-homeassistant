"""Combine nets: union by id, removal of an automation, environment transitions."""

from __future__ import annotations

from .model import (
    ANY_STATE,
    Arc,
    ArcKind,
    AutomationRecord,
    Net,
    NetError,
    Origin,
    Place,
    PlaceKind,
    Transition,
    TransitionKind,
)


class MergeError(NetError):
    """Two nets define different things under one id."""


def merge(*nets: Net) -> Net:
    """Return the union of nets by id.

    Identical definitions under one id are one element: state places shared by
    several automations unify. Different definitions under one id (two
    automations with one id, a state place with two areas) raise ``MergeError``.
    """
    automations: dict[str, AutomationRecord] = {}
    places: dict[str, Place] = {}
    transitions: dict[str, Transition] = {}
    arcs: dict[tuple[str, str, str, str | None], Arc] = {}
    for net in nets:
        for record in net.automations:
            _put(automations, "automation", record.id, record)
        for place in net.places:
            _put(places, "place", place.id, place)
        for transition in net.transitions:
            _put(transitions, "transition", transition.id, transition)
        for arc in net.arcs:
            arcs.setdefault(arc.key, arc)
    return Net(
        automations=tuple(automations.values()),
        places=tuple(places.values()),
        transitions=tuple(transitions.values()),
        arcs=tuple(arcs.values()),
    )


def _put[T](target: dict[str, T], what: str, key: str, value: T) -> None:
    if key in target and target[key] != value:
        raise MergeError(f"two different definitions of {what} {key}")
    target.setdefault(key, value)


def remove_automation(net: Net, automation_id: str) -> Net:
    """Return the net without an automation and what only it referred to.

    State places no arc touches any more disappear with it, because state
    places exist only for states some automation refers to. Environment
    transitions are derived from the rest, so they are dropped too; add them
    again with ``add_environment_transitions``.
    """
    gone_transitions = {
        t.id
        for t in net.transitions
        if t.origin.automation_id == automation_id
        or t.kind is TransitionKind.ENVIRONMENT
    }
    gone_places = {
        p.id
        for p in net.places
        if p.kind is PlaceKind.CONTROL and p.automation_id == automation_id
    }
    arcs = tuple(
        a
        for a in net.arcs
        if a.source not in gone_transitions | gone_places
        and a.target not in gone_transitions | gone_places
    )
    touched = {a.source for a in arcs} | {a.target for a in arcs}
    places = tuple(
        p
        for p in net.places
        if p.id not in gone_places and (p.kind is PlaceKind.CONTROL or p.id in touched)
    )
    return Net(
        automations=tuple(a for a in net.automations if a.id != automation_id),
        places=places,
        transitions=tuple(t for t in net.transitions if t.id not in gone_transitions),
        arcs=arcs,
    )


def add_environment_transitions(net: Net) -> Net:
    """Add an environment transition for every state that is read and not written.

    Without them such a place could never gain a token. One transition per
    place, with one write arc.
    """
    read = {a.source for a in net.arcs if a.kind is ArcKind.READ}
    written = {a.target for a in net.arcs if a.kind is ArcKind.WRITE}
    existing = {t.id for t in net.transitions}
    transitions: list[Transition] = []
    arcs: list[Arc] = []
    for place in net.places:
        if place.kind is not PlaceKind.STATE or place.id not in read - written:
            continue
        state = ANY_STATE if place.state is None else place.state
        transition_id = f"t:env:{place.entity_id}:{state}"
        if transition_id in existing:
            continue
        transitions.append(
            Transition(
                id=transition_id,
                kind=TransitionKind.ENVIRONMENT,
                origin=Origin(entity_id=place.entity_id),
            )
        )
        arcs.append(Arc(ArcKind.WRITE, transition_id, place.id))
    return Net(
        automations=net.automations,
        places=net.places,
        transitions=(*net.transitions, *transitions),
        arcs=(*net.arcs, *arcs),
    )
