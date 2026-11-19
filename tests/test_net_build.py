"""``async_build_net`` on a running instance: the automations of a house."""

from __future__ import annotations

import copy
from pathlib import Path
from typing import Any
from unittest.mock import patch

from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
import pytest

from custom_components.ai_drafts.changeset import (
    ChangeSet,
    Operation,
    OperationKind,
    OperationType,
)
from custom_components.ai_drafts.net import async_build_net, translate
from custom_components.ai_drafts.net.model import Net, TransitionKind
from custom_components.ai_drafts.net.translate import HassResolver

from .common import create_op, flur_automation
from .net_support import structure_violations
from .test_apply import start

BLUEPRINT = """blueprint:
  name: Motion light
  domain: automation
  input:
    motion_sensor:
      selector:
        entity:
          domain: binary_sensor
    light_target:
      selector:
        target:
          entity:
            domain: light
triggers:
  - trigger: state
    entity_id: !input motion_sensor
    to: "on"
actions:
  - action: light.turn_on
    target: !input light_target
"""

UI_AUTOMATION = {
    "id": "hallway_motion",
    "alias": "Hallway on motion",
    "mode": "restart",
    "triggers": [
        {
            "trigger": "state",
            "entity_id": "binary_sensor.flur_bewegungsmelder",
            "to": "on",
        }
    ],
    "conditions": [
        {"condition": "state", "entity_id": "sun.sun", "state": "below_horizon"}
    ],
    "actions": [
        {"action": "light.turn_on", "target": {"entity_id": "light.flurlicht"}},
        {"delay": "00:03:00"},
        {"action": "light.turn_off", "target": {"entity_id": "light.flurlicht"}},
    ],
}
# No id: it lives in YAML only. The target is an area, resolved from the registry.
YAML_AUTOMATION = {
    "alias": "Night hallway off",
    "triggers": [
        {
            "trigger": "state",
            "entity_id": "binary_sensor.flur_bewegungsmelder",
            "to": "off",
        }
    ],
    "actions": [{"action": "light.turn_off", "target": {"area_id": "flur"}}],
}
DISABLED_AUTOMATION = {
    "id": "paused",
    "alias": "Paused one",
    "initial_state": False,
    "triggers": [{"trigger": "homeassistant", "event": "start"}],
    "actions": [
        {"action": "light.turn_on", "target": {"entity_id": "light.wohnzimmer"}}
    ],
}
HOUSE = [UI_AUTOMATION, YAML_AUTOMATION, DISABLED_AUTOMATION]


def records(net: Net) -> dict[str, Any]:
    return {a.id: a for a in net.automations}


def transitions_of(net: Net, automation_id: str) -> list[str]:
    return [t.id for t in net.transitions if t.origin.automation_id == automation_id]


@pytest.fixture
async def house(hass: HomeAssistant, config_dir: Path) -> Any:
    return await start(hass, config_dir, HOUSE)


async def test_builds_one_net_from_all_automations(
    hass: HomeAssistant, house: Any
) -> None:
    net = await async_build_net(hass)
    net.validate()
    assert structure_violations(net) == []
    found = records(net)
    assert set(found) == {"hallway_motion", "night_hallway_off", "paused"}

    ui = found["hallway_motion"]
    assert (ui.source.value, ui.entity_id, ui.mode, ui.enabled, ui.complete) == (
        "ui",
        "automation.hallway_on_motion",
        "restart",
        True,
        True,
    )
    assert ui.alias == "Hallway on motion"

    # No id: the id is the object id of the entity, the source is yaml.
    yaml_record = found["night_hallway_off"]
    assert yaml_record.source.value == "yaml"
    assert yaml_record.entity_id == "automation.night_hallway_off"
    # The area target was resolved through the registries: only lights of the
    # hallway that are neither hidden nor disabled, not the motion sensor.
    writes = [
        a.target
        for a in net.arcs
        if a.kind.value == "write" and a.source.startswith("t:night_hallway_off:")
    ]
    assert writes == ["p:light.flurlicht:off"]
    resolved = next(
        t for t in net.transitions if t.id == "t:night_hallway_off:actions[0]"
    )
    assert [(a.name, a.value) for a in resolved.annotations] == [
        ("action", "light.turn_off"),
        (
            "resolved_from",
            {"kind": "area_id", "id": "flur", "entities": ["light.flurlicht"]},
        ),
    ]
    assert yaml_record.complete


async def test_disabled_automation_is_translated_and_marked(
    hass: HomeAssistant, house: Any
) -> None:
    net = await async_build_net(hass)
    paused = records(net)["paused"]
    assert paused.enabled is False
    assert paused.source.value == "ui"
    assert "t:paused:actions[0]" in transitions_of(net, "paused")


async def test_state_places_are_shared_and_know_their_area(
    hass: HomeAssistant, house: Any
) -> None:
    net = await async_build_net(hass)
    # light.flurlicht:off is written by two automations and is still one place.
    assert sum(p.id == "p:light.flurlicht:off" for p in net.places) == 1
    places = {p.id: p for p in net.places}
    assert places["p:light.flurlicht:off"].origin.area_id == "flur"
    assert (
        places["p:light.wohnzimmer:on"].origin.area_id
        == ar.async_get(hass).async_get_area_by_name("Wohnzimmer").id
    )
    assert places["p:sun.sun:below_horizon"].origin.area_id is None
    assert places["p:sun.sun:below_horizon"].origin.entity_id == "sun.sun"


async def test_a_translator_that_raises_does_not_sink_the_net(
    hass: HomeAssistant, house: Any
) -> None:
    real = translate.translate_automation

    def flaky(config: Any, **kwargs: Any) -> Net:
        if kwargs["automation_id"] == "hallway_motion":
            raise RuntimeError("cannot cope")
        return real(config, **kwargs)

    with patch.object(translate, "translate_automation", flaky):
        net = await async_build_net(hass)
    net.validate()
    found = records(net)
    assert set(found) == {"hallway_motion", "night_hallway_off", "paused"}
    broken = found["hallway_motion"]
    assert broken.complete is False
    assert len(broken.opaque) == 1
    assert "cannot cope" in broken.opaque[0].reason
    assert "RuntimeError" in broken.opaque[0].reason
    assert (broken.source.value, broken.entity_id) == (
        "ui",
        "automation.hallway_on_motion",
    )
    assert transitions_of(net, "hallway_motion") == []
    # The others are built as before.
    assert found["night_hallway_off"].complete
    assert transitions_of(net, "night_hallway_off")
    assert transitions_of(net, "paused")
    assert structure_violations(net) == []


async def test_blueprint_automations_use_the_resolved_configuration(
    hass: HomeAssistant, config_dir: Path
) -> None:
    folder = config_dir / "blueprints" / "automation" / "test"
    folder.mkdir(parents=True)
    (folder / "motion_light.yaml").write_text(BLUEPRINT, encoding="utf-8")
    await start(
        hass,
        config_dir,
        [
            {
                "id": "bp_ok",
                "alias": "From blueprint",
                "use_blueprint": {
                    "path": "test/motion_light.yaml",
                    "input": {
                        "motion_sensor": "binary_sensor.flur_bewegungsmelder",
                        "light_target": {"entity_id": "light.flurlicht"},
                    },
                },
            },
            {
                "id": "bp_missing",
                "alias": "Blueprint is gone",
                "use_blueprint": {"path": "test/gone.yaml", "input": {}},
            },
        ],
    )
    net = await async_build_net(hass)
    net.validate()
    ok = records(net)["bp_ok"]
    assert ok.complete
    arcs = {(a.kind.value, a.source, a.target) for a in net.arcs}
    assert (
        "read",
        "p:binary_sensor.flur_bewegungsmelder:on",
        "t:bp_ok:triggers[0]",
    ) in arcs
    assert ("write", "t:bp_ok:actions[0]", "p:light.flurlicht:on") in arcs

    # The blueprint file is missing: Home Assistant keeps only the unresolved
    # configuration, the net has one opaque transition.
    gone = records(net)["bp_missing"]
    assert not gone.complete
    assert "blueprint" in gone.opaque[0].reason
    assert transitions_of(net, "bp_missing") == ["t:bp_missing:automation"]
    skip = next(t for t in net.transitions if t.id == "t:bp_missing:automation")
    assert skip.kind is TransitionKind.SKIP
    assert structure_violations(net) == []


async def test_an_automation_with_invalid_configuration_is_a_record_only(
    hass: HomeAssistant, config_dir: Path
) -> None:
    await start(
        hass,
        config_dir,
        [
            {
                "id": "bad",
                "alias": "Invalid",
                "triggers": [{"trigger": "nonsense"}],
                "actions": [],
            },
            UI_AUTOMATION,
        ],
    )
    net = await async_build_net(hass)
    bad = records(net)["bad"]
    assert not bad.complete
    assert "invalid" in bad.opaque[0].reason
    assert transitions_of(net, "bad") == []
    assert records(net)["hallway_motion"].complete


async def test_a_yaml_automation_cannot_take_the_id_of_an_editor_automation(
    hass: HomeAssistant, config_dir: Path
) -> None:
    # Its entity is automation.hallway_motion; the editor automation has that id.
    twin = {**YAML_AUTOMATION, "alias": "Hallway motion"}
    await start(hass, config_dir, [{**UI_AUTOMATION, "id": "hallway_motion"}, twin])
    net = await async_build_net(hass)
    net.validate()
    found = records(net)
    assert set(found) == {"hallway_motion", "hallway_motion~yaml"}
    assert found["hallway_motion"].source.value == "ui"
    assert found["hallway_motion"].entity_id == "automation.hallway_on_motion"
    assert found["hallway_motion~yaml"].source.value == "yaml"
    assert found["hallway_motion~yaml"].entity_id == "automation.hallway_motion"


async def test_environment_transitions_are_an_option(
    hass: HomeAssistant, house: Any
) -> None:
    plain = await async_build_net(hass)
    assert not any(t.kind is TransitionKind.ENVIRONMENT for t in plain.transitions)
    net = await async_build_net(hass, environment=True)
    net.validate()
    environment = {
        t.id for t in net.transitions if t.kind is TransitionKind.ENVIRONMENT
    }
    # Read and never written: the motion sensor on and off, the sun below the
    # horizon. light.flurlicht:off is written by two automations, nothing reads it.
    assert environment == {
        "t:env:binary_sensor.flur_bewegungsmelder:on",
        "t:env:binary_sensor.flur_bewegungsmelder:off",
        "t:env:sun.sun:below_horizon",
    }
    assert structure_violations(net) == []


# --- change sets -----------------------------------------------------------------


def draft(*operations: Operation) -> ChangeSet:
    return ChangeSet.new("request", list(operations), "m")


async def test_a_change_set_is_added_as_proposals(
    hass: HomeAssistant, house: Any
) -> None:
    proposal = flur_automation(id="flur_new")
    net = await async_build_net(hass, change_set=draft(create_op(proposal)))
    net.validate()
    found = records(net)
    assert found["flur_new"].source.value == "proposal"
    assert found["flur_new"].entity_id is None
    assert found["hallway_motion"].source.value == "ui"
    assert structure_violations(net) == []
    # The proposal turns light.flurlicht on, which is a place others use.
    assert sum(p.id == "p:light.flurlicht:on" for p in net.places) == 1
    assert ("write", "t:flur_new:actions[0]") in {
        (a.kind.value, a.source) for a in net.arcs if a.target == "p:light.flurlicht:on"
    }


async def test_a_proposal_without_id_gets_one_from_the_change_set(
    hass: HomeAssistant, house: Any
) -> None:
    change_set = draft(create_op(flur_automation()))
    net = await async_build_net(hass, change_set=change_set)
    new = [a for a in net.automations if a.source.value == "proposal"]
    assert [a.id for a in new] == [f"{change_set.id}_0"]


async def test_an_update_replaces_the_automation_it_changes(
    hass: HomeAssistant, house: Any
) -> None:
    after = copy.deepcopy(UI_AUTOMATION)
    after["actions"] = [
        {"action": "light.turn_on", "target": {"entity_id": "light.wohnzimmer"}}
    ]
    update = Operation(
        OperationKind.AUTOMATION,
        OperationType.UPDATE,
        "hallway_motion",
        UI_AUTOMATION,
        after,
    )
    net = await async_build_net(hass, change_set=draft(update))
    net.validate()
    record = records(net)["hallway_motion"]
    # It is now the proposal; it keeps the entity it will be written back to.
    assert record.source.value == "proposal"
    assert record.entity_id == "automation.hallway_on_motion"
    assert transitions_of(net, "hallway_motion") == [
        "t:hallway_motion:triggers[0]",
        "t:hallway_motion:conditions",
        "t:hallway_motion:conditions:stop",
        "t:hallway_motion:actions[0]",
    ]
    assert structure_violations(net) == []


async def test_a_delete_takes_the_automation_out(
    hass: HomeAssistant, house: Any
) -> None:
    delete = Operation(
        OperationKind.AUTOMATION, OperationType.DELETE, "paused", UI_AUTOMATION
    )
    net = await async_build_net(hass, change_set=draft(delete))
    net.validate()
    assert "paused" not in records(net)
    assert not any(p.id == "p:light.wohnzimmer:on" for p in net.places)
    assert structure_violations(net) == []


async def test_operations_on_other_objects_are_ignored(
    hass: HomeAssistant, house: Any
) -> None:
    script = Operation(
        OperationKind.SCRIPT, OperationType.CREATE, None, None, {"alias": "s"}
    )
    assert await async_build_net(
        hass, change_set=draft(script)
    ) == await async_build_net(hass)


async def test_a_proposal_that_cannot_be_translated_is_a_record(
    hass: HomeAssistant, house: Any
) -> None:
    real = translate.translate_automation

    def flaky(config: Any, **kwargs: Any) -> Net:
        if kwargs["source"].value == "proposal":
            raise ValueError("odd proposal")
        return real(config, **kwargs)

    with patch.object(translate, "translate_automation", flaky):
        net = await async_build_net(
            hass, change_set=draft(create_op(flur_automation(id="p1")))
        )
    assert records(net)["p1"].source.value == "proposal"
    assert "odd proposal" in records(net)["p1"].opaque[0].reason
    assert "hallway_motion" in records(net)


async def test_an_empty_house_gives_an_empty_net(
    hass: HomeAssistant, config_dir: Path
) -> None:
    await start(hass, config_dir, None)
    net = await async_build_net(hass)
    assert net == Net()
    net.validate()


# --- the resolver ----------------------------------------------------------------


async def test_hass_resolver_follows_the_registries(
    hass: HomeAssistant, house: Any
) -> None:
    resolver = HassResolver(hass)
    assert resolver.resolve_target("area_id", "flur") == {
        "light.flurlicht",
        "binary_sensor.flur_bewegungsmelder",
        "sensor.flur_temperatur",
    }
    assert resolver.resolve_target("area_id", "does_not_exist") is None
    assert resolver.resolve_target("floor_id", "does_not_exist") is None
    assert resolver.resolve_target("label_id", "does_not_exist") is None
    assert resolver.resolve_target("device_id", "does_not_exist") is None
    assert resolver.area_of("light.flurlicht") == "flur"
    assert resolver.area_of("sun.sun") is None
    assert resolver.template_entities("{{ is_state('light.a', 'on') }}") == {"light.a"}
    assert resolver.template_entities("{{ states.light | list }}") is None
