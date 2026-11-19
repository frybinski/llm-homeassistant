"""Helpers for the net tests: fixture files, a compact view of a net, properties."""

from __future__ import annotations

from collections import defaultdict
import json
from pathlib import Path
import re
from typing import Any

import yaml

from custom_components.ai_drafts.net import StaticResolver
from custom_components.ai_drafts.net.model import ArcKind, Net, PlaceKind

FIXTURES = Path(__file__).parent / "fixtures" / "net"
DEMO = Path(__file__).parents[1] / "frontend" / "src" / "demo"


class _Loader(yaml.SafeLoader):
    """YAML where only true/false are booleans: ``on`` and ``off`` are strings."""


_Loader.yaml_implicit_resolvers = {
    key: [(tag, rx) for tag, rx in resolvers if tag != "tag:yaml.org,2002:bool"]
    for key, resolvers in yaml.SafeLoader.yaml_implicit_resolvers.items()
}
_Loader.add_implicit_resolver(
    "tag:yaml.org,2002:bool", re.compile(r"^(?:true|false)$"), list("tf")
)


def load_yaml(path: Path) -> Any:
    return yaml.load(path.read_text(encoding="utf-8"), Loader=_Loader)


def load_cases(*names: str) -> list[dict[str, Any]]:
    """Return the cases of fixture files, each with its file name."""
    cases = []
    for name in names:
        for case in load_yaml(FIXTURES / name)["cases"]:
            cases.append({**case, "file": name})
    return cases


def case_ids(cases: list[dict[str, Any]]) -> list[str]:
    return [f"{c['file'].removesuffix('.yaml')}-{c['id']}" for c in cases]


def resolver_from(spec: dict[str, Any] | None) -> StaticResolver | None:
    """Build the resolver a case asks for; no ``resolver`` key means none."""
    if spec is None:
        return None
    targets = {
        tuple(key.split(":", 1)): entities
        for key, entities in spec.get("targets", {}).items()
    }
    return StaticResolver(targets, spec.get("areas"))


def _annotation(name: str, value: Any) -> str:
    return json.dumps({name: value}, sort_keys=True)


def describe(net: Net) -> dict[str, Any]:
    """Return a net in the compact form the expectations are written in."""
    arcs = []
    for arc in net.arcs:
        text = f"{arc.kind.value} {arc.source} -> {arc.target}"
        if arc.role is not None:
            text += f" [{arc.role.value}]"
        arcs.append(text)
    return {
        "places": sorted(p.id for p in net.places),
        "transitions": {
            t.id: (
                t.kind.value,
                sorted(_annotation(a.name, a.value) for a in t.annotations),
            )
            for t in net.transitions
        },
        "arcs": sorted(arcs),
        "opaque": sorted(o.path for a in net.automations for o in a.opaque),
    }


def expected(expect: dict[str, Any]) -> dict[str, Any]:
    """Return an expectation as written in a fixture, in the form of ``describe``."""
    transitions = {}
    for transition_id, body in expect["transitions"].items():
        annotations = [
            _annotation(name, value)
            for item in body.get("annotations", [])
            for name, value in item.items()
        ]
        transitions[transition_id] = (body["kind"], sorted(annotations))
    return {
        "places": sorted(expect["places"]),
        "transitions": transitions,
        "arcs": sorted(expect["arcs"]),
        "opaque": sorted(expect.get("opaque", [])),
    }


# --- the structural properties -------------------------------------------------


def control_graph(net: Net) -> dict[str, set[str]]:
    """Return the control flow: control place -> transition -> control place."""
    graph: dict[str, set[str]] = defaultdict(set)
    for arc in net.arcs:
        if arc.kind in (ArcKind.CONSUME, ArcKind.PRODUCE):
            graph[arc.source].add(arc.target)
    return graph


def _reachable(graph: dict[str, set[str]], start: str) -> set[str]:
    seen, todo = {start}, [start]
    while todo:
        for nxt in graph.get(todo.pop(), ()):
            if nxt not in seen:
                seen.add(nxt)
                todo.append(nxt)
    return seen


def workflow_violations(net: Net) -> list[str]:
    """Return what breaks the workflow-net property, per automation.

    Every control place and every transition that is neither a trigger nor an
    environment transition must be reachable from ``triggered`` and must reach
    ``done``.
    """
    forward = control_graph(net)
    backward: dict[str, set[str]] = defaultdict(set)
    for source, targets in forward.items():
        for target in targets:
            backward[target].add(source)
    problems = []
    for record in net.automations:
        start, end = f"p:{record.id}:triggered", f"p:{record.id}:done"
        places = {p.id for p in net.places if p.automation_id == record.id}
        transitions = {
            t.id
            for t in net.transitions
            if t.origin.automation_id == record.id and t.kind.value != "trigger"
        }
        if not places and not transitions:
            continue  # a record without a net (translation failed)
        if start not in places or end not in places:
            problems.append(f"{record.id}: triggered or done is missing")
            continue
        from_start = _reachable(forward, start)
        to_end = _reachable(backward, end)
        problems.extend(
            f"{record.id}: {element} is not reachable from triggered"
            for element in sorted((places | transitions) - from_start)
        )
        problems.extend(
            f"{record.id}: {element} cannot reach done"
            for element in sorted((places | transitions) - to_end)
        )
    return problems


def structure_violations(net: Net) -> list[str]:
    """Return every violation of the properties all translated nets share."""
    problems = list(net.problems())
    problems.extend(workflow_violations(net))
    for place in net.places:
        origin = place.origin
        if place.kind is PlaceKind.STATE:
            ok = origin.entity_id == place.entity_id
        else:
            ok = origin.automation_id == place.automation_id
        if not ok:
            problems.append(f"place {place.id}: origin does not match")
    for transition in net.transitions:
        origin = transition.origin
        if transition.kind.value == "environment":
            ok = origin.entity_id is not None
        else:
            ok = origin.automation_id is not None and origin.path is not None
        if not ok:
            problems.append(f"transition {transition.id}: no origin")
    for record in net.automations:
        if record.complete != (not record.opaque):
            problems.append(f"{record.id}: complete contradicts opaque")
    return problems
