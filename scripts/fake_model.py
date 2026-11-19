#!/usr/bin/env python3
"""A stand-in for a language model, for developing AI Drafts without one.

It is a tiny OpenAI-compatible server that answers ``POST /v1/chat/completions``
with canned change sets, chosen by words in the user's request, and
``GET /v1/models`` with the one model ``fake``. With it the whole
pipeline (context, checks, repair loop, apply, revert) can be exercised in a real
Home Assistant instance. It says nothing about how a real model behaves.

Run it, then add AI Drafts with the model source "OpenAI-compatible server",
base URL ``http://127.0.0.1:11435/v1``, model ``fake`` (any name works), no API key::

    .venv/bin/python scripts/fake_model.py [--host 127.0.0.1] [--port 11435]

The canned answers use the entities of the dev instance
(``config/configuration.yaml``): ``binary_sensor.flur_bewegungsmelder``,
``light.flurlicht`` and ``sun.sun``. The first word that matches, in this order,
decides (case-insensitive, anywhere in the request text):

``kaputt``
    First answers with text that is not JSON. When the prompt carries the
    checker's findings (a repair round), answers with the valid automation.
``Bad``
    Always uses ``light.bad`` (it does not exist), so the change set ends
    ``failed`` after three repair rounds.
``Gartenlicht``
    First uses ``light.gartenlicht`` (it does not exist). When the prompt carries
    findings, answers with a valid automation: the repair case, one round.
``Flurlicht``
    A valid automation: motion in the hallway after sunset switches the light on
    for three minutes.

Any other request gets the valid Flurlicht automation as well.
"""

from __future__ import annotations

import argparse
import json
import logging
import time
from typing import Any

from aiohttp import web

_LOGGER = logging.getLogger("fake_model")

# Present in the user prompt of a repair round, absent in the first one.
REPAIR_MARKER = "Findings of the checker"


def automation(
    alias: str, light: str = "light.flurlicht", description: str | None = None
) -> dict[str, Any]:
    """Return an automation: hallway motion after sunset, light on for 3 minutes."""
    return {
        "alias": alias,
        "description": description
        or "Switches the hallway light on for three minutes on motion after sunset.",
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
            {"action": "light.turn_on", "target": {"entity_id": light}},
            {"delay": "00:03:00"},
            {"action": "light.turn_off", "target": {"entity_id": light}},
        ],
        "mode": "restart",
    }


def change_set(*automations: dict[str, Any]) -> str:
    """Return the model output for automations to create."""
    return json.dumps(
        {
            "operations": [
                {"kind": "automation", "op": "create", "target_id": None, "after": a}
                for a in automations
            ]
        },
        indent=2,
    )


def request_text(user_prompt: str) -> str:
    """Return the request out of a prompt built by ``drafting.build_prompts``."""
    head = user_prompt.split("\n\nContext", 1)[0]
    return head.removeprefix("Request:\n").strip()


def answer(user_prompt: str) -> tuple[str, str]:
    """Return (canned answer, short description of the choice) for a prompt."""
    request = request_text(user_prompt).lower()
    repair = REPAIR_MARKER in user_prompt
    if "kaputt" in request:
        if repair:
            return change_set(automation("Flurlicht (repariert)")), "kaputt, repair"
        return (
            "Gerne! Hier ist die Automation, die du wolltest: Das Flurlicht geht "
            "bei Bewegung an. (Kein JSON, absichtlich.)",
            "kaputt, first answer is not JSON",
        )
    if "bad" in request:
        return (
            change_set(automation("Bad Licht bei Bewegung", light="light.bad")),
            "Bad, always a missing entity",
        )
    if "gartenlicht" in request:
        if repair:
            return (
                change_set(automation("Gartenlicht bei Bewegung (repariert)")),
                "Gartenlicht, repair",
            )
        return (
            change_set(
                automation("Gartenlicht bei Bewegung", light="light.gartenlicht")
            ),
            "Gartenlicht, first answer has a missing entity",
        )
    return change_set(automation("Flurlicht bei Bewegung")), "Flurlicht (valid)"


async def chat_completions(request: web.Request) -> web.Response:
    """Answer one chat completion request."""
    body = await request.json()
    messages = body.get("messages") or []
    user_prompt = next(
        (m["content"] for m in reversed(messages) if m.get("role") == "user"), ""
    )
    content, choice = answer(user_prompt)
    _LOGGER.info(
        "request %r -> %s (response_format=%s)",
        request_text(user_prompt)[:80],
        choice,
        (body.get("response_format") or {}).get("type"),
    )
    return web.json_response(
        {
            "id": f"chatcmpl-fake-{int(time.time() * 1000)}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": body.get("model", "fake-model"),
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": content},
                    "finish_reason": "stop",
                }
            ],
        }
    )


async def list_models(request: web.Request) -> web.Response:
    """Answer ``GET /v1/models`` with one model, ``fake``."""
    return web.json_response(
        {
            "object": "list",
            "data": [
                {"id": "fake", "object": "model", "created": 0, "owned_by": "fake"}
            ],
        }
    )


def create_app() -> web.Application:
    """Create the web application."""
    app = web.Application()
    app.router.add_get("/v1/models", list_models)
    app.router.add_post("/v1/chat/completions", chat_completions)
    return app


def main() -> None:
    """Run the server until interrupted."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=11435)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    web.run_app(create_app(), host=args.host, port=args.port, print=None)


if __name__ == "__main__":
    main()
