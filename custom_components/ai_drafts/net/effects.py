"""The effect table: which state an action call leads to.

Only calls in this table lead to a named state place; every other call writes
the ``*`` place of its targets (specification, "Effects").
"""

from __future__ import annotations

from typing import Final

# Any domain: ``turn_on`` leads to ``on`` and ``turn_off`` to ``off``.
GENERIC_EFFECTS: Final[dict[str, str]] = {
    "turn_on": "on",
    "turn_off": "off",
}

# (domain, service) -> state.
DOMAIN_EFFECTS: Final[dict[tuple[str, str], str]] = {
    ("lock", "lock"): "locked",
    ("lock", "unlock"): "unlocked",
    ("cover", "open_cover"): "open",
    ("cover", "close_cover"): "closed",
}

# Domains that have ``turn_on`` or ``turn_off`` but whose state is not ``on`` or
# ``off`` afterwards (a heating mode, a cleaning state). The ``*`` place is
# the honest answer for them.
NOT_ON_OFF: Final[frozenset[tuple[str, str]]] = frozenset(
    {
        ("climate", "turn_on"),
        ("vacuum", "turn_on"),
        ("vacuum", "turn_off"),
        ("water_heater", "turn_on"),
        ("water_heater", "turn_off"),
    }
)

# Calling these runs something else; their effects are not followed.
INDIRECT_DOMAINS: Final = frozenset({"script"})
INDIRECT_SERVICES: Final = frozenset({"scene.turn_on", "automation.trigger"})
# Entities of these domains are run, not switched, when a generic service
# (``homeassistant.turn_on``) targets them.
INDIRECT_ENTITY_DOMAINS: Final = frozenset({"script", "scene"})


def effect_state(
    domain: str, service: str, entity_domain: str | None = None
) -> str | None:
    """Return the state a call leads to, or None when the table does not say.

    ``domain`` is the domain of the called action. For ``homeassistant`` the
    domain of the target entity decides, because that action works on any
    domain.
    """
    target_domain = entity_domain if domain == "homeassistant" else domain
    if target_domain is None:
        target_domain = domain
    if (target_domain, service) in NOT_ON_OFF:
        return None
    if (state := DOMAIN_EFFECTS.get((domain, service))) is not None:
        return state
    return GENERIC_EFFECTS.get(service)
