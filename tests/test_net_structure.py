"""Properties every translated net has, checked on every fixture and on random ones."""

from __future__ import annotations

import random
from typing import Any

import pytest

from custom_components.ai_drafts.net import StaticResolver, translate_automation

from .net_support import case_ids, load_cases, resolver_from, structure_violations
from .test_net_translate import ALL_DEMO

FIXTURE_CASES = load_cases(
    "triggers.yaml", "conditions.yaml", "actions.yaml", "structure.yaml"
)


@pytest.mark.parametrize("case", FIXTURE_CASES, ids=case_ids(FIXTURE_CASES))
def test_fixture_is_a_valid_workflow_net(case: dict[str, Any]) -> None:
    net = translate_automation(
        case["config"],
        automation_id="x",
        source="ui",
        resolver=resolver_from(case.get("resolver")),
    )
    assert structure_violations(net) == []


@pytest.mark.parametrize(("automation_id", "config"), ALL_DEMO)
def test_demo_is_a_valid_workflow_net(
    automation_id: str, config: dict[str, Any]
) -> None:
    net = translate_automation(config, automation_id=automation_id, source="ui")
    assert structure_violations(net) == []


def test_unreadable_shapes_are_opaque_not_fatal() -> None:
    case = next(
        c for c in load_cases("structure.yaml") if c["id"] == "unreadable-shapes"
    )
    net = translate_automation(case["config"], automation_id="x", source="ui")
    assert not net.automations[0].complete
    assert len(net.automations[0].opaque) >= 6


# --- random automations ---------------------------------------------------------

ENTITIES = ["light.a", "light.b", "switch.c", "sensor.d", "binary_sensor.e"]


def random_condition(rng: random.Random, depth: int = 0) -> dict[str, Any]:
    kind = rng.choice(
        ["state", "numeric_state", "sun", "time", "template", "and", "or", "not"]
    )
    entity = rng.choice(ENTITIES)
    match kind:
        case "state":
            return {
                "condition": "state",
                "entity_id": entity,
                "state": rng.choice(["on", "off"]),
            }
        case "numeric_state":
            return {"condition": "numeric_state", "entity_id": entity, "above": 3}
        case "sun":
            return {"condition": "sun", "after": "sunset"}
        case "time":
            return {"condition": "time", "after": "10:00:00"}
        case "template":
            return {
                "condition": "template",
                "value_template": f"{{{{ is_state('{entity}', 'on') }}}}",
            }
        case _:
            parts = (
                []
                if depth > 1
                else [
                    random_condition(rng, depth + 1) for _ in range(rng.randint(1, 2))
                ]
            )
            return {"condition": kind, "conditions": parts}


def random_step(rng: random.Random, depth: int) -> dict[str, Any]:
    leaves = [
        lambda: {
            "action": rng.choice(["light.turn_on", "light.turn_off", "light.toggle"]),
            "target": {"entity_id": rng.choice(ENTITIES)},
        },
        lambda: {"action": "notify.me", "data": {"message": "x"}},
        lambda: {"delay": "00:00:01"},
        lambda: {"stop": "enough"},
        lambda: {"variables": {"a": 1}},
        lambda: random_condition(rng),
        lambda: {"wait_template": "{{ true }}"},
        lambda: {"action": "script.s"},
        lambda: {"event": "e"},
    ]
    if depth >= 3 or rng.random() < 0.55:
        return rng.choice(leaves)()
    steps = lambda: [random_step(rng, depth + 1) for _ in range(rng.randint(0, 3))]  # noqa: E731
    kind = rng.choice(["choose", "if", "parallel", "repeat", "sequence"])
    match kind:
        case "choose":
            step: dict[str, Any] = {
                "choose": [
                    {"conditions": [random_condition(rng)], "sequence": steps()}
                    for _ in range(rng.randint(0, 3))
                ]
            }
            if rng.random() < 0.5:
                step["default"] = steps()
            return step
        case "if":
            step = {"if": [random_condition(rng)], "then": steps()}
            if rng.random() < 0.5:
                step["else"] = steps()
            return step
        case "parallel":
            return {
                "parallel": [
                    rng.choice([random_step(rng, depth + 1), {"sequence": steps()}])
                    for _ in range(rng.randint(0, 3))
                ]
            }
        case "repeat":
            body = rng.choice(["count", "while", "until"])
            repeat: dict[str, Any] = {"sequence": steps()}
            repeat[body] = 2 if body == "count" else [random_condition(rng)]
            return {"repeat": repeat}
        case _:
            return {"sequence": steps()}


@pytest.mark.parametrize("seed", range(300))
def test_random_automation_is_a_valid_workflow_net(seed: int) -> None:
    rng = random.Random(seed)
    config = {
        "mode": rng.choice(["single", "restart", "queued", "parallel"]),
        "triggers": [
            rng.choice(
                [
                    {"trigger": "time", "at": "07:00:00"},
                    {"trigger": "state", "entity_id": rng.choice(ENTITIES), "to": "on"},
                    {"trigger": "numeric_state", "entity_id": "sensor.d", "above": 1},
                ]
            )
            for _ in range(rng.randint(0, 3))
        ],
        "conditions": [random_condition(rng) for _ in range(rng.randint(0, 2))],
        "actions": [random_step(rng, 0) for _ in range(rng.randint(0, 5))],
    }
    net = translate_automation(
        config, automation_id="r", source="ui", resolver=StaticResolver()
    )
    assert structure_violations(net) == [], config
