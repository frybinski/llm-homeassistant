"""Draft pipeline: context, model call, checks and the repair loop."""

from __future__ import annotations

from collections import Counter
import logging
import time
from typing import TYPE_CHECKING, Any

from .changeset import (
    MAX_REPAIR_ROUNDS,
    ChangeSet,
    ChangeSetStatus,
    Finding,
    Severity,
)
from .checks.validity import async_run_checks
from .context import async_build_context
from .drafting import (
    MalformedOutputError,
    ModelClient,
    ModelError,
    async_client_from_entry_data,
    build_prompts,
    parse_operations,
)
from .journal import (
    EVENT_CHECK,
    EVENT_CREATED,
    EVENT_DRAFT_ROUND,
    EVENT_FAILED,
    EVENT_MODEL_ERROR,
)

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .context import DraftContext
    from .data import AIDraftsData

_LOGGER = logging.getLogger(__name__)

MALFORMED_CHECK = "drafting.output"


class DraftBusyError(Exception):
    """Another draft is still running."""


def _malformed_finding(err: MalformedOutputError) -> Finding:
    return Finding(
        Severity.ERROR,
        MALFORMED_CHECK,
        f"The answer could not be used: {err}. Answer with one JSON object of "
        'the form {"operations": [...]} and nothing else.',
    )


def _counts(findings: list[Finding]) -> dict[str, int]:
    counter = Counter(f.severity.value for f in findings)
    return {s.value: counter.get(s.value, 0) for s in Severity}


async def async_create_draft(
    hass: HomeAssistant,
    data: AIDraftsData,
    request: str,
    *,
    client: ModelClient | None = None,
) -> ChangeSet:
    """Draft a change set for a request, with up to three repair rounds.

    Returns the stored change set: ``checked`` when the checks found no error,
    ``failed`` when the repair rounds ran out. Raises DraftBusyError if a draft
    is already running and ModelError if the model could not be used (the failed
    change set is stored and its id is on the exception).
    """
    if data.draft_lock.locked():
        raise DraftBusyError("another draft is still running")
    async with data.draft_lock:
        if client is None:
            client = async_client_from_entry_data(hass, data.entry.data)
        context = await async_build_context(hass, request)
        return await _run(hass, data, request, client, context)


async def _call_model(
    data: AIDraftsData,
    change_set: ChangeSet | None,
    client: ModelClient,
    system: str,
    user: str,
) -> tuple[Any, float]:
    started = time.monotonic()
    try:
        raw = await client.async_generate(system, user)
    except ModelError as err:
        if change_set is not None:
            await data.journal.async_log(
                change_set.id, EVENT_MODEL_ERROR, {"reason": str(err)}
            )
        raise
    return raw, time.monotonic() - started


async def _fail_on_model_error(
    data: AIDraftsData,
    change_set: ChangeSet | None,
    request: str,
    client: ModelClient,
    err: ModelError,
) -> None:
    """Record a model error on the change set (creating it if there is none yet)."""
    if change_set is None:
        change_set = ChangeSet.new(request, [], client.name)
        await data.changesets.async_add(change_set)
        await data.journal.async_log(
            change_set.id, EVENT_CREATED, {"request": request, "model": client.name}
        )
        await data.journal.async_log(
            change_set.id, EVENT_MODEL_ERROR, {"reason": str(err)}
        )
    change_set.fail(str(err))
    await data.changesets.async_update(change_set)
    await data.journal.async_log(change_set.id, EVENT_FAILED, {"reason": str(err)})
    err.change_set_id = change_set.id


async def _run(
    hass: HomeAssistant,
    data: AIDraftsData,
    request: str,
    client: ModelClient,
    context: DraftContext,
) -> ChangeSet:
    change_set: ChangeSet | None = None
    system, user = build_prompts(request, context)
    round_number = 0
    while True:
        try:
            raw, duration = await _call_model(data, change_set, client, system, user)
        except ModelError as err:
            await _fail_on_model_error(data, change_set, request, client, err)
            raise

        malformed: Finding | None = None
        try:
            operations = parse_operations(raw)
        except MalformedOutputError as err:
            malformed = _malformed_finding(err)
            # Keep what was there (nothing in the first round) for the next prompt.
            operations = [] if change_set is None else list(change_set.operations)

        if change_set is None:
            change_set = ChangeSet.new(request, operations, client.name)
            await data.changesets.async_add(change_set)
            await data.journal.async_log(
                change_set.id,
                EVENT_CREATED,
                {"request": request, "model": client.name},
            )
        else:
            change_set.revise(operations)
            await data.changesets.async_update(change_set)

        await data.journal.async_log(
            change_set.id,
            EVENT_DRAFT_ROUND,
            {
                "round": round_number,
                "model": client.name,
                "duration_seconds": round(duration, 3),
                "operations": len(operations),
                "malformed": malformed is not None,
                "context_size": context.size,
                "context_truncated": context.truncated,
            },
        )

        findings = (
            [malformed]
            if malformed is not None
            else await async_run_checks(hass, change_set)
        )
        change_set.complete_check(findings)
        await data.changesets.async_update(change_set)
        await data.journal.async_log(
            change_set.id,
            EVENT_CHECK,
            {"round": round_number, "counts": _counts(findings)},
        )

        if change_set.status is not ChangeSetStatus.DRAFT:
            return change_set
        if change_set.rounds >= MAX_REPAIR_ROUNDS:
            reason = (
                f"Still invalid after {MAX_REPAIR_ROUNDS} repair rounds; "
                "the change set cannot be applied."
            )
            change_set.fail(reason)
            await data.changesets.async_update(change_set)
            await data.journal.async_log(
                change_set.id, EVENT_FAILED, {"reason": reason}
            )
            return change_set

        round_number += 1
        system, user = build_prompts(
            request, context, change_set.operations, change_set.findings
        )
