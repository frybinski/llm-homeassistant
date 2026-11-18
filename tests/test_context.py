"""Tests for the house model and the selection of the part sent to the model."""

import json

from homeassistant.core import HomeAssistant
from homeassistant.helpers import (
    area_registry as ar,
    entity_registry as er,
)
from homeassistant.setup import async_setup_component
import pytest

from custom_components.ai_drafts.context import (
    async_build_context,
    tokenize,
)

from .common import build_house, device_with_area


@pytest.fixture(autouse=True)
async def house(hass: HomeAssistant) -> None:
    await build_house(hass)


def entity_ids(context) -> list[str]:
    return [e.entity_id for e in context.entities]


def test_tokenize_drops_stop_words_and_short_words() -> None:
    assert tokenize(
        "Schalte das Flurlicht bei Bewegung nach Sonnenuntergang für 3 Minuten ein"
    ) == [
        "flurlicht",
        "bewegung",
        "sonnenuntergang",
    ]
    assert tokenize("Turn on the Hall light, please") == ["hall", "light"]
    assert tokenize("Flur flur FLUR") == ["flur"]


async def test_compound_word_finds_area_and_its_entities(hass: HomeAssistant) -> None:
    context = await async_build_context(hass, "Schalte das Flurlicht bei Bewegung ein")
    # "flurlicht" contains the area name "Flur": every entity of the area is in.
    assert set(entity_ids(context)) == {
        "light.flurlicht",
        "binary_sensor.flur_bewegungsmelder",
        "sensor.flur_temperatur",
        "sun.sun",
    }
    assert [a.name for a in context.areas] == ["Flur"]
    assert context.selection == "matched"
    assert context.truncated is False


async def test_entity_matches_by_name_entity_id_and_device_name(
    hass: HomeAssistant,
) -> None:
    flur = ar.async_get(hass).async_get_area_by_name("Flur")
    device = device_with_area(hass, flur.id)
    ent_reg = er.async_get(hass)
    ent_reg.async_get_or_create(
        "switch", "test", "plug", suggested_object_id="steckdose", device_id=device.id
    )
    hass.states.async_set("switch.steckdose", "off", {"friendly_name": "Steckdose"})

    # By device name ("Bewegungs Gerät"), though neither name nor id contain it.
    context = await async_build_context(hass, "gerät")
    assert "switch.steckdose" in entity_ids(context)
    # By entity id part.
    context = await async_build_context(hass, "steckdose")
    assert "switch.steckdose" in entity_ids(context)
    assert "light.wohnzimmer" not in entity_ids(context)
    assert context.selection == "matched"


async def test_area_comes_from_the_device_when_the_entity_has_none(
    hass: HomeAssistant,
) -> None:
    wohnzimmer = ar.async_get(hass).async_get_area_by_name("Wohnzimmer")
    device = device_with_area(hass, wohnzimmer.id)
    er.async_get(hass).async_get_or_create(
        "switch", "test", "lampe", suggested_object_id="lampe", device_id=device.id
    )
    hass.states.async_set("switch.lampe", "on", {"friendly_name": "Lampe"})
    context = await async_build_context(hass, "lampe")
    entity = next(e for e in context.entities if e.entity_id == "switch.lampe")
    assert entity.area == "Wohnzimmer"
    assert [a.name for a in context.areas] == ["Wohnzimmer"]


async def test_matching_an_area_includes_all_its_entities(hass: HomeAssistant) -> None:
    context = await async_build_context(hass, "Wohnzimmer")
    assert "light.wohnzimmer" in entity_ids(context)
    assert "light.flurlicht" not in entity_ids(context)
    assert [a.name for a in context.areas] == ["Wohnzimmer"]


async def test_unrelated_entities_are_left_out(hass: HomeAssistant) -> None:
    context = await async_build_context(hass, "Wohnzimmer")
    assert "sensor.flur_temperatur" not in entity_ids(context)


async def test_sun_is_always_included_when_it_exists(hass: HomeAssistant) -> None:
    context = await async_build_context(hass, "Wohnzimmer")
    assert "sun.sun" in entity_ids(context)
    hass.states.async_remove("sun.sun")
    context = await async_build_context(hass, "Wohnzimmer")
    assert "sun.sun" not in entity_ids(context)


async def test_disabled_and_hidden_entities_are_excluded(hass: HomeAssistant) -> None:
    # light.flur_aus is disabled in the registry; give it a state anyway so that
    # only the registry flag can exclude it. light.flur_versteckt is hidden.
    hass.states.async_set("light.flur_aus", "on", {"friendly_name": "Flur aus"})
    context = await async_build_context(hass, "Flur")
    assert "light.flur_aus" not in entity_ids(context)
    assert "light.flur_versteckt" not in entity_ids(context)
    fallback = await async_build_context(hass, "xyzzy")
    assert "light.flur_aus" not in entity_ids(fallback)
    assert "light.flur_versteckt" not in entity_ids(fallback)


async def test_entity_fields_are_minimal(hass: HomeAssistant) -> None:
    context = await async_build_context(hass, "Flur Temperatur")
    entity = next(
        e for e in context.entities if e.entity_id == "sensor.flur_temperatur"
    )
    assert entity.to_dict() == {
        "entity_id": "sensor.flur_temperatur",
        "name": "Flur Temperatur",
        "domain": "sensor",
        "device_class": "temperature",
        "area": "Flur",
        "state": "21.5",
        "unit": "°C",
    }
    sun = next(e for e in context.entities if e.entity_id == "sun.sun")
    # No attribute dump: the elevation attribute never shows up.
    assert "elevation" not in json.dumps(context.to_prompt_dict())
    assert sun.to_dict() == {
        "entity_id": "sun.sun",
        "name": "sun.sun",
        "domain": "sun",
        "state": "above_horizon",
    }


async def test_prompt_dict_is_json_serialisable(hass: HomeAssistant) -> None:
    context = await async_build_context(hass, "Flurlicht")
    data = context.to_prompt_dict()
    assert set(data) == {"areas", "entities", "existing_automations", "truncated"}
    assert json.loads(json.dumps(data)) == data
    assert context.size == len(json.dumps(data, separators=(",", ":")))


async def test_cap_keeps_best_matches_and_sets_truncated(hass: HomeAssistant) -> None:
    ent_reg = er.async_get(hass)
    for number in range(10):
        ent_reg.async_get_or_create(
            "light", "test", f"k{number}", suggested_object_id=f"kueche_{number}"
        )
        hass.states.async_set(
            f"light.kueche_{number}", "off", {"friendly_name": f"Küche {number}"}
        )
    hass.states.async_set("light.kueche_best", "off", {"friendly_name": "Kueche best"})
    context = await async_build_context(hass, "kueche best", max_entities=4)
    assert len(context.entities) == 4
    assert context.truncated is True
    # The cap keeps the best-scoring match and still has room for sun.sun.
    assert "light.kueche_best" in entity_ids(context)
    assert "sun.sun" in entity_ids(context)

    roomy = await async_build_context(hass, "kueche best", max_entities=50)
    assert roomy.truncated is False
    assert len(roomy.entities) > 4


async def test_fallback_orders_by_domain_priority(hass: HomeAssistant) -> None:
    hass.states.async_set("zone.home", "0", {"friendly_name": "Home"})
    context = await async_build_context(hass, "xyzzy plugh")
    assert context.selection == "fallback"
    assert context.truncated is False
    ids = sorted(entity_ids(context), key=lambda e: e)
    assert "zone.home" in ids

    capped = await async_build_context(hass, "xyzzy plugh", max_entities=3)
    assert capped.truncated is True
    # Lights come first, then binary sensors; zone and sun are cut.
    assert {e.domain for e in capped.entities} <= {"light", "binary_sensor"}
    assert len(capped.entities) == 3


async def test_fallback_for_request_without_usable_words(hass: HomeAssistant) -> None:
    context = await async_build_context(hass, "bitte mach das")
    assert context.selection == "fallback"
    assert context.entities


AUTOMATIONS = [
    {
        "id": "a_flur",
        "alias": "Flur Nachtruhe",
        "triggers": [{"trigger": "homeassistant", "event": "start"}],
        "actions": [
            {"action": "light.turn_off", "target": {"entity_id": "light.flurlicht"}}
        ],
    },
    {
        "id": "a_wohn",
        "alias": "Wohnzimmer Abend",
        "triggers": [{"trigger": "homeassistant", "event": "start"}],
        "actions": [
            {"action": "light.turn_on", "target": {"entity_id": "light.wohnzimmer"}}
        ],
    },
    {
        "id": "a_gartenfest",
        "alias": "Gartenfest",
        "triggers": [{"trigger": "homeassistant", "event": "start"}],
        "actions": [],
    },
]


async def test_existing_automations_by_entity_and_by_alias(hass: HomeAssistant) -> None:
    assert await async_setup_component(hass, "automation", {"automation": AUTOMATIONS})
    await hass.async_block_till_done()
    context = await async_build_context(hass, "Flurlicht nachts, Gartenfest")
    found = {a.id: a for a in context.automations}
    assert set(found) == {"a_flur", "a_gartenfest"}  # not the Wohnzimmer one
    assert found["a_flur"].alias == "Flur Nachtruhe"
    assert found["a_flur"].entity_id == "automation.flur_nachtruhe"
    assert found["a_flur"].config["alias"] == "Flur Nachtruhe"
    assert found["a_flur"].config_omitted is False
    assert found["a_flur"].to_dict()["config"]["id"] == "a_flur"


async def test_large_automation_config_is_omitted(hass: HomeAssistant) -> None:
    big = {
        "id": "big",
        "alias": "Flur Gross",
        "triggers": [{"trigger": "homeassistant", "event": "start"}],
        "actions": [
            {"action": "light.turn_off", "target": {"entity_id": "light.flurlicht"}}
            for _ in range(120)
        ],
    }
    assert await async_setup_component(hass, "automation", {"automation": [big]})
    await hass.async_block_till_done()
    context = await async_build_context(hass, "Flurlicht")
    [entry] = context.automations
    assert entry.config is None
    assert entry.config_omitted is True
    assert entry.to_dict() == {
        "id": "big",
        "alias": "Flur Gross",
        "entity_id": "automation.flur_gross",
        "config_omitted": True,
    }


async def test_automation_cap(hass: HomeAssistant) -> None:
    many = [
        {
            "id": f"flur_{n}",
            "alias": f"Flur {n:02d}",
            "triggers": [{"trigger": "homeassistant", "event": "start"}],
            "actions": [],
        }
        for n in range(6)
    ]
    assert await async_setup_component(hass, "automation", {"automation": many})
    await hass.async_block_till_done()
    context = await async_build_context(hass, "Flur", max_automations=4)
    assert len(context.automations) == 4
    assert context.truncated is True
    uncapped = await async_build_context(hass, "Flur")
    assert len(uncapped.automations) == 6
    assert uncapped.truncated is False


async def test_works_without_the_automation_component(hass: HomeAssistant) -> None:
    context = await async_build_context(hass, "Flurlicht")
    assert context.automations == ()
