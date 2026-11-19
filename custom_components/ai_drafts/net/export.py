"""Export a net: JSON (the internal format) and PNML (for external tools).

PNML (ISO/IEC 15909-2) knows plain place/transition nets only. Read and write
arcs are expanded at export time, as ``docs/net-mapping.md`` describes:

- a ``read`` arc becomes an arc into the transition and an arc back;
- a ``write`` arc becomes, for every state place of the entity, one transition
  that takes the token from that place and puts it on the target. The place
  that is the target itself is the transition that leaves the token where it
  already is.

Kinds, roles, origins and annotations go into ``toolspecific`` elements. The
ids in PNML must be XML names, which ``p:light.a:on`` is not, so places and
transitions get the ids ``p1``, ``t1``, ... and carry the original id as their
name and in ``toolspecific``.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
import itertools
import json
from typing import TYPE_CHECKING, Any, Final
import xml.etree.ElementTree as ET

from .model import ArcKind, Net, Origin, PlaceKind

if TYPE_CHECKING:
    from collections.abc import Iterable, Sequence

PNML_NS: Final = "http://www.pnml.org/version-2009/grammar/pnml"
PTNET_TYPE: Final = "http://www.pnml.org/version-2009/grammar/ptnet"
TOOL: Final = "ai_drafts"
TOOL_VERSION: Final = "1"

# A transition with writes to many entities that each have several state places
# would expand to the product of their numbers. Beyond this many variants the
# writes are done one after the other, which is linear but no longer atomic.
MAX_VARIANTS: Final = 256


class ExportError(Exception):
    """The net cannot be exported."""


def export_json(net: Net) -> str:
    """Return the net as JSON text, in the format of the specification."""
    return json.dumps(net.to_dict(), indent=2, ensure_ascii=False) + "\n"


@dataclass(slots=True)
class _Node:
    """A place or transition of the expanded net."""

    id: str
    name: str
    tool: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class _Edge:
    source: str
    target: str
    tool: dict[str, Any] = field(default_factory=dict)


def _origin_tool(origin: Origin) -> dict[str, str]:
    return origin.to_dict()


class _Expansion:
    """The expanded net, built in memory before it is written as XML."""

    def __init__(self, net: Net) -> None:
        self.net = net
        self.places: list[_Node] = []
        self.transitions: list[_Node] = []
        self.edges: dict[tuple[str, str], _Edge] = {}
        self.place_ids: dict[str, str] = {}
        self.by_id = {place.id: place for place in net.places}
        self.entity_places: dict[str, list[str]] = defaultdict(list)

    def run(self) -> None:
        for place in self.net.places:
            node = _Node(
                f"p{len(self.places) + 1}",
                place.id,
                {
                    "element": place.id,
                    "kind": place.kind.value,
                    "origin": _origin_tool(place.origin),
                    **(
                        {"entity_id": place.entity_id, "state": place.state}
                        if place.kind is PlaceKind.STATE
                        else {"automation_id": place.automation_id}
                    ),
                },
            )
            self.places.append(node)
            self.place_ids[place.id] = node.id
            if place.kind is PlaceKind.STATE and place.entity_id is not None:
                self.entity_places[place.entity_id].append(place.id)

        arcs_of: dict[str, list[Any]] = defaultdict(list)
        for arc in self.net.arcs:
            owner = (
                arc.target
                if arc.kind in (ArcKind.CONSUME, ArcKind.READ)
                else arc.source
            )
            arcs_of[owner].append(arc)
        for transition in self.net.transitions:
            self._transition(transition, arcs_of[transition.id])

    def _edge(self, source: str, target: str, **tool: Any) -> None:
        self.edges.setdefault((source, target), _Edge(source, target, tool))

    def _new_transition(
        self, original: Any, label: str, extra: dict[str, Any] | None = None
    ) -> _Node:
        node = _Node(
            f"t{len(self.transitions) + 1}",
            label,
            {
                "element": original.id,
                "kind": original.kind.value,
                "origin": _origin_tool(original.origin),
                "annotations": [a.to_dict() for a in original.annotations],
                **(extra or {}),
            },
        )
        self.transitions.append(node)
        return node

    def _transition(self, transition: Any, arcs: list[Any]) -> None:
        consumes = [a.source for a in arcs if a.kind is ArcKind.CONSUME]
        produces = [a.target for a in arcs if a.kind is ArcKind.PRODUCE]
        reads = [a for a in arcs if a.kind is ArcKind.READ]
        writes = [a.target for a in arcs if a.kind is ArcKind.WRITE]
        options = [self.entity_places[self._entity(w)] for w in writes]
        total = 1
        for choice in options:
            total *= len(choice)

        if total <= MAX_VARIANTS:
            combos: Iterable[tuple[str, ...]] = itertools.product(*options)
            for combo in combos:
                label = transition.id
                moves = list(zip(combo, writes, strict=True))
                if moves:
                    label += " [" + ", ".join(f"{q} -> {p}" for q, p in moves) + "]"
                node = self._new_transition(
                    transition,
                    label,
                    {"moves": [{"from": q, "to": p} for q, p in moves]}
                    if moves
                    else None,
                )
                self._wire(node, consumes, produces, reads)
                for q, p in moves:
                    self._edge(self.place_ids[q], node.id, kind="write", part="take")
                    self._edge(node.id, self.place_ids[p], kind="write", part="put")
            return

        # Too many combinations: one stage per write, joined by control places.
        between: list[str] = []
        for index in range(1, len(writes)):
            node = _Node(
                f"p{len(self.places) + 1}",
                f"{transition.id}#{index}",
                {"element": transition.id, "kind": "expansion", "stage": index},
            )
            self.places.append(node)
            between.append(node.id)
        for index, (target, choice) in enumerate(zip(writes, options, strict=True)):
            first, last = index == 0, index == len(writes) - 1
            for q in choice:
                node = self._new_transition(
                    transition,
                    f"{transition.id} [{q} -> {target}]",
                    {"stage": index + 1, "moves": [{"from": q, "to": target}]},
                )
                self._wire(
                    node,
                    consumes if first else [],
                    produces if last else [],
                    reads if first else [],
                    extra_in=[] if first else [between[index - 1]],
                    extra_out=[] if last else [between[index]],
                )
                self._edge(self.place_ids[q], node.id, kind="write", part="take")
                self._edge(node.id, self.place_ids[target], kind="write", part="put")

    def _entity(self, place_id: str) -> str:
        place = self.by_id.get(place_id)
        if place is None or place.entity_id is None:
            raise ExportError(f"write arc to {place_id}, which is not a state place")
        return place.entity_id

    def _wire(
        self,
        node: _Node,
        consumes: list[str],
        produces: list[str],
        reads: list[Any],
        *,
        extra_in: Sequence[str] = (),
        extra_out: Sequence[str] = (),
    ) -> None:
        for place_id in consumes:
            self._edge(self.place_ids[place_id], node.id, kind="consume")
        for place_id in produces:
            self._edge(node.id, self.place_ids[place_id], kind="produce")
        for pid in extra_in:
            self._edge(pid, node.id, kind="stage")
        for pid in extra_out:
            self._edge(node.id, pid, kind="stage")
        for arc in reads:
            role = arc.role.value if arc.role else None
            self._edge(self.place_ids[arc.source], node.id, kind="read", role=role)
            self._edge(
                node.id,
                self.place_ids[arc.source],
                kind="read",
                role=role,
                part="return",
            )


def _tool_element(parent: ET.Element, tool: dict[str, Any]) -> None:
    element = ET.SubElement(
        parent, "toolspecific", {"tool": TOOL, "version": TOOL_VERSION}
    )
    for key, value in tool.items():
        if value is None:
            continue
        child = ET.SubElement(element, key)
        if key == "origin":
            for name, text in value.items():
                child.set(name, str(text))
        elif isinstance(value, str):
            child.text = value
        else:
            child.text = json.dumps(value, ensure_ascii=False, sort_keys=True)


def _named(parent: ET.Element, tag: str, node_id: str, name: str) -> ET.Element:
    element = ET.SubElement(parent, tag, {"id": node_id})
    label = ET.SubElement(element, "name")
    ET.SubElement(label, "text").text = name
    return element


def export_pnml(net: Net) -> str:
    """Return the net as a PNML place/transition net.

    Raises ``NetError`` when the net is structurally invalid.
    """
    net.validate()
    expansion = _Expansion(net)
    expansion.run()

    # The default namespace is set as an attribute, not registered: registering
    # would change how every other ElementTree user in the process serializes.
    root = ET.Element("pnml", {"xmlns": PNML_NS})
    net_element = ET.SubElement(
        root, "net", {"id": "ai_drafts_net", "type": PTNET_TYPE}
    )
    name = ET.SubElement(net_element, "name")
    ET.SubElement(name, "text").text = "AI Drafts net"
    page = ET.SubElement(net_element, "page", {"id": "page1"})
    for place in expansion.places:
        _tool_element(_named(page, "place", place.id, place.name), place.tool)
    for transition in expansion.transitions:
        _tool_element(
            _named(page, "transition", transition.id, transition.name), transition.tool
        )
    for index, edge in enumerate(expansion.edges.values(), start=1):
        arc = ET.SubElement(
            page,
            "arc",
            {"id": f"a{index}", "source": edge.source, "target": edge.target},
        )
        _tool_element(arc, edge.tool)
    ET.indent(root)
    body = ET.tostring(root, encoding="unicode")
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + body + "\n"
