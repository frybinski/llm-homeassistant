"""Stage A checks: is the configuration valid and does it refer to real things?

Everything here is deterministic and works on the configuration alone. The
findings are what the repair loop sends back to the model, so each message says
what is wrong and, where cheap, what to use instead.
"""

from __future__ import annotations

import difflib
import logging
import re
from typing import TYPE_CHECKING, Any, Final

from homeassistant.components import automation
from homeassistant.components.automation.config import async_validate_config_item
from homeassistant.const import (
    CONF_ACTION,
    CONF_ACTIONS,
    CONF_CONDITIONS,
    CONF_TRIGGERS,
    ENTITY_MATCH_ALL,
    ENTITY_MATCH_NONE,
)
from homeassistant.exceptions import HomeAssistantError, TemplateError
from homeassistant.helpers import (
    area_registry as ar,
    condition as condition_helper,
    device_registry as dr,
    entity_registry as er,
    script,
    trigger as trigger_helper,
)
from homeassistant.helpers.template import Template
import voluptuous as vol

from ..changeset import Finding, OperationKind, OperationType, Severity

if TYPE_CHECKING:
    from collections.abc import Iterator

    from homeassistant.core import HomeAssistant

    from ..changeset import ChangeSet, Operation

_LOGGER = logging.getLogger(__name__)

# Names that only exist while an automation runs; a template using one cannot be
# rendered ahead of time.
RUNTIME_VARIABLES: Final = frozenset({"trigger", "this", "repeat", "wait", "context"})
# Top-level keys whose text is plain text, not a template.
PLAIN_TEXT_KEYS: Final = frozenset({"alias", "description", "id"})
_TEMPLATE_MARKERS: Final = ("{{", "{%", "{#")
_SERVICE_RE: Final = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")
_IDENT_RE: Final = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


def _finding(
    severity: Severity, name: str, message: str, path: str | None = None
) -> Finding:
    return Finding(severity, f"validity.{name}", message, path)


def _fmt_path(base: str, keys: list[Any]) -> str:
    path = base
    for key in keys:
        path += f"[{key}]" if isinstance(key, int) else f".{key}"
    return path


def _has_template(value: str) -> bool:
    return any(marker in value for marker in _TEMPLATE_MARKERS)


def _contains_template(value: Any) -> bool:
    if isinstance(value, str):
        return _has_template(value)
    if isinstance(value, dict):
        return any(_contains_template(v) for v in value.values())
    if isinstance(value, list):
        return any(_contains_template(v) for v in value)
    return False


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


# --- walkers over the raw configuration (they give the finding paths) ----------


def _iter_strings(value: Any, path: str) -> Iterator[tuple[str, str]]:
    """Yield (path, text) for every string value, however deeply nested."""
    if isinstance(value, str):
        yield path, value
    elif isinstance(value, dict):
        for key, item in value.items():
            yield from _iter_strings(item, f"{path}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from _iter_strings(item, f"{path}[{index}]")


def _iter_steps(actions: Any, path: str) -> Iterator[tuple[str, dict[str, Any]]]:
    """Yield (path, step) for every action step, including nested ones."""
    if isinstance(actions, dict):
        actions = [actions]
    if not isinstance(actions, list):
        return
    for index, step in enumerate(actions):
        if not isinstance(step, dict):
            continue
        step_path = f"{path}[{index}]"
        yield step_path, step
        for choice_index, choice in enumerate(_as_list(step.get("choose"))):
            if isinstance(choice, dict):
                yield from _iter_steps(
                    choice.get("sequence"),
                    f"{step_path}.choose[{choice_index}].sequence",
                )
        yield from _iter_steps(step.get("default"), f"{step_path}.default")
        yield from _iter_steps(step.get("then"), f"{step_path}.then")
        yield from _iter_steps(step.get("else"), f"{step_path}.else")
        repeat = step.get("repeat")
        if isinstance(repeat, dict):
            yield from _iter_steps(
                repeat.get("sequence"), f"{step_path}.repeat.sequence"
            )
        yield from _iter_steps(step.get("sequence"), f"{step_path}.sequence")
        for par_index, branch in enumerate(_as_list(step.get("parallel"))):
            if isinstance(branch, dict) and "sequence" in branch:
                yield from _iter_steps(
                    branch["sequence"], f"{step_path}.parallel[{par_index}].sequence"
                )
            else:
                yield from _iter_steps(branch, f"{step_path}.parallel[{par_index}]")


def _find_id_paths(value: Any, path: str, wanted: set[str]) -> dict[str, str]:
    """Return the first path at which each wanted id appears as a string."""
    found: dict[str, str] = {}

    def visit(item: Any, item_path: str) -> None:
        if isinstance(item, str):
            for part in (p.strip() for p in item.split(",")):
                if part in wanted and part not in found:
                    found[part] = item_path
        elif isinstance(item, dict):
            for key, child in item.items():
                visit(child, f"{item_path}.{key}")
        elif isinstance(item, list):
            for index, child in enumerate(item):
                visit(child, f"{item_path}[{index}]")

    visit(value, path)
    return found


def _variable_names(after: dict[str, Any]) -> set[str]:
    """Names the automation defines itself (variables, response variables)."""
    names: set[str] = set()

    def visit(item: Any) -> None:
        if isinstance(item, dict):
            for key, child in item.items():
                if key in ("variables", "trigger_variables") and isinstance(
                    child, dict
                ):
                    names.update(str(k) for k in child)
                if key == "response_variable" and isinstance(child, str):
                    names.add(child)
                visit(child)
        elif isinstance(item, list):
            for child in item:
                visit(child)

    visit(after)
    return names


# --- the individual checks -----------------------------------------------------


async def _check_schema(
    hass: HomeAssistant, after: dict[str, Any], base: str
) -> tuple[dict[str, Any] | None, list[Finding]]:
    """Validate with Home Assistant's own automation validation."""
    try:
        validated = await async_validate_config_item(hass, "", dict(after))
    except vol.Invalid as err:
        errors = getattr(err, "errors", None) or [err]
        findings = []
        for error in errors:
            path = _fmt_path(base, list(error.path))
            findings.append(
                _finding(
                    Severity.ERROR,
                    "schema",
                    f"Home Assistant rejects the automation: {error.msg} "
                    f"(at {path.removeprefix(base).lstrip('.') or 'top level'})",
                    path,
                )
            )
        return None, findings
    except HomeAssistantError as err:
        return None, [
            _finding(
                Severity.ERROR,
                "schema",
                f"Home Assistant rejects the automation: {err}",
                base,
            )
        ]
    return validated, []


def _entity_exists(
    hass: HomeAssistant, ent_reg: er.EntityRegistry, entity_id: str
) -> bool:
    return hass.states.get(entity_id) is not None or entity_id in ent_reg.entities


def _check_references(
    hass: HomeAssistant, validated: dict[str, Any], after: dict[str, Any], base: str
) -> list[Finding]:
    """Entities, devices and areas used anywhere must exist."""
    entities: set[str] = set()
    devices: set[str] = set()
    areas: set[str] = set()
    for trigger in validated.get(CONF_TRIGGERS) or []:
        entities.update(trigger_helper.async_extract_entities(trigger))
        devices.update(trigger_helper.async_extract_devices(trigger))
        areas.update(trigger_helper.async_extract_targets(trigger, "area_id"))
    for cond in validated.get(CONF_CONDITIONS) or []:
        entities |= condition_helper.async_extract_entities(cond)
        devices |= condition_helper.async_extract_devices(cond)
        areas |= condition_helper.async_extract_targets(cond, "area_id")
    if actions := validated.get(CONF_ACTIONS):
        sequence = script.Script(
            hass, actions, "ai_drafts check", automation.DOMAIN, top_level=False
        )
        entities |= sequence.referenced_entities
        devices |= sequence.referenced_devices
        areas |= sequence.referenced_areas

    entities = {
        e
        for e in entities
        if isinstance(e, str) and e not in (ENTITY_MATCH_ALL, ENTITY_MATCH_NONE)
    }
    ent_reg = er.async_get(hass)
    dev_reg = dr.async_get(hass)
    area_reg = ar.async_get(hass)
    missing_entities = {e for e in entities if not _entity_exists(hass, ent_reg, e)}
    missing_devices = {d for d in devices if dev_reg.async_get(d) is None}
    missing_areas = {a for a in areas if area_reg.async_get_area(a) is None}
    paths = _find_id_paths(
        after, base, missing_entities | missing_devices | missing_areas
    )

    findings: list[Finding] = []
    known_entities = [s.entity_id for s in hass.states.async_all()]
    for entity_id in sorted(missing_entities):
        hint = difflib.get_close_matches(entity_id, known_entities, n=3)
        suggestion = f" Did you mean {', '.join(hint)}?" if hint else ""
        findings.append(
            _finding(
                Severity.ERROR,
                "entity",
                f"Entity '{entity_id}' does not exist.{suggestion} "
                "Use only entity ids from the context.",
                paths.get(entity_id, base),
            )
        )
    findings.extend(
        _finding(
            Severity.ERROR,
            "device",
            f"Device '{device_id}' does not exist. Address devices through "
            "their entities instead.",
            paths.get(device_id, base),
        )
        for device_id in sorted(missing_devices)
    )
    findings.extend(
        _finding(
            Severity.ERROR,
            "area",
            f"Area '{area_id}' does not exist. Use only area ids from the context.",
            paths.get(area_id, base),
        )
        for area_id in sorted(missing_areas)
    )
    return findings


def _check_services(
    hass: HomeAssistant, after: dict[str, Any], base: str
) -> list[Finding]:
    """Every called service must exist, and its schema must accept the data."""
    findings: list[Finding] = []
    actions_key = CONF_ACTIONS if CONF_ACTIONS in after else CONF_ACTION
    services = hass.services.async_services_internal()
    for step_path, step in _iter_steps(after.get(actions_key), f"{base}.{actions_key}"):
        name = step.get("action", step.get("service"))
        if not isinstance(name, str) or _has_template(name):
            continue
        if not _SERVICE_RE.match(name):
            continue
        domain, service = name.split(".", 1)
        call_path = f"{step_path}.action"
        registered = services.get(domain, {}).get(service)
        if registered is None:
            candidates = [
                f"{d}.{s}" for d, by_domain in services.items() for s in by_domain
            ]
            hint = difflib.get_close_matches(name, candidates, n=3)
            suggestion = f" Did you mean {', '.join(hint)}?" if hint else ""
            findings.append(
                _finding(
                    Severity.ERROR,
                    "service",
                    f"Service '{name}' does not exist.{suggestion}",
                    call_path,
                )
            )
            continue
        schema = registered.schema
        if schema is None:
            continue
        parts = {
            key: step[key]
            for key in ("entity_id", "target", "data", "data_template")
            if key in step
        }
        if _contains_template(parts):
            continue
        # Like a script run: target, data and a top-level entity_id are merged.
        call_data: dict[str, Any] = {}
        for key, part in parts.items():
            if key == "entity_id":
                call_data["entity_id"] = part
            elif isinstance(part, dict):
                call_data.update(part)
        try:
            schema(call_data)
        except vol.Invalid as err:
            for error in getattr(err, "errors", None) or [err]:
                where = ".".join(str(k) for k in error.path)
                findings.append(
                    _finding(
                        Severity.ERROR,
                        "service_data",
                        f"The data of '{name}' is not valid: {error.msg}"
                        + (f" (field '{where}')" if where else ""),
                        f"{step_path}.data" + (f".{where}" if where else ""),
                    )
                )
        except Exception as err:
            _LOGGER.debug("Schema of %s raised %r", name, err)
    return findings


def _check_templates(
    hass: HomeAssistant, after: dict[str, Any], base: str
) -> list[Finding]:
    """Templates must parse; those without run-time variables must also render."""
    findings: list[Finding] = []
    own_variables = _variable_names(after)
    for key, value in after.items():
        if key in PLAIN_TEXT_KEYS:
            continue
        for path, text in _iter_strings(value, f"{base}.{key}"):
            if not _has_template(text):
                continue
            template = Template(text, hass)
            try:
                template.ensure_valid()
            except TemplateError as err:
                findings.append(
                    _finding(
                        Severity.ERROR,
                        "template",
                        f"The template is not valid: {err}",
                        path,
                    )
                )
                continue
            used = set(_IDENT_RE.findall(text))
            if used & (RUNTIME_VARIABLES | own_variables):
                continue
            try:
                template.async_render(parse_result=False, strict=True)
            except TemplateError as err:
                findings.append(
                    _finding(
                        Severity.WARNING,
                        "template_render",
                        f"The template is valid but fails when rendered now: {err}",
                        path,
                    )
                )
    return findings


def _existing_automations(hass: HomeAssistant) -> list[tuple[str, str | None, str]]:
    """Return (entity_id, id, alias) of the loaded automations."""
    component = hass.data.get(automation.DATA_COMPONENT)
    if component is None:
        return []
    existing = []
    for entity in component.entities:
        raw = getattr(entity, "raw_config", None)
        alias = raw.get("alias") if isinstance(raw, dict) else None
        existing.append(
            (entity.entity_id, entity.unique_id, str(alias or entity.name or ""))
        )
    return existing


def _check_collisions(
    existing: list[tuple[str, str | None, str]],
    seen: dict[str, str],
    after: dict[str, Any],
    base: str,
) -> list[Finding]:
    """The id and the alias must not be taken, by the house or by another operation."""
    findings: list[Finding] = []
    new_id = after.get("id")
    if isinstance(new_id, str) and new_id:
        clash = next((e for e, i, _ in existing if i == new_id), None)
        if clash is not None:
            findings.append(
                _finding(
                    Severity.ERROR,
                    "id_collision",
                    f"The id '{new_id}' is already used by {clash}. "
                    "Leave out 'id'; one is assigned when the change is applied.",
                    f"{base}.id",
                )
            )
        elif f"id:{new_id}" in seen:
            findings.append(
                _finding(
                    Severity.ERROR,
                    "id_collision",
                    f"The id '{new_id}' is used twice in this change set.",
                    f"{base}.id",
                )
            )
        seen.setdefault(f"id:{new_id}", base)
    alias = after.get("alias")
    if isinstance(alias, str) and alias.strip():
        key = alias.strip().casefold()
        clash = next((e for e, _, a in existing if a.strip().casefold() == key), None)
        if clash is not None:
            findings.append(
                _finding(
                    Severity.ERROR,
                    "alias_collision",
                    f"An automation named '{alias}' already exists ({clash}). "
                    "Choose a different alias.",
                    f"{base}.alias",
                )
            )
        elif f"alias:{key}" in seen:
            findings.append(
                _finding(
                    Severity.ERROR,
                    "alias_collision",
                    f"The alias '{alias}' is used twice in this change set.",
                    f"{base}.alias",
                )
            )
        seen.setdefault(f"alias:{key}", base)
    return findings


async def _check_operation(
    hass: HomeAssistant,
    operation: Operation,
    index: int,
    existing: list[tuple[str, str | None, str]],
    seen: dict[str, str],
) -> list[Finding]:
    op_path = f"operations[{index}]"
    if (
        operation.kind is not OperationKind.AUTOMATION
        or operation.op is not OperationType.CREATE
    ):
        return [
            _finding(
                Severity.ERROR,
                "unsupported",
                f"Only creating automations is supported; "
                f"'{operation.kind.value}' with '{operation.op.value}' is not.",
                op_path,
            )
        ]
    after = operation.after or {}
    base = f"{op_path}.after"
    findings: list[Finding] = []
    validated, schema_findings = await _check_schema(hass, after, base)
    findings += schema_findings
    if validated is not None:
        findings += _check_references(hass, validated, after, base)
    findings += _check_services(hass, after, base)
    findings += _check_templates(hass, after, base)
    findings += _check_collisions(existing, seen, after, base)
    return findings


async def async_run_checks(hass: HomeAssistant, change_set: ChangeSet) -> list[Finding]:
    """Run all stage A checks and return the findings."""
    findings: list[Finding] = []
    existing = _existing_automations(hass)
    seen: dict[str, str] = {}
    for index, operation in enumerate(change_set.operations):
        try:
            findings += await _check_operation(hass, operation, index, existing, seen)
        except Exception as err:
            _LOGGER.exception("A validity check raised an exception")
            findings.append(
                _finding(
                    Severity.ERROR,
                    "internal",
                    f"A check crashed ({type(err).__name__}: {err}), so this "
                    "operation could not be verified.",
                    f"operations[{index}]",
                )
            )
    return findings
