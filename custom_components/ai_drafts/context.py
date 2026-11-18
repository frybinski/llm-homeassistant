"""House model and selection of the part that is sent to the model.

``async_build_context`` reads the registries and the state machine and returns
exactly the data that leaves the installation in a prompt, so it is kept small:
no attribute dumps, no devices, no hidden or disabled entities. The selection
is deterministic (word matching, no model involved).
"""

from __future__ import annotations

from dataclasses import dataclass
import json
import re
from typing import TYPE_CHECKING, Any, Final

from homeassistant.components import automation
from homeassistant.helpers import (
    area_registry as ar,
    device_registry as dr,
    entity_registry as er,
)

if TYPE_CHECKING:
    from collections.abc import Iterable

    from homeassistant.core import HomeAssistant

DEFAULT_MAX_ENTITIES: Final = 150
DEFAULT_MAX_AUTOMATIONS: Final = 30
# Raw automation configs larger than this (as JSON text) are not sent.
MAX_AUTOMATION_CONFIG_CHARS: Final = 2000
MAX_STATE_CHARS: Final = 64
MIN_WORD_LENGTH: Final = 3
ALWAYS_INCLUDED: Final = "sun.sun"

# Automations are listed separately; everything else may be a target.
EXCLUDED_DOMAINS: Final = frozenset({"automation"})

# Order of the fallback when nothing in the request matches, and the tie breaker
# between equally scored matches. Domains not listed come last.
DOMAIN_PRIORITY: Final = (
    "light",
    "switch",
    "binary_sensor",
    "sensor",
    "climate",
    "cover",
    "fan",
    "lock",
    "media_player",
    "input_boolean",
    "scene",
    "script",
    "person",
    "sun",
)

# Weights of the places a request word can match.
_W_NAME: Final = 4
_W_ENTITY_ID: Final = 3
_W_AREA: Final = 3
_W_DEVICE: Final = 2
_AREA_MEMBER_BONUS: Final = 3

STOP_WORDS: Final = frozenset(
    [
        "aber",
        "alle",
        "allen",
        "als",
        "also",
        "auch",
        "auf",
        "aus",
        "bei",
        "beim",
        "bis",
        "bitte",
        "dann",
        "das",
        "dass",
        "dem",
        "den",
        "der",
        "des",
        "die",
        "dies",
        "diese",
        "diesem",
        "diesen",
        "dieser",
        "doch",
        "ein",
        "eine",
        "einem",
        "einen",
        "einer",
        "eines",
        "einmal",
        "erstelle",
        "erstellen",
        "fuer",
        "für",
        "gegen",
        "habe",
        "hat",
        "ich",
        "ihr",
        "immer",
        "ins",
        "ist",
        "jede",
        "jeden",
        "kann",
        "machen",
        "mach",
        "mal",
        "mehr",
        "mein",
        "meine",
        "mir",
        "mit",
        "nach",
        "nicht",
        "noch",
        "nur",
        "oder",
        "ohne",
        "schalte",
        "schalten",
        "sich",
        "sie",
        "sind",
        "soll",
        "sollen",
        "sowie",
        "über",
        "ueber",
        "und",
        "uns",
        "unter",
        "von",
        "vor",
        "was",
        "wenn",
        "werden",
        "wie",
        "wieder",
        "will",
        "wird",
        "wir",
        "zum",
        "zur",
        "zwischen",
        "minute",
        "minuten",
        "sekunde",
        "sekunden",
        "stunde",
        "stunden",
        "about",
        "after",
        "all",
        "also",
        "and",
        "any",
        "are",
        "because",
        "before",
        "but",
        "can",
        "create",
        "for",
        "from",
        "has",
        "have",
        "into",
        "make",
        "need",
        "not",
        "off",
        "once",
        "only",
        "our",
        "please",
        "should",
        "that",
        "the",
        "their",
        "them",
        "then",
        "there",
        "these",
        "they",
        "this",
        "those",
        "turn",
        "want",
        "when",
        "where",
        "which",
        "while",
        "will",
        "with",
        "would",
        "you",
        "your",
        "minute",
        "minutes",
        "second",
        "seconds",
        "hour",
        "hours",
    ]
)

_WORD_RE: Final = re.compile(r"[a-zäöüß0-9]+")


@dataclass(frozen=True, slots=True)
class ContextArea:
    """An area the model may target."""

    id: str
    name: str

    def to_dict(self) -> dict[str, str]:
        """Return the compact prompt form."""
        return {"id": self.id, "name": self.name}


@dataclass(frozen=True, slots=True)
class ContextEntity:
    """An entity the model may use. Deliberately without attributes."""

    entity_id: str
    name: str
    domain: str
    device_class: str | None
    area: str | None
    state: str
    unit: str | None

    def to_dict(self) -> dict[str, str]:
        """Return the compact prompt form; empty fields are left out."""
        data = {
            "entity_id": self.entity_id,
            "name": self.name,
            "domain": self.domain,
            "device_class": self.device_class,
            "area": self.area,
            "state": self.state,
            "unit": self.unit,
        }
        return {k: v for k, v in data.items() if v}


@dataclass(frozen=True, slots=True)
class ContextAutomation:
    """An existing automation that relates to the request."""

    id: str | None
    alias: str | None
    entity_id: str
    # None when the config is too large to send; see ``config_omitted``.
    config: dict[str, Any] | None
    config_omitted: bool

    def to_dict(self) -> dict[str, Any]:
        """Return the compact prompt form."""
        data: dict[str, Any] = {
            "id": self.id,
            "alias": self.alias,
            "entity_id": self.entity_id,
        }
        if self.config_omitted:
            data["config_omitted"] = True
        else:
            data["config"] = self.config
        return {k: v for k, v in data.items() if v is not None}


@dataclass(frozen=True, slots=True)
class DraftContext:
    """The selected part of the house, as sent to the model."""

    areas: tuple[ContextArea, ...]
    entities: tuple[ContextEntity, ...]
    automations: tuple[ContextAutomation, ...]
    # True when more entities or automations matched than the caps allow.
    truncated: bool
    # "matched" when words of the request selected entities, else "fallback".
    selection: str

    def to_prompt_dict(self) -> dict[str, Any]:
        """Return compact, JSON-serialisable data for the prompt."""
        return {
            "areas": [a.to_dict() for a in self.areas],
            "entities": [e.to_dict() for e in self.entities],
            "existing_automations": [a.to_dict() for a in self.automations],
            "truncated": self.truncated,
        }

    @property
    def size(self) -> int:
        """Return the size of the prompt data as JSON text, in characters."""
        return len(json.dumps(self.to_prompt_dict(), separators=(",", ":")))


def tokenize(request: str) -> list[str]:
    """Return the distinct search words of a request, in order."""
    seen: dict[str, None] = {}
    for word in _WORD_RE.findall(request.lower()):
        if len(word) >= MIN_WORD_LENGTH and word not in STOP_WORDS:
            seen[word] = None
    return list(seen)


def _words(text: str) -> list[str]:
    return [w for w in _WORD_RE.findall(text.lower()) if len(w) >= MIN_WORD_LENGTH]


def _text_matches(tokens: Iterable[str], text: str) -> bool:
    """Return True if a token is in the text or a word of the text is in a token.

    The second direction finds German compounds: the request word "flurlicht"
    contains the area name "Flur".
    """
    if not text:
        return False
    lowered = text.lower()
    words = _words(text)
    for token in tokens:
        if token in lowered:
            return True
        if any(word in token for word in words):
            return True
    return False


def _domain_rank(domain: str) -> int:
    try:
        return DOMAIN_PRIORITY.index(domain)
    except ValueError:
        return len(DOMAIN_PRIORITY)


@dataclass(slots=True)
class _Candidate:
    entity: ContextEntity
    area_id: str | None
    device_name: str
    score: int = 0


def _collect_candidates(hass: HomeAssistant) -> list[_Candidate]:
    """Return every usable entity with the facts needed for matching."""
    ent_reg = er.async_get(hass)
    dev_reg = dr.async_get(hass)
    area_reg = ar.async_get(hass)
    candidates: list[_Candidate] = []
    for state in hass.states.async_all():
        domain = state.domain
        if domain in EXCLUDED_DOMAINS:
            continue
        entry = ent_reg.async_get(state.entity_id)
        if entry is not None and (entry.disabled_by or entry.hidden_by):
            continue
        device = (
            dev_reg.async_get(entry.device_id) if entry and entry.device_id else None
        )
        area_id = (entry.area_id if entry else None) or (
            device.area_id if device else None
        )
        area = area_reg.async_get_area(area_id) if area_id else None
        name = state.attributes.get("friendly_name") or (
            (entry.name or entry.original_name) if entry else None
        )
        device_class = state.attributes.get("device_class") or (
            (entry.device_class or entry.original_device_class) if entry else None
        )
        unit = state.attributes.get("unit_of_measurement")
        candidates.append(
            _Candidate(
                entity=ContextEntity(
                    entity_id=state.entity_id,
                    name=str(name or state.entity_id),
                    domain=domain,
                    device_class=str(device_class) if device_class else None,
                    area=area.name if area else None,
                    state=state.state[:MAX_STATE_CHARS],
                    unit=str(unit) if unit else None,
                ),
                area_id=area.id if area else None,
                device_name=(
                    (device.name_by_user or device.name or "") if device else ""
                ),
            )
        )
    return candidates


def _score(candidate: _Candidate, tokens: list[str]) -> int:
    entity = candidate.entity
    score = 0
    for weight, text in (
        (_W_NAME, entity.name),
        (_W_ENTITY_ID, entity.entity_id.split(".", 1)[1].replace("_", " ")),
        (_W_AREA, entity.area or ""),
        (_W_DEVICE, candidate.device_name),
    ):
        score += weight * sum(1 for t in tokens if _text_matches([t], text))
    return score


def _ranked(candidates: Iterable[_Candidate]) -> list[_Candidate]:
    return sorted(
        candidates,
        key=lambda c: (
            -c.score,
            _domain_rank(c.entity.domain),
            c.entity.entity_id,
        ),
    )


def _select_entities(
    candidates: list[_Candidate], tokens: list[str], max_entities: int
) -> tuple[list[_Candidate], bool, str]:
    """Return (selected, truncated, selection kind)."""
    area_reg_names = {c.area_id: c.entity.area for c in candidates if c.area_id}
    matched_areas = {
        area_id
        for area_id, name in area_reg_names.items()
        if name and _text_matches(tokens, name)
    }
    matches: list[_Candidate] = []
    for candidate in candidates:
        candidate.score = _score(candidate, tokens)
        if candidate.area_id in matched_areas:
            candidate.score += _AREA_MEMBER_BONUS
        if candidate.score > 0:
            matches.append(candidate)

    always = next(
        (c for c in candidates if c.entity.entity_id == ALWAYS_INCLUDED), None
    )
    if not matches:
        ordered = sorted(
            candidates,
            key=lambda c: (_domain_rank(c.entity.domain), c.entity.entity_id),
        )
        return ordered[:max_entities], len(ordered) > max_entities, "fallback"

    ranked = [c for c in _ranked(matches) if c is not always]
    reserved = 1 if always is not None else 0
    truncated = len(ranked) + reserved > max_entities
    selected = ranked[: max(max_entities - reserved, 0)]
    if always is not None:
        selected.append(always)
    return selected, truncated, "matched"


def _automation_entry(entity: Any) -> ContextAutomation:
    raw = getattr(entity, "raw_config", None)
    config: dict[str, Any] | None = None
    omitted = True
    if isinstance(raw, dict):
        # json round trip: drops tags and non-JSON types, and measures the size.
        text = json.dumps(raw, default=str, separators=(",", ":"))
        if len(text) <= MAX_AUTOMATION_CONFIG_CHARS:
            config = json.loads(text)
            omitted = False
    alias = raw.get("alias") if isinstance(raw, dict) else None
    return ContextAutomation(
        id=str(entity.unique_id) if entity.unique_id else None,
        alias=str(alias) if alias else getattr(entity, "name", None),
        entity_id=entity.entity_id,
        config=config,
        config_omitted=omitted,
    )


def _select_automations(
    hass: HomeAssistant,
    selected_ids: set[str],
    tokens: list[str],
    max_automations: int,
) -> tuple[list[ContextAutomation], bool]:
    component = hass.data.get(automation.DATA_COMPONENT)
    if component is None:
        return [], False
    scored: list[tuple[int, str, Any]] = []
    for entity in component.entities:
        try:
            overlap = len(entity.referenced_entities & selected_ids)
        except Exception:
            overlap = 0
        alias = getattr(entity, "name", None) or ""
        alias_match = _text_matches(tokens, alias)
        if overlap or alias_match:
            scored.append((overlap + (1 if alias_match else 0), alias, entity))
    scored.sort(key=lambda item: (-item[0], item[1].lower()))
    truncated = len(scored) > max_automations
    return [_automation_entry(e) for _, _, e in scored[:max_automations]], truncated


async def async_build_context(
    hass: HomeAssistant,
    request: str,
    *,
    max_entities: int = DEFAULT_MAX_ENTITIES,
    max_automations: int = DEFAULT_MAX_AUTOMATIONS,
) -> DraftContext:
    """Select the part of the house that is relevant to a request."""
    tokens = tokenize(request)
    candidates = _collect_candidates(hass)
    selected, truncated, kind = _select_entities(candidates, tokens, max_entities)
    selected.sort(key=lambda c: c.entity.entity_id)

    selected_ids = {c.entity.entity_id for c in selected}
    automations, automations_truncated = _select_automations(
        hass, selected_ids, tokens, max_automations
    )

    area_reg = ar.async_get(hass)
    area_ids = {c.area_id for c in selected if c.area_id}
    areas = sorted(
        (
            ContextArea(area.id, area.name)
            for area_id in area_ids
            if (area := area_reg.async_get_area(area_id)) is not None
        ),
        key=lambda a: a.name.lower(),
    )
    return DraftContext(
        areas=tuple(areas),
        entities=tuple(c.entity for c in selected),
        automations=tuple(automations),
        truncated=truncated or automations_truncated,
        selection=kind,
    )
