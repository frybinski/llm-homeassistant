"""Tests for the development stand-in model: it must speak the pipeline's dialect.

Sockets are blocked in tests, so the stand-in's request handler is called
directly from a mocked HTTP session instead of over the network.
"""

import importlib.util
import json
from pathlib import Path
from typing import Any

from homeassistant.core import HomeAssistant
import pytest
from pytest_homeassistant_custom_component.test_util.aiohttp import (
    AiohttpClientMocker,
    AiohttpClientMockResponse,
)

from custom_components.ai_drafts.changeset import ChangeSetStatus
from custom_components.ai_drafts.context import async_build_context
from custom_components.ai_drafts.drafting import build_prompts, parse_operations
from custom_components.ai_drafts.pipeline import async_create_draft

from .common import build_house, setup_entry

SCRIPT = Path(__file__).parent.parent / "scripts" / "fake_model.py"
URL = "http://fake.test/v1/chat/completions"


def load_fake_model() -> Any:
    spec = importlib.util.spec_from_file_location("fake_model", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakeRequest:
    def __init__(self, body: Any) -> None:
        self._body = body

    async def json(self) -> Any:
        return self._body


@pytest.mark.parametrize(
    ("request_text", "status", "rounds", "model_calls"),
    [
        (
            "Schalte das Flurlicht bei Bewegung nach Sonnenuntergang ein",
            "checked",
            0,
            1,
        ),
        ("Gartenlicht bei Bewegung", "checked", 1, 2),
        ("Licht im Bad", "failed", 3, 4),
        ("Das Flurlicht ist kaputt", "checked", 1, 2),
    ],
)
async def test_the_four_requests_through_the_real_client_and_pipeline(
    hass: HomeAssistant,
    aioclient_mock: AiohttpClientMocker,
    request_text: str,
    status: str,
    rounds: int,
    model_calls: int,
) -> None:
    fake = load_fake_model()

    async def side_effect(method: str, url: Any, data: Any) -> Any:
        response = await fake.chat_completions(FakeRequest(data))
        return AiohttpClientMockResponse(method, url, text=response.text)

    aioclient_mock.post(URL, side_effect=side_effect)
    await build_house(hass)
    entry = await setup_entry(
        hass,
        {
            "model_source": "openai_compatible",
            "base_url": "http://fake.test/v1",
            "model": "fake",
        },
    )
    change_set = await async_create_draft(hass, entry.runtime_data, request_text)
    assert change_set.status is ChangeSetStatus(status)
    assert change_set.rounds == rounds
    assert aioclient_mock.call_count == model_calls


async def test_answers_parse_as_operations(hass: HomeAssistant) -> None:
    fake = load_fake_model()
    await build_house(hass)
    context = await async_build_context(hass, "Flurlicht")
    _, first = build_prompts("Das Flurlicht", context)
    [operation] = parse_operations(fake.answer(first)[0])
    assert operation.after["alias"] == "Flurlicht bei Bewegung"
    # The repair marker the stand-in looks for is what the real prompt contains.
    _, repair = build_prompts("Das Flurlicht kaputt", context, [operation], [])
    assert fake.REPAIR_MARKER in repair
    assert fake.REPAIR_MARKER not in first


async def test_handler_answers_a_chat_completion() -> None:
    fake = load_fake_model()
    response = await fake.chat_completions(
        FakeRequest(
            {
                "model": "x",
                "messages": [
                    {"role": "system", "content": "s"},
                    {"role": "user", "content": "Request:\nFlurlicht\n\nContext..."},
                ],
            }
        )
    )
    body = json.loads(response.text)
    assert response.status == 200
    assert body["model"] == "x"
    assert body["choices"][0]["message"]["role"] == "assistant"
