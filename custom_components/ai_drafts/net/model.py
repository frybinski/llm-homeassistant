"""The net: frozen dataclasses and their JSON form (format version 1).

The JSON is specified in ``docs/net-mapping.md``. Where that document leaves the
exact field names open (control places, arcs, annotations), this module fixes
them; ``to_dict`` and ``from_dict`` are the one place that knows them.

This module is plain Python and knows nothing about Home Assistant.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import TYPE_CHECKING, Any, Final, Self

if TYPE_CHECKING:
    from collections.abc import Iterable, Mapping

FORMAT: Final = "ai_drafts.net"
VERSION: Final = 1

# Token of a state place that stands for "the entity, whatever its value".
ANY_STATE: Final = "*"


class NetError(Exception):
    """A net or its JSON is malformed; ``problems`` lists each violation."""

    def __init__(self, message: str, problems: Iterable[str] = ()) -> None:
        """Store the message and the individual problems."""
        super().__init__(message)
        self.problems = list(problems)


class PlaceKind(StrEnum):
    """What a place stands for."""

    STATE = "state"
    CONTROL = "control"


class TransitionKind(StrEnum):
    """What a transition does."""

    TRIGGER = "trigger"
    ACTION = "action"
    WAIT = "wait"
    BRANCH = "branch"
    FORK = "fork"
    JOIN = "join"
    LOOP = "loop"
    EXIT = "exit"
    CHECK = "check"
    STOP = "stop"
    SKIP = "skip"
    ENVIRONMENT = "environment"


class ArcKind(StrEnum):
    """Direction and meaning of an arc."""

    CONSUME = "consume"
    PRODUCE = "produce"
    READ = "read"
    WRITE = "write"


class ArcRole(StrEnum):
    """Whether a read arc is sensitive to change or to level."""

    TRIGGER = "trigger"
    CONDITION = "condition"


class Source(StrEnum):
    """Where an automation comes from."""

    UI = "ui"
    YAML = "yaml"
    PROPOSAL = "proposal"


def state_place_id(entity_id: str, state: str | None) -> str:
    """Return the id of the state place of an entity (``None``: any state)."""
    return f"p:{entity_id}:{ANY_STATE if state is None else state}"


def control_place_id(automation_id: str, name: str) -> str:
    """Return the id of a control place: ``triggered``, ``done`` or ``@<path>``."""
    return f"p:{automation_id}:{name}"


def _require_mapping(value: Any, what: str) -> Mapping[str, Any]:
    if not isinstance(value, dict):
        raise NetError(f"{what} must be an object")
    return value


def _require_list(value: Any, what: str) -> list[Any]:
    if not isinstance(value, list):
        raise NetError(f"{what} must be a list")
    return value


def _require_str(value: Any, what: str) -> str:
    if not isinstance(value, str) or not value:
        raise NetError(f"{what} must be a non-empty string")
    return value


def _optional_str(value: Any, what: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise NetError(f"{what} must be a string or null")
    return value


def _require_bool(value: Any, what: str) -> bool:
    if not isinstance(value, bool):
        raise NetError(f"{what} must be a boolean")
    return value


def _enum[E: StrEnum](enum_cls: type[E], value: Any, what: str) -> E:
    try:
        return enum_cls(value)
    except ValueError:
        raise NetError(f"{what} has invalid value {value!r}") from None


@dataclass(frozen=True, slots=True)
class Origin:
    """Where a net element comes from; only the known parts are set."""

    automation_id: str | None = None
    path: str | None = None
    entity_id: str | None = None
    area_id: str | None = None

    def to_dict(self) -> dict[str, str]:
        """Return the JSON form without the unknown parts."""
        return {
            key: value
            for key, value in (
                ("automation_id", self.automation_id),
                ("path", self.path),
                ("entity_id", self.entity_id),
                ("area_id", self.area_id),
            )
            if value is not None
        }

    @classmethod
    def from_dict(cls, data: Any) -> Self:
        """Parse the JSON form."""
        data = _require_mapping(data, "origin")
        return cls(
            automation_id=_optional_str(
                data.get("automation_id"), "origin.automation_id"
            ),
            path=_optional_str(data.get("path"), "origin.path"),
            entity_id=_optional_str(data.get("entity_id"), "origin.entity_id"),
            area_id=_optional_str(data.get("area_id"), "origin.area_id"),
        )


@dataclass(frozen=True, slots=True)
class Annotation:
    """Something a transition carries that the net structure does not express."""

    name: str
    value: Any = None

    def to_dict(self) -> dict[str, Any]:
        """Return the JSON form."""
        return {"name": self.name, "value": self.value}

    @classmethod
    def from_dict(cls, data: Any) -> Self:
        """Parse the JSON form."""
        data = _require_mapping(data, "annotation")
        return cls(_require_str(data.get("name"), "annotation.name"), data.get("value"))


@dataclass(frozen=True, slots=True)
class Opaque:
    """A part of an automation the net cannot express."""

    path: str
    reason: str

    def to_dict(self) -> dict[str, str]:
        """Return the JSON form."""
        return {"path": self.path, "reason": self.reason}

    @classmethod
    def from_dict(cls, data: Any) -> Self:
        """Parse the JSON form."""
        data = _require_mapping(data, "opaque entry")
        path = data.get("path")
        if not isinstance(path, str):
            raise NetError("opaque.path must be a string")
        return cls(path, _require_str(data.get("reason"), "opaque.reason"))


@dataclass(frozen=True, slots=True)
class AutomationRecord:
    """One automation: its modes, names and translation gaps."""

    id: str
    alias: str
    mode: str
    enabled: bool
    source: Source
    entity_id: str | None = None
    opaque: tuple[Opaque, ...] = ()

    @property
    def complete(self) -> bool:
        """Return False when anything limits what the net says."""
        return not self.opaque

    def to_dict(self) -> dict[str, Any]:
        """Return the JSON form."""
        return {
            "id": self.id,
            "entity_id": self.entity_id,
            "alias": self.alias,
            "mode": self.mode,
            "enabled": self.enabled,
            "source": self.source.value,
            "complete": self.complete,
            "opaque": [entry.to_dict() for entry in self.opaque],
        }

    @classmethod
    def from_dict(cls, data: Any) -> Self:
        """Parse the JSON form; ``complete`` must agree with ``opaque``."""
        data = _require_mapping(data, "automation")
        opaque = tuple(
            Opaque.from_dict(entry)
            for entry in _require_list(data.get("opaque"), "automation.opaque")
        )
        record = cls(
            id=_require_str(data.get("id"), "automation.id"),
            entity_id=_optional_str(data.get("entity_id"), "automation.entity_id"),
            alias=_require_str(data.get("alias"), "automation.alias"),
            mode=_require_str(data.get("mode"), "automation.mode"),
            enabled=_require_bool(data.get("enabled"), "automation.enabled"),
            source=_enum(Source, data.get("source"), "automation.source"),
            opaque=opaque,
        )
        if (
            _require_bool(data.get("complete"), "automation.complete")
            != record.complete
        ):
            raise NetError(f"automation {record.id}: complete contradicts opaque")
        return record


@dataclass(frozen=True, slots=True)
class Place:
    """A state place (``entity_id``, ``state``) or a control place."""

    id: str
    kind: PlaceKind
    origin: Origin
    entity_id: str | None = None
    state: str | None = None
    automation_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Return the JSON form."""
        if self.kind is PlaceKind.STATE:
            return {
                "id": self.id,
                "kind": self.kind.value,
                "entity_id": self.entity_id,
                "state": self.state,
                "origin": self.origin.to_dict(),
            }
        return {
            "id": self.id,
            "kind": self.kind.value,
            "automation_id": self.automation_id,
            "origin": self.origin.to_dict(),
        }

    @classmethod
    def from_dict(cls, data: Any) -> Self:
        """Parse the JSON form."""
        data = _require_mapping(data, "place")
        kind = _enum(PlaceKind, data.get("kind"), "place.kind")
        common = {
            "id": _require_str(data.get("id"), "place.id"),
            "kind": kind,
            "origin": Origin.from_dict(data.get("origin")),
        }
        if kind is PlaceKind.STATE:
            return cls(
                **common,
                entity_id=_require_str(data.get("entity_id"), "place.entity_id"),
                state=_optional_str(data.get("state"), "place.state"),
            )
        return cls(
            **common,
            automation_id=_require_str(
                data.get("automation_id"), "place.automation_id"
            ),
        )


@dataclass(frozen=True, slots=True)
class Transition:
    """Something that happens: a trigger, a step or a change from outside."""

    id: str
    kind: TransitionKind
    origin: Origin
    annotations: tuple[Annotation, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        """Return the JSON form."""
        return {
            "id": self.id,
            "kind": self.kind.value,
            "origin": self.origin.to_dict(),
            "annotations": [a.to_dict() for a in self.annotations],
        }

    @classmethod
    def from_dict(cls, data: Any) -> Self:
        """Parse the JSON form."""
        data = _require_mapping(data, "transition")
        return cls(
            id=_require_str(data.get("id"), "transition.id"),
            kind=_enum(TransitionKind, data.get("kind"), "transition.kind"),
            origin=Origin.from_dict(data.get("origin")),
            annotations=tuple(
                Annotation.from_dict(a)
                for a in _require_list(
                    data.get("annotations"), "transition.annotations"
                )
            ),
        )


@dataclass(frozen=True, slots=True)
class Arc:
    """A directed connection; ``source`` and ``target`` are element ids."""

    kind: ArcKind
    source: str
    target: str
    role: ArcRole | None = None

    @property
    def key(self) -> tuple[str, str, str, str | None]:
        """Return what makes an arc the same arc."""
        return (
            self.kind.value,
            self.source,
            self.target,
            self.role.value if self.role else None,
        )

    def to_dict(self) -> dict[str, Any]:
        """Return the JSON form; ``role`` only on read arcs."""
        data: dict[str, Any] = {
            "kind": self.kind.value,
            "source": self.source,
            "target": self.target,
        }
        if self.role is not None:
            data["role"] = self.role.value
        return data

    @classmethod
    def from_dict(cls, data: Any) -> Self:
        """Parse the JSON form."""
        data = _require_mapping(data, "arc")
        role = data.get("role")
        return cls(
            kind=_enum(ArcKind, data.get("kind"), "arc.kind"),
            source=_require_str(data.get("source"), "arc.source"),
            target=_require_str(data.get("target"), "arc.target"),
            role=None if role is None else _enum(ArcRole, role, "arc.role"),
        )


@dataclass(frozen=True, slots=True)
class Net:
    """A place/transition net with read and write arcs."""

    automations: tuple[AutomationRecord, ...] = ()
    places: tuple[Place, ...] = ()
    transitions: tuple[Transition, ...] = ()
    arcs: tuple[Arc, ...] = field(default=())

    def place(self, place_id: str) -> Place | None:
        """Return a place by id."""
        return next((p for p in self.places if p.id == place_id), None)

    def to_dict(self) -> dict[str, Any]:
        """Return the JSON form of the specification."""
        return {
            "format": FORMAT,
            "version": VERSION,
            "automations": [a.to_dict() for a in self.automations],
            "places": [p.to_dict() for p in self.places],
            "transitions": [t.to_dict() for t in self.transitions],
            "arcs": [a.to_dict() for a in self.arcs],
        }

    @classmethod
    def from_dict(cls, data: Any) -> Self:
        """Parse the JSON form; raise ``NetError`` when it is not version 1."""
        data = _require_mapping(data, "net")
        if data.get("format") != FORMAT:
            raise NetError(f"net.format must be {FORMAT!r}")
        if data.get("version") != VERSION:
            raise NetError(f"net.version must be {VERSION}")
        return cls(
            automations=tuple(
                AutomationRecord.from_dict(a)
                for a in _require_list(data.get("automations"), "net.automations")
            ),
            places=tuple(
                Place.from_dict(p)
                for p in _require_list(data.get("places"), "net.places")
            ),
            transitions=tuple(
                Transition.from_dict(t)
                for t in _require_list(data.get("transitions"), "net.transitions")
            ),
            arcs=tuple(
                Arc.from_dict(a) for a in _require_list(data.get("arcs"), "net.arcs")
            ),
        )

    def problems(self) -> list[str]:
        """Return every violation of the structural rules, in a stable order."""
        found: list[str] = []
        _check_unique(found, "automation", (a.id for a in self.automations))
        _check_unique(found, "place", (p.id for p in self.places))
        _check_unique(found, "transition", (t.id for t in self.transitions))
        _check_unique(found, "arc", (a.key for a in self.arcs))

        places = {p.id: p for p in self.places}
        transitions = {t.id: t for t in self.transitions}
        automation_ids = {a.id for a in self.automations}
        for place in self.places:
            if place.kind is PlaceKind.CONTROL and place.automation_id not in (
                automation_ids
            ):
                found.append(f"control place {place.id}: unknown automation")
        for transition in self.transitions:
            owner = transition.origin.automation_id
            if transition.kind is TransitionKind.ENVIRONMENT:
                if owner is not None:
                    found.append(f"transition {transition.id}: environment with owner")
            elif owner not in automation_ids:
                found.append(f"transition {transition.id}: unknown automation")

        for arc in self.arcs:
            place = places.get(arc.source if _starts_at_place(arc) else arc.target)
            transition = transitions.get(
                arc.target if _starts_at_place(arc) else arc.source
            )
            label = f"{arc.kind.value} arc {arc.source} -> {arc.target}"
            if place is None:
                found.append(f"{label}: no such place")
            if transition is None:
                found.append(f"{label}: no such transition")
            if place is not None:
                needs = (
                    PlaceKind.STATE
                    if arc.kind in (ArcKind.READ, ArcKind.WRITE)
                    else PlaceKind.CONTROL
                )
                if place.kind is not needs:
                    found.append(f"{label}: must touch a {needs.value} place")
            if arc.kind is ArcKind.READ and arc.role is None:
                found.append(f"{label}: read arc without role")
            if arc.kind is not ArcKind.READ and arc.role is not None:
                found.append(f"{label}: only read arcs have a role")
        return found

    def validate(self) -> None:
        """Raise ``NetError`` when a structural rule is violated."""
        if problems := self.problems():
            raise NetError("; ".join(problems), problems)


def _starts_at_place(arc: Arc) -> bool:
    """Return True for arcs that run from a place to a transition."""
    return arc.kind in (ArcKind.CONSUME, ArcKind.READ)


def _check_unique(found: list[str], what: str, keys: Iterable[object]) -> None:
    seen: set[object] = set()
    for key in keys:
        if key in seen:
            found.append(f"duplicate {what} {key}")
        seen.add(key)
