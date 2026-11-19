"""The effect table."""

import pytest

from custom_components.ai_drafts.net.effects import effect_state


@pytest.mark.parametrize(
    ("domain", "service", "entity_domain", "state"),
    [
        ("light", "turn_on", None, "on"),
        ("light", "turn_off", None, "off"),
        ("switch", "turn_on", None, "on"),
        ("input_boolean", "turn_off", None, "off"),
        ("fan", "turn_on", None, "on"),
        ("lock", "lock", None, "locked"),
        ("lock", "unlock", None, "unlocked"),
        ("cover", "open_cover", None, "open"),
        ("cover", "close_cover", None, "closed"),
        ("homeassistant", "turn_on", "light", "on"),
        ("homeassistant", "turn_off", "switch", "off"),
        ("light", "toggle", None, None),
        ("homeassistant", "toggle", "light", None),
        ("light", "turn_on_with_extras", None, None),
        ("media_player", "media_play", None, None),
        ("cover", "open_cover_tilt", None, None),
        # Domains that have turn_on/turn_off but do not end up "on"/"off".
        ("climate", "turn_on", None, None),
        ("climate", "turn_off", None, "off"),
        ("vacuum", "turn_on", None, None),
        ("homeassistant", "turn_on", "climate", None),
        # The generic turn_on is for every domain that has one.
        ("lock", "turn_on", None, "on"),
    ],
)
def test_effect_state(
    domain: str, service: str, entity_domain: str | None, state: str | None
) -> None:
    assert effect_state(domain, service, entity_domain) == state
