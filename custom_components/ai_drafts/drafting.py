"""Model call and structured output.

The model never writes anything. It answers a prompt with a JSON document of the
form ``{"operations": [{"kind", "op", "target_id", "after"}]}``, which this module
turns into :class:`~.changeset.Operation` objects. Two clients exist: an
OpenAI-compatible server (own HTTP client, real JSON schema) and a Home Assistant
AI Task entity (``structure`` built from selectors).
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import TYPE_CHECKING, Any, Final, Protocol

from aiohttp import ClientError
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import selector
from homeassistant.helpers.aiohttp_client import async_get_clientsession
import voluptuous as vol

from .changeset import ChangeSetError, Operation
from .const import (
    CONF_AI_TASK_ENTITY,
    CONF_API_KEY,
    CONF_BASE_URL,
    CONF_MODEL,
    CONF_MODEL_SOURCE,
    MODEL_SOURCE_AI_TASK,
    MODEL_SOURCE_OPENAI_COMPATIBLE,
)

if TYPE_CHECKING:
    from collections.abc import Mapping

    from homeassistant.core import HomeAssistant

    from .changeset import Finding
    from .context import DraftContext

_LOGGER = logging.getLogger(__name__)

REQUEST_TIMEOUT: Final = 120
TASK_NAME: Final = "AI Drafts draft"

# Only this is supported end to end in M1; the schema offers nothing else.
SUPPORTED_KINDS: Final = ("automation",)
SUPPORTED_OPS: Final = ("create",)

OPERATIONS_JSON_SCHEMA: Final[dict[str, Any]] = {
    "type": "object",
    "properties": {
        "operations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "kind": {"type": "string", "enum": list(SUPPORTED_KINDS)},
                    "op": {"type": "string", "enum": list(SUPPORTED_OPS)},
                    "target_id": {"type": ["string", "null"]},
                    "after": {"type": "object"},
                },
                "required": ["kind", "op", "after"],
            },
        }
    },
    "required": ["operations"],
}

SYSTEM_PROMPT: Final = """\
You design Home Assistant automations. You never change anything yourself: you \
only propose a change set that a deterministic checker validates and a person \
approves.

Rules:
- Answer with a single JSON object and nothing else: no prose, no Markdown, no \
code fences.
- The object has the form {"operations": [{"kind": "automation", "op": "create", \
"target_id": null, "after": {...}}]}. Only kind "automation" with op "create" is \
supported.
- "after" is one complete automation in Home Assistant's current YAML format, \
written as JSON: "alias", "description", "triggers" (each with "trigger": \
"<platform>"), "conditions" (each with "condition": "<type>"), "actions" (each \
service call with "action": "<domain.service>", plus "target" and "data"), and \
"mode". Use these plural keys, not the legacy singular ones.
- Use only entity ids and area ids that appear in the context you are given. \
Never invent an entity, area, device or service. Address devices through their \
entities. If something the request needs is missing from the context, still \
answer with your best automation, and say so in its "description".
- Do not duplicate or reuse the alias of an existing automation. Existing \
automations are listed in the context for reference.
- Durations are "HH:MM:SS" strings, for example "00:03:00". Times of day are \
"HH:MM:SS". "sun.sun" is available for sunrise and sunset logic: the "sun" \
trigger and condition use "sunset" and "sunrise"; the state "below_horizon" \
means after sunset.
"""

REPAIR_INSTRUCTIONS: Final = (
    "Your previous answer was checked and has problems. Fix every error finding "
    "and answer again with the complete corrected JSON object, in the same form."
)


class ModelError(Exception):
    """The model could not be reached or answered with something unusable."""

    def __init__(self, message: str, *, change_set_id: str | None = None) -> None:
        """Store the reason and, once known, the change set that records it."""
        super().__init__(message)
        self.change_set_id = change_set_id


class MalformedOutputError(Exception):
    """The model answered, but not in the contract's form."""


class ModelClient(Protocol):
    """Something that turns a prompt into raw model output."""

    @property
    def name(self) -> str:
        """Return the model name shown in the change set and the journal."""

    async def async_generate(self, system: str, user: str) -> Any:
        """Return the raw model output: JSON text or an already parsed object.

        Raises ModelError for anything that is not a usable answer.
        """


def build_prompts(
    request: str,
    context: DraftContext,
    previous_operations: list[Operation] | None = None,
    findings: list[Finding] | None = None,
) -> tuple[str, str]:
    """Return (system, user) text for a first attempt or a repair round."""
    parts = [
        "Request:",
        request.strip(),
        "",
        "Context (the only entities and areas you may use):",
        json.dumps(context.to_prompt_dict(), ensure_ascii=False, separators=(",", ":")),
    ]
    if previous_operations is not None:
        parts += [
            "",
            "Your previous operations:",
            json.dumps(
                [_operation_for_prompt(op) for op in previous_operations],
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            "",
            "Findings of the checker:",
            json.dumps(
                [
                    {
                        "severity": f.severity.value,
                        "check": f.check,
                        "message": f.message,
                        "path": f.path,
                    }
                    for f in findings or []
                ],
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            "",
            REPAIR_INSTRUCTIONS,
        ]
    return SYSTEM_PROMPT, "\n".join(parts)


def _operation_for_prompt(op: Operation) -> dict[str, Any]:
    return {
        "kind": op.kind.value,
        "op": op.op.value,
        "target_id": op.target_id,
        "after": op.after,
    }


_FENCE_RE: Final = re.compile(r"^\s*```(?:json)?\s*(.*?)\s*```\s*$", re.DOTALL)


def parse_operations(data: Any) -> list[Operation]:
    """Turn model output (JSON text or a parsed object) into operations.

    Raises MalformedOutputError with a message that is fit to show to the model.
    """
    if isinstance(data, str):
        text = data.strip()
        if match := _FENCE_RE.match(text):
            text = match.group(1)
        try:
            data = json.loads(text)
        except ValueError as err:
            raise MalformedOutputError(
                f"the answer is not valid JSON ({err})"
            ) from None
    if not isinstance(data, dict):
        raise MalformedOutputError("the answer must be a JSON object")
    raw_operations = data.get("operations")
    if not isinstance(raw_operations, list):
        raise MalformedOutputError("the answer needs an 'operations' list")
    if not raw_operations:
        raise MalformedOutputError("'operations' is empty")
    operations: list[Operation] = []
    for index, raw in enumerate(raw_operations):
        if not isinstance(raw, dict):
            raise MalformedOutputError(f"operations[{index}] must be an object")
        raw = dict(raw)
        # AI Task cannot express a free-form object (see build_ai_task_structure),
        # so there "after" travels as JSON text.
        if isinstance(raw.get("after"), str):
            try:
                raw["after"] = json.loads(raw["after"])
            except ValueError as err:
                raise MalformedOutputError(
                    f"operations[{index}].after is not valid JSON ({err})"
                ) from None
        raw.pop("before", None)
        try:
            operations.append(Operation.from_dict(raw))
        except ChangeSetError as err:
            raise MalformedOutputError(f"operations[{index}]: {err}") from None
    return operations


class OpenAICompatibleClient:
    """Client for a server that speaks ``POST {base_url}/chat/completions``."""

    def __init__(
        self,
        hass: HomeAssistant,
        base_url: str,
        model: str,
        api_key: str | None = None,
    ) -> None:
        """Initialize the client; nothing is sent until ``async_generate``."""
        self._hass = hass
        self._url = f"{base_url.rstrip('/')}/chat/completions"
        self._model = model
        self._api_key = api_key

    @property
    def name(self) -> str:
        """Return the model name."""
        return self._model

    def _payload(
        self, system: str, user: str, response_format: dict[str, Any]
    ) -> dict[str, Any]:
        return {
            "model": self._model,
            "temperature": 0,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": response_format,
        }

    async def async_generate(self, system: str, user: str) -> Any:
        """Ask the server; retry once with ``json_object`` if it answers 400."""
        formats: tuple[dict[str, Any], ...] = (
            {
                "type": "json_schema",
                "json_schema": {
                    "name": "change_set",
                    "strict": False,
                    "schema": OPERATIONS_JSON_SCHEMA,
                },
            },
            {"type": "json_object"},
        )
        for index, response_format in enumerate(formats):
            status, body = await self._post(
                self._payload(system, user, response_format)
            )
            if status == 400 and index == 0:
                _LOGGER.debug("Server rejected json_schema, retrying with json_object")
                continue
            if not 200 <= status < 300:
                raise ModelError(
                    f"the model server answered HTTP {status}: {body[:200]}"
                )
            return self._extract_content(body)
        raise AssertionError("unreachable")  # pragma: no cover

    async def _post(self, payload: dict[str, Any]) -> tuple[int, str]:
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        session = async_get_clientsession(self._hass)
        try:
            async with asyncio.timeout(REQUEST_TIMEOUT):
                response = await session.post(self._url, json=payload, headers=headers)
                async with response:
                    return response.status, await response.text()
        except TimeoutError:
            raise ModelError(
                f"the model server did not answer within {REQUEST_TIMEOUT} seconds"
            ) from None
        except (ClientError, OSError) as err:
            raise ModelError(f"could not reach the model server: {err}") from None

    @staticmethod
    def _extract_content(body: str) -> Any:
        try:
            content = json.loads(body)["choices"][0]["message"]["content"]
        except ValueError, KeyError, IndexError, TypeError:
            raise ModelError(
                "the model server's answer is not a chat completion"
            ) from None
        if not isinstance(content, str):
            raise ModelError("the model server's answer has no text content")
        return content


def build_ai_task_structure() -> vol.Schema:
    """Return the ``structure`` for ``ai_task.async_generate_data``.

    ``structure`` is a schema built from selectors, not JSON Schema: nesting goes
    through the ``object`` selector with ``fields`` and ``multiple``. A free-form
    object (what ``after`` is) is an ``object`` selector without ``fields``, but
    OpenAI's AI Task entity refuses such a field in its strict output mode, so
    ``after`` is a text field that carries the automation as JSON text;
    ``parse_operations`` accepts both.
    """
    operation_fields = {
        "kind": {
            "required": True,
            "selector": {"select": {"options": list(SUPPORTED_KINDS)}},
        },
        "op": {
            "required": True,
            "selector": {"select": {"options": list(SUPPORTED_OPS)}},
        },
        "target_id": {"selector": {"text": {}}},
        "after": {"required": True, "selector": {"text": {"multiline": True}}},
    }
    return vol.Schema(
        {
            vol.Required(
                "operations",
                description="The operations of the change set.",
            ): selector.ObjectSelector(
                {"multiple": True, "fields": operation_fields}  # type: ignore[typeddict-item]
            )
        }
    )


class AITaskClient:
    """Client that uses a Home Assistant AI Task entity."""

    def __init__(self, hass: HomeAssistant, entity_id: str | None) -> None:
        """Initialize; ``None`` means the preferred AI Task entity."""
        self._hass = hass
        self._entity_id = entity_id

    @property
    def name(self) -> str:
        """Return the entity id, or a label for the preferred entity."""
        return self._entity_id or "ai_task (preferred entity)"

    async def async_generate(self, system: str, user: str) -> Any:
        """Run ``ai_task.async_generate_data`` and return its data."""
        if "ai_task" not in self._hass.config.components:
            raise ModelError(
                "the AI Task integration is not loaded; set up an AI integration "
                "that provides an AI Task entity"
            )
        # Imported late: ai_task is only an after_dependency and pulls in a lot.
        from homeassistant.components import ai_task

        try:
            result = await ai_task.async_generate_data(
                self._hass,
                task_name=TASK_NAME,
                entity_id=self._entity_id,
                instructions=f"{system}\n\n{user}",
                structure=build_ai_task_structure(),
            )
        except HomeAssistantError as err:
            raise ModelError(f"the AI Task entity failed: {err}") from None
        return result.data


def async_client_from_entry_data(
    hass: HomeAssistant, data: Mapping[str, Any]
) -> ModelClient:
    """Create the client that the config entry data asks for."""
    source = data.get(CONF_MODEL_SOURCE)
    if source == MODEL_SOURCE_AI_TASK:
        return AITaskClient(hass, data.get(CONF_AI_TASK_ENTITY) or None)
    if source == MODEL_SOURCE_OPENAI_COMPATIBLE:
        return OpenAICompatibleClient(
            hass,
            data[CONF_BASE_URL],
            data[CONF_MODEL],
            data.get(CONF_API_KEY) or None,
        )
    raise ModelError(f"unknown model source {source!r}")
