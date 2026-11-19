"""Translate automations into nets (``docs/net-mapping.md``, format version 1).

``translate_automation`` is pure: configuration in, net out. Everything it needs
to know about the house comes through a ``Resolver``. ``async_build_net`` reads
the automations of a running instance, translates each one with a resolver
backed by ``hass``, and merges the result.

Paths in ids and origins refer to the configuration in its current form
(``triggers``, ``conditions``, ``actions``). The older singular spellings
(``trigger``, ``condition``, ``action``, ``platform``, ``service``) are read
too and get the same paths.
"""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from dataclasses import dataclass, field
import logging
from typing import TYPE_CHECKING, Any, Final, Protocol

from homeassistant.components import automation
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.helpers.target import (
    TargetSelection,
    async_extract_referenced_entity_ids,
)

from ..changeset import OperationKind, OperationType
from .effects import (
    INDIRECT_DOMAINS,
    INDIRECT_ENTITY_DOMAINS,
    INDIRECT_SERVICES,
    effect_state,
)
from .merge import add_environment_transitions, merge, remove_automation
from .model import (
    Annotation,
    Arc,
    ArcKind,
    ArcRole,
    AutomationRecord,
    Net,
    Opaque,
    Origin,
    Place,
    PlaceKind,
    Source,
    Transition,
    TransitionKind,
    control_place_id,
    state_place_id,
)
from .templates import is_template, template_entities

if TYPE_CHECKING:
    from collections.abc import Iterable, Sequence

    from homeassistant.core import HomeAssistant

    from ..changeset import ChangeSet

_LOGGER = logging.getLogger(__name__)

TRIGGERED: Final = "triggered"
DONE: Final = "done"

# Keys of a target that name entities indirectly.
_SELECTOR_KEYS: Final = ("device_id", "area_id", "floor_id", "label_id")
# Keys that are about the step, not about what it does.
_META_KEYS: Final = frozenset({"alias", "enabled", "continue_on_error", "id"})
_TRIGGER_META: Final = frozenset(
    {"trigger", "platform", "alias", "enabled", "variables"}
)
_CONDITION_META: Final = frozenset({"alias", "enabled", "entity_id"})
SUN_ENTITY: Final = "sun.sun"


class TranslationError(Exception):
    """An automation configuration cannot be read at all."""


class Resolver(Protocol):
    """What the translator needs to know about the house."""

    def resolve_target(self, kind: str, target_id: str) -> frozenset[str] | None:
        """Return the entities of an area, floor, label or device.

        ``kind`` is ``area_id``, ``floor_id``, ``label_id`` or ``device_id``.
        ``None`` means the target does not exist or cannot be resolved.
        """

    def area_of(self, entity_id: str) -> str | None:
        """Return the area of an entity, directly or through its device."""

    def template_entities(self, template: str) -> frozenset[str] | None:
        """Return the entities a template refers to, or None if undecidable."""


class StaticResolver:
    """A resolver over plain dictionaries, for tests and for offline use.

    Templates are read with the same syntax analysis the Home Assistant
    resolver uses.
    """

    def __init__(
        self,
        targets: Mapping[tuple[str, str], Iterable[str]] | None = None,
        areas: Mapping[str, str] | None = None,
    ) -> None:
        """Store ``{(kind, id): entities}`` and ``{entity_id: area_id}``."""
        self._targets = {k: frozenset(v) for k, v in (targets or {}).items()}
        self._areas = dict(areas or {})

    def resolve_target(self, kind: str, target_id: str) -> frozenset[str] | None:
        """Return the entities of a target, or None if it is unknown."""
        return self._targets.get((kind, target_id))

    def area_of(self, entity_id: str) -> str | None:
        """Return the area of an entity."""
        return self._areas.get(entity_id)

    def template_entities(self, template: str) -> frozenset[str] | None:
        """Return the entities a template refers to."""
        return template_entities(template)


# ----------------------------------------------------------------------------
# Reading configuration values


def _plain(value: Any) -> Any:
    """Return a JSON-safe copy: plain dicts, lists and scalars."""
    if isinstance(value, Mapping):
        return {str(k): _plain(v) for k, v in value.items()}
    if isinstance(value, list | tuple | set | frozenset):
        return [_plain(v) for v in value]
    if value is None or isinstance(value, bool | int | float):
        return value
    return str(value)


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list | tuple):
        return list(value)
    return [value]


def _state_text(value: Any) -> str:
    """Return a state as Home Assistant spells it (YAML turns on/off into bools)."""
    if isinstance(value, bool):
        return "on" if value else "off"
    return str(value)


def _settings(config: Mapping[str, Any], drop: Iterable[str]) -> dict[str, Any]:
    dropped = set(drop)
    return {str(k): _plain(v) for k, v in config.items() if k not in dropped}


def _normalize_condition(raw: Any) -> dict[str, Any]:
    """Return a condition in long form: a template string or shorthand becomes one."""
    if isinstance(raw, str):
        return {"condition": "template", "value_template": raw}
    if isinstance(raw, Mapping):
        if "condition" in raw:
            return dict(raw)
        for key in ("and", "or", "not"):
            if key in raw:
                rest = {k: v for k, v in raw.items() if k != key}
                return {**rest, "condition": key, "conditions": raw[key]}
        return dict(raw)
    return {"condition": None, "value": raw}


@dataclass(slots=True)
class _Guard:
    """What a condition or trigger contributes to a transition."""

    reads: list[tuple[str, str | None]] = field(default_factory=list)
    annotations: list[Annotation] = field(default_factory=list)

    def read(self, entity_id: str, state: str | None) -> None:
        if (entity_id, state) not in self.reads:
            self.reads.append((entity_id, state))

    def extend(self, other: _Guard) -> None:
        for read in other.reads:
            self.read(*read)
        self.annotations.extend(other.annotations)


# ----------------------------------------------------------------------------
# The builder of one automation's net


class _Builder:
    """Collects the elements of the net of one automation."""

    def __init__(self, automation_id: str, resolver: Resolver | None) -> None:
        self.aid = automation_id
        self.resolver = resolver
        self.places: dict[str, Place] = {}
        self.transitions: dict[str, Transition] = {}
        self.arcs: dict[tuple[str, str, str, str | None], Arc] = {}
        self.opaque_entries: list[Opaque] = []
        self._areas: dict[str, str | None] = {}
        self._control: dict[str, Place] = {}
        self._use(self.control(TRIGGERED))
        self._use(self.control(DONE))

    # -- elements ---------------------------------------------------------

    def opaque(self, path: str, reason: str) -> None:
        entry = Opaque(path, reason)
        if entry not in self.opaque_entries:
            self.opaque_entries.append(entry)

    def control(self, name: str) -> str:
        """Return the id of a control place.

        The place itself only comes into the net when an arc uses it, so a
        place computed for a step that never produces it leaves no trace.
        """
        place_id = control_place_id(self.aid, name)
        if place_id not in self._control:
            path = name[1:].removesuffix(":end") if name.startswith("@") else None
            self._control[place_id] = Place(
                id=place_id,
                kind=PlaceKind.CONTROL,
                origin=Origin(automation_id=self.aid, path=path),
                automation_id=self.aid,
            )
        return place_id

    def _use(self, place_id: str) -> None:
        """Put a control place into the net."""
        if place_id not in self.places:
            self.places[place_id] = self._control[place_id]

    def before(self, path: str) -> str:
        """Return the control place before the step at a config path."""
        return self.control(f"@{path}")

    def end_of(self, path: str) -> str:
        """Return the control place after the body of a structure at a path."""
        return self.control(f"@{path}:end")

    def state(self, entity_id: str, state: str | None) -> str:
        """Return the id of a state place, creating the place on first use."""
        place_id = state_place_id(entity_id, state)
        if place_id not in self.places:
            if entity_id not in self._areas:
                self._areas[entity_id] = (
                    self.resolver.area_of(entity_id) if self.resolver else None
                )
            self.places[place_id] = Place(
                id=place_id,
                kind=PlaceKind.STATE,
                origin=Origin(entity_id=entity_id, area_id=self._areas[entity_id]),
                entity_id=entity_id,
                state=state,
            )
        return place_id

    def _arc(
        self, kind: ArcKind, source: str, target: str, role: ArcRole | None = None
    ) -> None:
        arc = Arc(kind, source, target, role)
        self.arcs.setdefault(arc.key, arc)

    def emit(
        self,
        suffix: str,
        kind: TransitionKind,
        path: str,
        *,
        consume: Sequence[str] = (),
        produce: Sequence[str] = (),
        reads: Iterable[tuple[str, str | None, ArcRole]] = (),
        writes: Iterable[tuple[str, str | None]] = (),
        annotations: Iterable[Annotation] = (),
    ) -> str:
        """Add a transition with its arcs and return its id."""
        transition_id = f"t:{self.aid}:{suffix}"
        if transition_id in self.transitions:
            raise TranslationError(f"two transitions with the id {transition_id}")
        self.transitions[transition_id] = Transition(
            id=transition_id,
            kind=kind,
            origin=Origin(automation_id=self.aid, path=path),
            annotations=tuple(annotations),
        )
        for place_id in consume:
            self._use(place_id)
            self._arc(ArcKind.CONSUME, place_id, transition_id)
        for place_id in produce:
            self._use(place_id)
            self._arc(ArcKind.PRODUCE, transition_id, place_id)
        for entity_id, state, role in reads:
            self._arc(ArcKind.READ, self.state(entity_id, state), transition_id, role)
        for entity_id, state in writes:
            self._arc(ArcKind.WRITE, transition_id, self.state(entity_id, state))
        return transition_id

    # -- entities ---------------------------------------------------------

    def entity_refs(self, value: Any, path: str) -> list[str]:
        """Return the entities a config value names.

        A template is opaque here: what it reads is not what it names.
        """
        found: list[str] = []
        for item in _as_list(value):
            if not isinstance(item, str):
                continue
            if is_template(item):
                self.opaque(path, "entity_id is a template")
                continue
            for part in item.split(","):
                part = part.strip()
                if part == "all":
                    self.opaque(path, "entity_id 'all' stands for every entity")
                elif part and part != "none":
                    found.append(part)
        return list(dict.fromkeys(found))

    def template_guard(self, template: Any, path: str, guard: _Guard) -> None:
        """Add the read arcs of a template and record that it is opaque."""
        entities = None
        if isinstance(template, str) and self.resolver is not None:
            entities = self.resolver.template_entities(template)
        for entity_id in sorted(entities or ()):
            guard.read(entity_id, None)
        determined = "its entities are linked" if entities else "no entity is linked"
        self.opaque(path, f"template: the net does not evaluate it ({determined})")

    # -- conditions -------------------------------------------------------

    def conditions(self, raw: Any, path: str) -> _Guard:
        """Translate a list of conditions, as if they were listed directly."""
        guard = _Guard()
        for index, condition in enumerate(_as_list(raw)):
            self._condition(condition, f"{path}[{index}]", guard)
        return guard

    def _condition(self, raw: Any, path: str, guard: _Guard) -> None:
        cond = _normalize_condition(raw)
        if cond.get("enabled") is False:
            return
        kind = cond.get("condition")
        value = {"condition": kind, **_settings(cond, _CONDITION_META | {"condition"})}

        def annotate(extra: Mapping[str, Any] | None = None) -> None:
            guard.annotations.append(Annotation("guard", extra or value))

        if kind == "state":
            entities = self.entity_refs(cond.get("entity_id"), path)
            states = [_state_text(s) for s in _as_list(cond.get("state"))]
            plain_states = [s for s in states if not is_template(s)]
            if (
                cond.get("attribute") is not None
                or not states
                or len(states) != len(plain_states)
            ):
                for entity_id in entities:
                    guard.read(entity_id, None)
                annotate()
                if len(states) != len(plain_states):
                    self.opaque(path, "state is a template")
            else:
                for entity_id in entities:
                    for state in states:
                        guard.read(entity_id, state)
            if "for" in cond:
                guard.annotations.append(Annotation("for", _plain(cond["for"])))
        elif kind == "numeric_state":
            for entity_id in self.entity_refs(cond.get("entity_id"), path):
                guard.read(entity_id, None)
            annotate()
            if "value_template" in cond:
                self.opaque(path, "value_template: the net does not evaluate it")
        elif kind == "sun":
            guard.read(SUN_ENTITY, None)
            annotate()
        elif kind == "zone":
            for entity_id in self.entity_refs(cond.get("entity_id"), path):
                guard.read(entity_id, None)
            annotate()
        elif kind in ("time", "trigger"):
            annotate()
        elif kind == "template":
            annotate()
            self.template_guard(cond.get("value_template"), path, guard)
        elif kind == "and":
            guard.extend(self.conditions(cond.get("conditions"), f"{path}.conditions"))
        elif kind in ("or", "not"):
            annotate(_plain(cond))
            for entity_id in sorted(self._entities_inside(cond, path)):
                guard.read(entity_id, None)
            self.opaque(path, f"{kind}: the net cannot say which part must hold")
        elif kind == "device":
            annotate()
            self.opaque(path, "device condition")
        else:
            annotate()
            self.opaque(path, f"condition {kind!r} is not translated")

    def _entities_inside(self, cond: Mapping[str, Any], path: str) -> set[str]:
        """Return the entities mentioned anywhere inside a condition."""
        found: set[str] = set()
        for index, raw in enumerate(_as_list(cond.get("conditions"))):
            inner = _normalize_condition(raw)
            kind = inner.get("condition")
            where = f"{path}.conditions[{index}]"
            if kind in ("state", "numeric_state", "zone"):
                found.update(self.entity_refs(inner.get("entity_id"), where))
            elif kind == "sun":
                found.add(SUN_ENTITY)
            elif kind == "template" and isinstance(inner.get("value_template"), str):
                if self.resolver is not None:
                    found.update(
                        self.resolver.template_entities(inner["value_template"]) or ()
                    )
            elif kind in ("and", "or", "not"):
                found.update(self._entities_inside(inner, where))
        return found

    # -- triggers ---------------------------------------------------------

    def trigger(self, raw: Any, path: str) -> _Guard:
        """Return the read arcs (to be used with role trigger) and annotations."""
        guard = _Guard()
        if not isinstance(raw, Mapping):
            self.opaque(path, "trigger is not a mapping")
            return guard
        platform = raw.get("trigger", raw.get("platform"))
        if not isinstance(platform, str):
            self.opaque(path, "trigger without a platform")
            return guard
        event = {"platform": platform}

        if platform == "state":
            entities = self.entity_refs(raw.get("entity_id"), path)
            attribute = raw.get("attribute")
            to = raw.get("to")
            states = (
                []
                if to is None or attribute is not None
                else [_state_text(s) for s in _as_list(to)]
            )
            for entity_id in entities:
                if states:
                    for state in states:
                        guard.read(entity_id, state)
                else:
                    guard.read(entity_id, None)
            for key in ("from", "not_from", "not_to", "attribute", "for"):
                if raw.get(key) is not None:
                    guard.annotations.append(Annotation(key, _plain(raw[key])))
            if attribute is not None and to is not None:
                guard.annotations.append(Annotation("to", _plain(to)))
        elif platform == "numeric_state":
            for entity_id in self.entity_refs(raw.get("entity_id"), path):
                guard.read(entity_id, None)
            bounds = {
                key: _plain(raw[key])
                for key in ("above", "below", "attribute", "value_template")
                if key in raw
            }
            guard.annotations.append(Annotation("guard", bounds))
            if "for" in raw:
                guard.annotations.append(Annotation("for", _plain(raw["for"])))
            if "value_template" in raw:
                self.opaque(path, "value_template: the net does not evaluate it")
        elif platform == "sun":
            guard.read(SUN_ENTITY, None)
            guard.annotations.append(
                Annotation("event", {**event, **_settings(raw, _TRIGGER_META)})
            )
        elif platform == "zone":
            for entity_id in self.entity_refs(raw.get("entity_id"), path):
                guard.read(entity_id, None)
            settings = _settings(raw, _TRIGGER_META | {"entity_id"})
            guard.annotations.append(Annotation("event", {**event, **settings}))
        elif platform == "template":
            template = raw.get("value_template")
            guard.annotations.append(Annotation("template", _plain(template)))
            self.template_guard(template, path, guard)
            if "for" in raw:
                guard.annotations.append(Annotation("for", _plain(raw["for"])))
        else:
            guard.annotations.append(
                Annotation("event", {**event, **_settings(raw, _TRIGGER_META)})
            )
            if platform == "device":
                self.opaque(path, "device trigger")
        return guard

    # -- targets ----------------------------------------------------------

    def targets(
        self, step: Mapping[str, Any], path: str, domain: str
    ) -> tuple[list[str], list[Annotation]]:
        """Return the entities an action call targets and what to annotate."""
        sources = [
            (step.get("target"), f"{path}.target"),
            (step, path),
            (step.get("data"), f"{path}.data"),
            (step.get("data_template"), f"{path}.data_template"),
        ]
        direct: list[str] = []
        selectors: dict[str, list[str]] = {key: [] for key in _SELECTOR_KEYS}
        for source, where in sources:
            if not isinstance(source, Mapping):
                continue
            direct.extend(self.entity_refs(source.get("entity_id"), where))
            for key in _SELECTOR_KEYS:
                selectors[key].extend(
                    str(v) for v in _as_list(source.get(key)) if v is not None
                )
        entities = list(dict.fromkeys(direct))
        annotations: list[Annotation] = []
        unresolved: dict[str, list[str]] = {}
        for key in _SELECTOR_KEYS:
            for target_id in dict.fromkeys(selectors[key]):
                resolved = (
                    None
                    if is_template(target_id) or self.resolver is None
                    else self.resolver.resolve_target(key, target_id)
                )
                if resolved is None:
                    unresolved.setdefault(key, []).append(target_id)
                    continue
                # A service only acts on entities of its own domain, except the
                # generic ones of `homeassistant`.
                members = sorted(
                    e
                    for e in resolved
                    if domain in ("", "homeassistant") or e.startswith(f"{domain}.")
                )
                annotations.append(
                    Annotation(
                        "resolved_from",
                        {"kind": key, "id": target_id, "entities": members},
                    )
                )
                entities.extend(members)
        if unresolved:
            annotations.append(Annotation("target", unresolved))
            self.opaque(
                f"{path}.target",
                "target by "
                + ", ".join(sorted(unresolved))
                + (" cannot be resolved" if self.resolver else ": no resolver"),
            )
        return list(dict.fromkeys(entities)), annotations

    # -- steps ------------------------------------------------------------

    def sequence(self, steps: Any, base: str, entry: str, exit_: str) -> bool:
        """Translate steps one after another; return whether the run falls through."""
        step_list = _as_list(steps)
        if not step_list:
            self.emit(base, TransitionKind.SKIP, base, consume=[entry], produce=[exit_])
            return True
        last = len(step_list) - 1
        for index, step in enumerate(step_list):
            path = f"{base}[{index}]"
            place_in = entry if index == 0 else self.before(path)
            place_out = exit_ if index == last else self.before(f"{base}[{index + 1}]")
            if not self.step(step, path, place_in, place_out):
                if index < last:
                    self.opaque(
                        f"{base}[{index + 1}]",
                        "unreachable after a step that ends the run; not translated",
                    )
                return False
        return True

    def step(self, raw: Any, path: str, place_in: str, place_out: str) -> bool:
        """Translate one step; return False when the run cannot continue after it."""
        if not isinstance(raw, Mapping):
            self.opaque(path, "step is not a mapping")
            self._skip(path, place_in, place_out)
            return True
        if raw.get("enabled") is False:
            self._skip(path, place_in, place_out, [Annotation("disabled", True)])
            return True
        if "condition" in raw:
            return self._condition_step(raw, path, place_in, place_out)
        if "delay" in raw:
            self.emit(
                path,
                TransitionKind.WAIT,
                path,
                consume=[place_in],
                produce=[place_out],
                annotations=[Annotation("delay", _plain(raw["delay"]))],
            )
            return True
        if "wait_template" in raw:
            return self._wait_template(raw, path, place_in, place_out)
        if "wait_for_trigger" in raw:
            return self._wait_for_trigger(raw, path, place_in, place_out)
        if "event" in raw:
            self._skip(
                path,
                place_in,
                place_out,
                [Annotation("fires_event", _plain(raw["event"]))],
            )
            return True
        if "variables" in raw or "set_conversation_response" in raw:
            self._skip(path, place_in, place_out)
            return True
        if "stop" in raw:
            return self._stop(raw, path, place_in)
        if "choose" in raw:
            return self._choose(raw, path, place_in, place_out)
        if "if" in raw:
            return self._if(raw, path, place_in, place_out)
        if "repeat" in raw:
            return self._repeat(raw, path, place_in, place_out)
        if "parallel" in raw:
            return self._parallel(raw, path, place_in, place_out)
        if "sequence" in raw:
            return self.sequence(
                raw["sequence"], f"{path}.sequence", place_in, place_out
            )
        if "action" in raw or "service" in raw:
            return self._action(raw, path, place_in, place_out)
        if "scene" in raw:
            step = {"action": "scene.turn_on", "target": {"entity_id": raw["scene"]}}
            return self._action(step, path, place_in, place_out)
        self.opaque(
            path, "step of an unknown kind: " + ", ".join(sorted(map(str, raw)))
        )
        self._skip(path, place_in, place_out)
        return True

    def _skip(
        self,
        path: str,
        place_in: str,
        place_out: str,
        annotations: Iterable[Annotation] = (),
    ) -> None:
        self.emit(
            path,
            TransitionKind.SKIP,
            path,
            consume=[place_in],
            produce=[place_out],
            annotations=annotations,
        )

    def _condition_step(
        self, raw: Mapping[str, Any], path: str, place_in: str, place_out: str
    ) -> bool:
        guard = _Guard()
        self._condition({k: v for k, v in raw.items() if k != "alias"}, path, guard)
        roles = [(e, s, ArcRole.CONDITION) for e, s in guard.reads]
        self.emit(
            path,
            TransitionKind.SKIP,
            path,
            consume=[place_in],
            produce=[place_out],
            reads=roles,
            annotations=guard.annotations,
        )
        # Its sibling above carries the condition; this one is the way out.
        self.emit(
            f"{path}:stop",
            TransitionKind.STOP,
            path,
            consume=[place_in],
            produce=[self.control(DONE)],
        )
        return True

    def _stop(self, raw: Mapping[str, Any], path: str, place_in: str) -> bool:
        value: dict[str, Any] = {"reason": _plain(raw["stop"])}
        if "error" in raw:
            value["error"] = _plain(raw["error"])
        self.emit(
            path,
            TransitionKind.STOP,
            path,
            consume=[place_in],
            produce=[self.control(DONE)],
            annotations=[Annotation("stop", value)],
        )
        return False

    def _wait_template(
        self, raw: Mapping[str, Any], path: str, place_in: str, place_out: str
    ) -> bool:
        # The specification gives this step no read arcs, unlike template
        # triggers and conditions.
        annotations = [Annotation("template", _plain(raw["wait_template"]))]
        if "timeout" in raw:
            annotations.append(Annotation("timeout", _plain(raw["timeout"])))
        self.opaque(path, "template: the net does not evaluate it")
        self.emit(
            path,
            TransitionKind.WAIT,
            path,
            consume=[place_in],
            produce=[place_out],
            annotations=annotations,
        )
        return True

    def _wait_for_trigger(
        self, raw: Mapping[str, Any], path: str, place_in: str, place_out: str
    ) -> bool:
        guard = _Guard()
        for index, trigger in enumerate(_as_list(raw["wait_for_trigger"])):
            guard.extend(self.trigger(trigger, f"{path}.wait_for_trigger[{index}]"))
        if "timeout" in raw:
            guard.annotations.append(Annotation("timeout", _plain(raw["timeout"])))
        self.emit(
            path,
            TransitionKind.WAIT,
            path,
            consume=[place_in],
            produce=[place_out],
            reads=[(e, s, ArcRole.TRIGGER) for e, s in guard.reads],
            annotations=guard.annotations,
        )
        return True

    def _action(
        self, raw: Mapping[str, Any], path: str, place_in: str, place_out: str
    ) -> bool:
        name = raw.get("action", raw.get("service"))
        annotations = [Annotation("action", _plain(name))]
        if not isinstance(name, str) or is_template(name):
            self.opaque(path, "the action is a template")
            domain, service = "", ""
        else:
            domain, _, service = name.partition(".")
        entities, target_annotations = self.targets(raw, path, domain)
        annotations.extend(target_annotations)

        writes: list[tuple[str, str | None]] = []
        calls: list[str] = []
        if domain in INDIRECT_DOMAINS or name in INDIRECT_SERVICES:
            calls = entities or [str(name)]
        else:
            for entity_id in entities:
                entity_domain = entity_id.partition(".")[0]
                if (
                    domain == "homeassistant"
                    and entity_domain in INDIRECT_ENTITY_DOMAINS
                ):
                    calls.append(entity_id)
                else:
                    writes.append(
                        (entity_id, effect_state(domain, service, entity_domain))
                    )
        if calls:
            annotations.append(Annotation("calls", calls))
            self.opaque(
                path, "calls " + ", ".join(calls) + "; its effects are not followed"
            )
        self.emit(
            path,
            TransitionKind.ACTION,
            path,
            consume=[place_in],
            produce=[place_out],
            writes=writes,
            annotations=annotations,
        )
        return True

    def _alternative(
        self,
        path: str,
        steps: Any,
        steps_path: str,
        guard: _Guard,
        place_in: str,
        place_out: str,
    ) -> bool:
        """Add one branch transition and translate its steps."""
        step_list = _as_list(steps)
        first = self.before(f"{steps_path}[0]") if step_list else place_out
        self.emit(
            path,
            TransitionKind.BRANCH,
            path,
            consume=[place_in],
            produce=[first],
            reads=[(e, s, ArcRole.CONDITION) for e, s in guard.reads],
            annotations=guard.annotations,
        )
        if not step_list:
            return True
        return self.sequence(step_list, steps_path, first, place_out)

    def _choose(
        self, raw: Mapping[str, Any], path: str, place_in: str, place_out: str
    ) -> bool:
        falls = False
        for index, option in enumerate(_as_list(raw["choose"])):
            where = f"{path}.choose[{index}]"
            if not isinstance(option, Mapping):
                self.opaque(where, "choose option is not a mapping")
                continue
            guard = self.conditions(option.get("conditions"), f"{where}.conditions")
            falls |= self._alternative(
                where,
                option.get("sequence"),
                f"{where}.sequence",
                guard,
                place_in,
                place_out,
            )
        falls |= self._alternative(
            f"{path}.default",
            raw.get("default"),
            f"{path}.default",
            _Guard(),
            place_in,
            place_out,
        )
        return falls

    def _if(
        self, raw: Mapping[str, Any], path: str, place_in: str, place_out: str
    ) -> bool:
        guard = self.conditions(raw["if"], f"{path}.if")
        then = self._alternative(
            f"{path}.then", raw.get("then"), f"{path}.then", guard, place_in, place_out
        )
        other = self._alternative(
            f"{path}.else",
            raw.get("else"),
            f"{path}.else",
            _Guard(),
            place_in,
            place_out,
        )
        return then or other

    def _parallel(
        self, raw: Mapping[str, Any], path: str, place_in: str, place_out: str
    ) -> bool:
        branches = _as_list(raw["parallel"])
        if not branches:
            self._skip(path, place_in, place_out)
            return True
        starts: list[str] = []
        ends: list[str] = []
        for index, item in enumerate(branches):
            where = f"{path}.parallel[{index}]"
            start, end = self.before(where), self.end_of(where)
            starts.append(start)
            # A branch is one step; `sequence` is flattened by `step` itself.
            falls = self.step(item, where, start, end)
            if falls:
                ends.append(end)
            else:
                self.opaque(
                    where, "this branch ends the run; the join does not wait for it"
                )
        self.emit(
            f"{path}:fork",
            TransitionKind.FORK,
            path,
            consume=[place_in],
            produce=starts,
        )
        if not ends:
            return False
        self.emit(
            f"{path}:join", TransitionKind.JOIN, path, consume=ends, produce=[place_out]
        )
        return True

    def _repeat(
        self, raw: Mapping[str, Any], path: str, place_in: str, place_out: str
    ) -> bool:
        config = raw["repeat"]
        if not isinstance(config, Mapping):
            self.opaque(path, "repeat is not a mapping")
            self._skip(path, place_in, place_out)
            return True
        body = _as_list(config.get("sequence"))
        body_end = place_in
        if body:
            body_end = self.end_of(path)
            if not self.sequence(body, f"{path}.repeat.sequence", place_in, body_end):
                return False
        annotations = [
            Annotation("repeat", {key: _plain(config[key])})
            for key in ("count", "for_each")
            if key in config
        ]
        looping = self.conditions(config.get("while"), f"{path}.repeat.while")
        leaving = self.conditions(config.get("until"), f"{path}.repeat.until")
        for suffix, kind, target, guard in (
            ("loop", TransitionKind.LOOP, place_in, looping),
            ("exit", TransitionKind.EXIT, place_out, leaving),
        ):
            self.emit(
                f"{path}:{suffix}",
                kind,
                path,
                consume=[body_end],
                produce=[target],
                reads=[(e, s, ArcRole.CONDITION) for e, s in guard.reads],
                annotations=[*annotations, *guard.annotations],
            )
        return True


# ----------------------------------------------------------------------------
# Public translation


def _source(source: Source | str) -> Source:
    try:
        return Source(source)
    except ValueError:
        raise TranslationError(f"unknown source {source!r}") from None


def opaque_net(
    automation_id: str,
    reason: str,
    *,
    source: Source | str,
    entity_id: str | None = None,
    alias: str | None = None,
    mode: str = "single",
    enabled: bool = True,
    with_transition: bool = False,
) -> Net:
    """Return the net of an automation that could not be translated.

    With ``with_transition`` the net holds the two control places and one
    ``skip`` between them (a blueprint whose resolved configuration is not
    available); without, only the record is there.
    """
    record = AutomationRecord(
        id=automation_id,
        alias=alias or automation_id,
        mode=mode,
        enabled=enabled,
        source=_source(source),
        entity_id=entity_id,
        opaque=(Opaque("", reason),),
    )
    if not with_transition:
        return Net(automations=(record,))
    builder = _Builder(automation_id, None)
    builder.emit(
        "automation",
        TransitionKind.SKIP,
        "",
        consume=[builder.control(TRIGGERED)],
        produce=[builder.control(DONE)],
    )
    return Net(
        automations=(record,),
        places=tuple(builder.places.values()),
        transitions=tuple(builder.transitions.values()),
        arcs=tuple(builder.arcs.values()),
    )


def translate_automation(
    config: Mapping[str, Any],
    *,
    automation_id: str,
    source: Source | str,
    resolver: Resolver | None = None,
    entity_id: str | None = None,
    alias: str | None = None,
    enabled: bool = True,
) -> Net:
    """Translate the configuration of one automation into its net.

    Pure: no Home Assistant, no I/O. ``resolver`` answers what only the house
    knows; without it, targets by area, floor, label or device are opaque.
    """
    if not isinstance(config, Mapping):
        raise TranslationError("the automation configuration is not a mapping")
    source = _source(source)
    builder = _Builder(automation_id, resolver)
    mode = str(config.get("mode") or "single")
    triggered, done = builder.control(TRIGGERED), builder.control(DONE)

    triggers = config["triggers"] if "triggers" in config else config.get("trigger")
    conditions = (
        config["conditions"] if "conditions" in config else config.get("condition")
    )
    actions = config["actions"] if "actions" in config else config.get("action")

    guard = builder.conditions(conditions, "conditions")
    for index, raw in enumerate(_as_list(triggers)):
        path = f"triggers[{index}]"
        if isinstance(raw, Mapping) and raw.get("enabled") is False:
            continue
        trigger = builder.trigger(raw, path)
        builder.emit(
            path,
            TransitionKind.TRIGGER,
            path,
            produce=[triggered],
            reads=[
                *((e, s, ArcRole.TRIGGER) for e, s in trigger.reads),
                *((e, s, ArcRole.CONDITION) for e, s in guard.reads),
            ],
            annotations=[
                Annotation("mode", mode),
                *trigger.annotations,
                *guard.annotations,
            ],
        )
    builder.sequence(actions, "actions", triggered, done)

    record = AutomationRecord(
        id=automation_id,
        alias=alias or str(config.get("alias") or automation_id),
        mode=mode,
        enabled=enabled,
        source=source,
        entity_id=entity_id,
        opaque=tuple(builder.opaque_entries),
    )
    return Net(
        automations=(record,),
        places=tuple(builder.places.values()),
        transitions=tuple(builder.transitions.values()),
        arcs=tuple(builder.arcs.values()),
    )


# ----------------------------------------------------------------------------
# The house


class HassResolver:
    """A resolver backed by the registries of a running instance."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Keep the instance; answers are remembered, so use one per build."""
        self._hass = hass
        self._targets: dict[tuple[str, str], frozenset[str] | None] = {}

    def resolve_target(self, kind: str, target_id: str) -> frozenset[str] | None:
        """Resolve a target like a service call does; None if it does not exist."""
        key = (kind, target_id)
        if key not in self._targets:
            self._targets[key] = self._resolve(kind, target_id)
        return self._targets[key]

    def _resolve(self, kind: str, target_id: str) -> frozenset[str] | None:
        selected = async_extract_referenced_entity_ids(
            self._hass, TargetSelection({kind: target_id}), expand_group=False
        )
        if (
            selected.missing_areas
            or selected.missing_devices
            or selected.missing_floors
            or selected.missing_labels
        ):
            return None
        registry = er.async_get(self._hass)
        return frozenset(
            entity_id
            for entity_id in selected.indirectly_referenced
            if (entry := registry.async_get(entity_id)) is None
            or entry.disabled_by is None
        )

    def area_of(self, entity_id: str) -> str | None:
        """Return the area of an entity, or of its device."""
        entry = er.async_get(self._hass).async_get(entity_id)
        if entry is None:
            return None
        if entry.area_id:
            return entry.area_id
        if entry.device_id and (
            device := dr.async_get(self._hass).async_get(entry.device_id)
        ):
            return device.area_id
        return None

    def template_entities(self, template: str) -> frozenset[str] | None:
        """Return the entities a template refers to (syntax analysis)."""
        return template_entities(template)


def _entities_of_instance(hass: HomeAssistant) -> list[Any]:
    component = hass.data.get(automation.DATA_COMPONENT)
    if component is None:
        return []
    return sorted(component.entities, key=lambda e: str(e.entity_id))


def _automation_ids(entities: list[Any]) -> dict[str, str]:
    """Return the id of every automation entity, by entity id.

    An automation uses its own id; one without uses the object id of its
    entity. An id that is already taken by an automation with a real id gets a
    suffix, so that the one the editor knows keeps its id.
    """
    taken = {str(e.unique_id) for e in entities if e.unique_id}
    ids: dict[str, str] = {}
    for entity in entities:
        if entity.unique_id:
            ids[entity.entity_id] = str(entity.unique_id)
            continue
        candidate = str(entity.entity_id).partition(".")[2]
        while candidate in taken:
            candidate += "~yaml"
        taken.add(candidate)
        ids[entity.entity_id] = candidate
    return ids


def _translate_entity(entity: Any, automation_id: str, resolver: Resolver) -> Net:
    """Translate one automation entity; never raise."""
    source = Source.UI if entity.unique_id else Source.YAML
    config = getattr(entity, "raw_config", None)
    alias = getattr(entity, "name", None)
    enabled = bool(entity.is_on)
    common = {
        "source": source,
        "entity_id": str(entity.entity_id),
        "alias": str(alias) if alias else None,
        "enabled": enabled,
    }
    try:
        if isinstance(config, Mapping) and "use_blueprint" in config:
            # Home Assistant keeps the unresolved configuration only when the
            # blueprint could not be applied.
            return opaque_net(
                automation_id,
                "blueprint automation whose resolved configuration is not available",
                with_transition=True,
                **common,
            )
        if isinstance(entity, automation.UnavailableAutomationEntity):
            return opaque_net(
                automation_id,
                "the automation is unavailable: its configuration is invalid",
                **common,
            )
        if not isinstance(config, Mapping):
            return opaque_net(
                automation_id, "the configuration is not available", **common
            )
        return translate_automation(
            config, automation_id=automation_id, resolver=resolver, **common
        )
    except Exception as err:
        _LOGGER.debug("Cannot translate %s", entity.entity_id, exc_info=True)
        return opaque_net(
            automation_id,
            f"translation failed: {type(err).__name__}: {err}",
            **common,
        )


def _translate_operations(change_set: ChangeSet, net: Net, resolver: Resolver) -> Net:
    """Apply the automation operations of a change set to a net as proposals."""
    existing = {a.id: a for a in net.automations}
    for index, operation in enumerate(change_set.operations):
        if operation.kind is not OperationKind.AUTOMATION:
            continue
        if operation.op is OperationType.DELETE:
            net = remove_automation(net, str(operation.target_id))
            continue
        after = operation.after or {}
        if operation.op is OperationType.UPDATE:
            automation_id = str(operation.target_id)
        else:
            automation_id = str(after.get("id") or f"{change_set.id}_{index}")
        previous = existing.get(automation_id)
        net = remove_automation(net, automation_id)
        try:
            proposal = translate_automation(
                after,
                automation_id=automation_id,
                source=Source.PROPOSAL,
                resolver=resolver,
                entity_id=previous.entity_id if previous else None,
                enabled=previous.enabled if previous else True,
            )
        except Exception as err:
            proposal = opaque_net(
                automation_id,
                f"translation failed: {type(err).__name__}: {err}",
                source=Source.PROPOSAL,
            )
        net = merge(net, proposal)
    return net


async def async_build_net(
    hass: HomeAssistant,
    *,
    change_set: ChangeSet | None = None,
    environment: bool = False,
) -> Net:
    """Build the net of all automations of the instance.

    Automations from the editor and from YAML are included, enabled or not. One
    that cannot be translated becomes a record that says so. With a change
    set, its automation operations are translated as proposals and replace or
    extend what is there. With ``environment``, environment transitions are
    added for states nothing writes.
    """
    resolver = HassResolver(hass)
    entities = _entities_of_instance(hass)
    ids = _automation_ids(entities)
    nets = []
    for index, entity in enumerate(entities):
        nets.append(_translate_entity(entity, ids[entity.entity_id], resolver))
        if index % 25 == 24:
            await asyncio.sleep(0)  # a big house must not hold up the event loop
    net = merge(*nets)
    if change_set is not None:
        net = _translate_operations(change_set, net, resolver)
    if environment:
        net = add_environment_transitions(net)
    return net
