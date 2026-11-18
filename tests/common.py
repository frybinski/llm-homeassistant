"""Helpers shared by the M1 tests."""

from __future__ import annotations

import copy
import json
from typing import Any

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.helpers import (
    area_registry as ar,
    device_registry as dr,
    entity_registry as er,
)
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.ai_drafts.changeset import (
    ChangeSet,
    Operation,
    OperationKind,
    OperationType,
)
from custom_components.ai_drafts.const import DOMAIN

OPENAI_DATA = {
    "model_source": "openai_compatible",
    "base_url": "http://model.test/v1",
    "api_key": "sk-test-key",
    "model": "test-model",
}

FLUR_AUTOMATION: dict[str, Any] = {
    "alias": "Flurlicht bei Bewegung",
    "description": "Licht im Flur nach Sonnenuntergang bei Bewegung.",
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
    "mode": "restart",
}


def flur_automation(**overrides: Any) -> dict[str, Any]:
    """Return a fresh valid automation, with top-level overrides."""
    automation = copy.deepcopy(FLUR_AUTOMATION)
    automation.update(overrides)
    return automation


def create_op(after: dict[str, Any], target_id: str | None = None) -> Operation:
    """Return an automation create operation."""
    return Operation(
        OperationKind.AUTOMATION, OperationType.CREATE, target_id, None, after
    )


def make_change_set(after: dict[str, Any] | None = None) -> ChangeSet:
    """Return a draft with one automation create operation."""
    return ChangeSet.new(
        "request", [create_op(after if after is not None else flur_automation())], "m"
    )


def operations_json(*afters: dict[str, Any]) -> str:
    """Return model output text for automation create operations."""
    return json.dumps(
        {
            "operations": [
                {"kind": "automation", "op": "create", "target_id": None, "after": a}
                for a in afters
            ]
        }
    )


class ScriptedClient:
    """A model client that answers from a list; an exception in it is raised."""

    name = "scripted-model"

    def __init__(self, *answers: Any) -> None:
        """Store the answers, used in order; the last one repeats."""
        self.answers = list(answers)
        self.calls: list[tuple[str, str]] = []

    async def async_generate(self, system: str, user: str) -> Any:
        """Return the next answer."""
        self.calls.append((system, user))
        index = min(len(self.calls) - 1, len(self.answers) - 1)
        answer = self.answers[index]
        if isinstance(answer, Exception):
            raise answer
        return answer


async def build_house(hass: HomeAssistant) -> None:
    """Create the hallway of the dev instance plus a little more.

    Areas Flur and Wohnzimmer; light.flurlicht and binary_sensor.flur_bewegungsmelder
    in the Flur; light.wohnzimmer in the Wohnzimmer; sun.sun; one disabled and one
    hidden entity in the Flur. The light component is set up for its real services.
    """
    assert await async_setup_component(hass, "light", {})
    area_reg = ar.async_get(hass)
    ent_reg = er.async_get(hass)
    flur = area_reg.async_create("Flur")
    wohnzimmer = area_reg.async_create("Wohnzimmer")

    def add(
        domain: str,
        object_id: str,
        name: str,
        area_id: str,
        state: str,
        **attrs: Any,
    ) -> None:
        ent_reg.async_get_or_create(
            domain,
            "test",
            object_id,
            suggested_object_id=object_id,
            original_name=name,
        )
        entity_id = f"{domain}.{object_id}"
        ent_reg.async_update_entity(entity_id, area_id=area_id)
        hass.states.async_set(entity_id, state, {"friendly_name": name, **attrs})

    add("light", "flurlicht", "Flurlicht", flur.id, "off")
    add(
        "binary_sensor",
        "flur_bewegungsmelder",
        "Flur Bewegungsmelder",
        flur.id,
        "off",
        device_class="motion",
    )
    add("light", "wohnzimmer", "Wohnzimmerlicht", wohnzimmer.id, "on")
    add(
        "sensor",
        "flur_temperatur",
        "Flur Temperatur",
        flur.id,
        "21.5",
        unit_of_measurement="°C",
        device_class="temperature",
    )
    hass.states.async_set("sun.sun", "above_horizon", {"elevation": 30.1})

    ent_reg.async_get_or_create(
        "light", "test", "versteckt", suggested_object_id="flur_versteckt"
    )
    ent_reg.async_update_entity(
        "light.flur_versteckt", area_id=flur.id, hidden_by=er.RegistryEntryHider.USER
    )
    hass.states.async_set(
        "light.flur_versteckt", "on", {"friendly_name": "Flur hidden"}
    )
    ent_reg.async_get_or_create(
        "light",
        "test",
        "aus",
        suggested_object_id="flur_aus",
        disabled_by=er.RegistryEntryDisabler.USER,
    )


async def setup_entry(
    hass: HomeAssistant, data: dict[str, Any] | None = None
) -> MockConfigEntry:
    """Set up the integration with a config entry."""
    entry = MockConfigEntry(domain=DOMAIN, data=data or OPENAI_DATA, title="AI Drafts")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.LOADED
    return entry


def device_with_area(hass: HomeAssistant, area_id: str) -> dr.DeviceEntry:
    """Create a device in an area, backed by a config entry."""
    config_entry = MockConfigEntry(domain="test")
    config_entry.add_to_hass(hass)
    device = dr.async_get(hass).async_get_or_create(
        config_entry_id=config_entry.entry_id,
        identifiers={("test", "dev1")},
        name="Bewegungs Gerät",
    )
    return dr.async_get(hass).async_update_device(device.id, area_id=area_id)
