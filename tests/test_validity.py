"""Tests for the stage A checks."""

import copy
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import (
    area_registry as ar,
    device_registry as dr,
)
from homeassistant.setup import async_setup_component
import pytest

from custom_components.ai_drafts.changeset import (
    ChangeSet,
    Finding,
    Operation,
    OperationKind,
    OperationType,
    Severity,
)
from custom_components.ai_drafts.checks.validity import async_run_checks

from .common import build_house, create_op, flur_automation, make_change_set


@pytest.fixture(autouse=True)
async def house(hass: HomeAssistant) -> None:
    await build_house(hass)


def by_check(findings: list[Finding], check: str) -> list[Finding]:
    return [f for f in findings if f.check == check]


async def run(hass: HomeAssistant, after: dict[str, Any]) -> list[Finding]:
    return await async_run_checks(hass, make_change_set(after))


async def test_valid_automation_has_no_findings(hass: HomeAssistant) -> None:
    assert await run(hass, flur_automation()) == []


@pytest.mark.parametrize(
    ("kind", "op", "target_id", "after"),
    [
        (OperationKind.AUTOMATION, OperationType.UPDATE, "abc", {"alias": "x"}),
        (OperationKind.AUTOMATION, OperationType.DELETE, "abc", None),
        (OperationKind.SCRIPT, OperationType.CREATE, None, {"sequence": []}),
        (OperationKind.DASHBOARD_CARD, OperationType.CREATE, None, {"type": "x"}),
    ],
)
async def test_unsupported_kind_or_op_is_an_error(
    hass: HomeAssistant,
    kind: OperationKind,
    op: OperationType,
    target_id: str | None,
    after: dict[str, Any] | None,
) -> None:
    change_set = ChangeSet.new("r", [Operation(kind, op, target_id, None, after)])
    findings = await async_run_checks(hass, change_set)
    assert [(f.severity, f.check, f.path) for f in findings] == [
        (Severity.ERROR, "validity.unsupported", "operations[0]")
    ]
    change_set.complete_check(findings)
    assert change_set.status.value == "draft"  # can never reach "checked"


async def test_schema_error_names_the_path(hass: HomeAssistant) -> None:
    after = flur_automation()
    del after["triggers"]
    findings = await run(hass, after)
    schema = by_check(findings, "validity.schema")
    assert len(schema) == 1
    assert schema[0].severity is Severity.ERROR
    assert "triggers" in schema[0].message
    assert schema[0].path == "operations[0].after.triggers"


async def test_schema_error_in_nested_action(hass: HomeAssistant) -> None:
    after = flur_automation()
    after["actions"][1] = {"delay": "not a duration"}
    findings = await run(hass, after)
    schema = by_check(findings, "validity.schema")
    assert schema
    assert schema[0].path.startswith("operations[0].after.actions[1]")


async def test_missing_entity_in_trigger_condition_and_action(
    hass: HomeAssistant,
) -> None:
    after = flur_automation()
    after["triggers"][0]["entity_id"] = "binary_sensor.flur_bewegungsmelder_x"
    after["conditions"][0]["entity_id"] = "sun.mond"
    after["actions"][0]["target"]["entity_id"] = ["light.flurlicht", "light.nope"]
    findings = by_check(await run(hass, after), "validity.entity")
    assert {f.path for f in findings} == {
        "operations[0].after.triggers[0].entity_id",
        "operations[0].after.conditions[0].entity_id",
        "operations[0].after.actions[0].target.entity_id[1]",
    }
    assert all(f.severity is Severity.ERROR for f in findings)
    trigger = next(f for f in findings if "bewegungsmelder_x" in f.message)
    assert "binary_sensor.flur_bewegungsmelder" in trigger.message  # suggestion


async def test_missing_entity_in_nested_action(hass: HomeAssistant) -> None:
    after = flur_automation()
    after["actions"] = [
        {
            "if": [
                {"condition": "state", "entity_id": "light.flurlicht", "state": "on"}
            ],
            "then": [
                {"action": "light.turn_off", "target": {"entity_id": "light.weg"}}
            ],
        }
    ]
    findings = by_check(await run(hass, after), "validity.entity")
    assert [f.path for f in findings] == [
        "operations[0].after.actions[0].then[0].target.entity_id"
    ]


async def test_entity_that_exists_only_in_registry_is_fine(
    hass: HomeAssistant,
) -> None:
    after = flur_automation()
    # Disabled entity of the house: in the registry, without a state.
    after["actions"][0]["target"]["entity_id"] = "light.flur_aus"
    assert by_check(await run(hass, after), "validity.entity") == []


async def test_match_all_entities_is_not_missing(hass: HomeAssistant) -> None:
    after = flur_automation()
    after["actions"] = [{"action": "light.turn_off", "target": {"entity_id": "all"}}]
    assert by_check(await run(hass, after), "validity.entity") == []


async def test_missing_area_and_device(hass: HomeAssistant) -> None:
    after = flur_automation()
    after["actions"][0]["target"] = {"area_id": "keller"}
    after["actions"][2]["target"] = {"device_id": "0123456789abcdef"}
    findings = await run(hass, after)
    area = by_check(findings, "validity.area")
    device = by_check(findings, "validity.device")
    assert [f.path for f in area] == ["operations[0].after.actions[0].target.area_id"]
    assert [f.path for f in device] == [
        "operations[0].after.actions[2].target.device_id"
    ]


async def test_existing_area_is_fine(hass: HomeAssistant) -> None:
    flur = ar.async_get(hass).async_get_area_by_name("Flur")
    after = flur_automation()
    after["actions"][0]["target"] = {"area_id": flur.id}
    assert by_check(await run(hass, after), "validity.area") == []


async def test_existing_device_is_fine(hass: HomeAssistant) -> None:
    flur = ar.async_get(hass).async_get_area_by_name("Flur")
    from .common import device_with_area

    device = device_with_area(hass, flur.id)
    after = flur_automation()
    after["actions"][0]["target"] = {"device_id": device.id}
    assert by_check(await run(hass, after), "validity.device") == []
    assert dr.async_get(hass).async_get(device.id)


async def test_unknown_service(hass: HomeAssistant) -> None:
    after = flur_automation()
    after["actions"][0]["action"] = "light.turn_onn"
    findings = by_check(await run(hass, after), "validity.service")
    assert len(findings) == 1
    assert findings[0].severity is Severity.ERROR
    assert findings[0].path == "operations[0].after.actions[0].action"
    assert "light.turn_on" in findings[0].message


async def test_unknown_service_in_choose(hass: HomeAssistant) -> None:
    after = flur_automation()
    after["actions"] = [
        {
            "choose": [
                {
                    "conditions": [],
                    "sequence": [{"action": "nope.nothing", "target": {}}],
                }
            ]
        }
    ]
    findings = by_check(await run(hass, after), "validity.service")
    assert [f.path for f in findings] == [
        "operations[0].after.actions[0].choose[0].sequence[0].action"
    ]


async def test_service_data_validated_with_registered_schema(
    hass: HomeAssistant,
) -> None:
    after = flur_automation()
    after["actions"][0]["data"] = {"brightness_pct": "very bright"}
    findings = by_check(await run(hass, after), "validity.service_data")
    assert len(findings) == 1
    assert findings[0].severity is Severity.ERROR
    assert "light.turn_on" in findings[0].message
    assert findings[0].path == "operations[0].after.actions[0].data.brightness_pct"


async def test_service_data_with_template_is_not_validated(
    hass: HomeAssistant,
) -> None:
    after = flur_automation()
    after["actions"][0]["data"] = {"brightness_pct": "{{ 'very bright' }}"}
    assert by_check(await run(hass, after), "validity.service_data") == []


async def test_service_missing_required_field(hass: HomeAssistant) -> None:
    calls: list[Any] = []
    import voluptuous as vol

    hass.services.async_register(
        "testsvc",
        "need_name",
        lambda call: calls.append(call),
        schema=vol.Schema({vol.Required("name"): str}),
    )
    after = flur_automation()
    after["actions"] = [{"action": "testsvc.need_name", "data": {}}]
    findings = by_check(await run(hass, after), "validity.service_data")
    assert len(findings) == 1
    assert "name" in findings[0].message


async def test_invalid_template_syntax_is_an_error(hass: HomeAssistant) -> None:
    after = flur_automation()
    after["conditions"] = [
        {"condition": "template", "value_template": "{{ states('sun.sun' }}"}
    ]
    findings = await run(hass, after)
    templates = by_check(findings, "validity.template")
    assert len(templates) == 1
    assert templates[0].severity is Severity.ERROR
    assert templates[0].path == "operations[0].after.conditions[0].value_template"


async def test_template_that_fails_to_render_is_a_warning(hass: HomeAssistant) -> None:
    after = flur_automation()
    after["conditions"] = [
        {
            "condition": "template",
            "value_template": "{{ states('sun.sun') | int }}",
        }
    ]
    findings = await run(hass, after)
    assert by_check(findings, "validity.template") == []
    rendered = by_check(findings, "validity.template_render")
    assert len(rendered) == 1
    assert rendered[0].severity is Severity.WARNING
    # A warning does not block the change set.
    change_set = make_change_set(after)
    change_set.complete_check(findings)
    assert change_set.status.value == "checked"


async def test_template_with_runtime_variables_is_not_rendered(
    hass: HomeAssistant,
) -> None:
    after = flur_automation()
    after["actions"][0]["data"] = {
        "brightness_pct": "{{ trigger.to_state.state | int }}"
    }
    findings = await run(hass, after)
    assert by_check(findings, "validity.template_render") == []
    assert by_check(findings, "validity.template") == []


async def test_template_using_own_variable_is_not_rendered(hass: HomeAssistant) -> None:
    after = flur_automation()
    after["variables"] = {"level": 50}
    after["actions"][0]["data"] = {"brightness_pct": "{{ level | int + undefined_x }}"}
    findings = await run(hass, after)
    assert by_check(findings, "validity.template_render") == []


async def test_plain_text_fields_are_not_templates(hass: HomeAssistant) -> None:
    after = flur_automation(alias="Brace {{ in alias", description="{% broken")
    findings = await run(hass, after)
    assert by_check(findings, "validity.template") == []


async def test_good_template_renders_without_findings(hass: HomeAssistant) -> None:
    after = flur_automation()
    after["conditions"] = [
        {
            "condition": "template",
            "value_template": "{{ is_state('sun.sun', 'below_horizon') }}",
        }
    ]
    assert await run(hass, after) == []


async def test_alias_collision_with_existing_automation(hass: HomeAssistant) -> None:
    assert await async_setup_component(
        hass,
        "automation",
        {
            "automation": [
                {
                    "id": "existing1",
                    "alias": "Flurlicht Bei Bewegung",
                    "triggers": [{"trigger": "homeassistant", "event": "start"}],
                    "actions": [],
                }
            ]
        },
    )
    await hass.async_block_till_done()
    findings = by_check(await run(hass, flur_automation()), "validity.alias_collision")
    assert len(findings) == 1
    assert findings[0].severity is Severity.ERROR
    assert findings[0].path == "operations[0].after.alias"
    assert "automation." in findings[0].message


async def test_id_collision_with_existing_automation(hass: HomeAssistant) -> None:
    assert await async_setup_component(
        hass,
        "automation",
        {
            "automation": [
                {
                    "id": "existing1",
                    "alias": "Ganz anders",
                    "triggers": [{"trigger": "homeassistant", "event": "start"}],
                    "actions": [],
                }
            ]
        },
    )
    await hass.async_block_till_done()
    after = flur_automation(id="existing1")
    findings = by_check(await run(hass, after), "validity.id_collision")
    assert len(findings) == 1
    assert findings[0].path == "operations[0].after.id"
    assert (
        by_check(await run(hass, flur_automation(id="fresh")), "validity.id_collision")
        == []
    )


async def test_collision_between_operations_of_one_change_set(
    hass: HomeAssistant,
) -> None:
    first = flur_automation(id="same")
    second = copy.deepcopy(first)
    change_set = ChangeSet.new("r", [create_op(first), create_op(second)])
    findings = await async_run_checks(hass, change_set)
    assert {f.check for f in findings} == {
        "validity.id_collision",
        "validity.alias_collision",
    }
    assert all(f.path.startswith("operations[1]") for f in findings)


async def test_a_crashing_check_is_an_error_not_a_pass(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    from custom_components.ai_drafts.checks import validity

    def boom(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("boom")

    monkeypatch.setattr(validity, "_check_templates", boom)
    findings = await run(hass, flur_automation())
    assert [(f.severity, f.check) for f in findings] == [
        (Severity.ERROR, "validity.internal")
    ]
