"""Tests for the draft pipeline with a scripted model client."""

import asyncio
import copy
from datetime import datetime
import json
from typing import Any

from homeassistant.core import HomeAssistant
import pytest

from custom_components.ai_drafts.changeset import (
    MAX_REPAIR_ROUNDS,
    ChangeSetStatus,
    Severity,
)
from custom_components.ai_drafts.data import AIDraftsData
from custom_components.ai_drafts.drafting import ModelError
from custom_components.ai_drafts.pipeline import (
    DraftBusyError,
    async_create_draft,
)

from .common import (
    ScriptedClient,
    build_house,
    flur_automation,
    operations_json,
    setup_entry,
)

REQUEST = "Schalte das Flurlicht bei Bewegung nach Sonnenuntergang für 3 Minuten ein"


@pytest.fixture
async def data(hass: HomeAssistant) -> AIDraftsData:
    await build_house(hass)
    entry = await setup_entry(hass)
    return entry.runtime_data


def bad_automation() -> dict[str, Any]:
    after = flur_automation()
    after["actions"][0]["target"]["entity_id"] = "light.gartenlicht"
    return after


def events(data: AIDraftsData, change_set_id: str) -> list[str]:
    return [e["event"] for e in data.journal.list(change_set_id)]


class Spy:
    """Record the state of every change set at each persist call."""

    def __init__(self, data: AIDraftsData) -> None:
        self.states: list[dict[str, Any]] = []
        for name in ("async_add", "async_update"):
            original = getattr(data.changesets, name)

            async def wrapper(change_set: Any, original: Any = original) -> None:
                self.states.append(copy.deepcopy(change_set.to_dict()))
                await original(change_set)

            setattr(data.changesets, name, wrapper)


async def test_valid_draft_is_checked_at_once(
    hass: HomeAssistant, data: AIDraftsData
) -> None:
    client = ScriptedClient(operations_json(flur_automation()))
    change_set = await async_create_draft(hass, data, REQUEST, client=client)

    assert change_set.status is ChangeSetStatus.CHECKED
    assert change_set.rounds == 0
    assert change_set.findings == []
    assert change_set.model == "scripted-model"
    assert change_set.request == REQUEST
    assert len(client.calls) == 1
    assert data.changesets.get(change_set.id) is change_set
    _system, user = client.calls[0]
    assert "light.flurlicht" in user
    assert REQUEST in user
    assert events(data, change_set.id) == ["created", "draft_round", "check"]


async def test_invalid_then_valid_is_repaired(
    hass: HomeAssistant, data: AIDraftsData
) -> None:
    client = ScriptedClient(
        operations_json(bad_automation()), operations_json(flur_automation())
    )
    change_set = await async_create_draft(hass, data, REQUEST, client=client)

    assert change_set.status is ChangeSetStatus.CHECKED
    assert change_set.rounds == 1
    assert len(client.calls) == 2
    repair_user = client.calls[1][1]
    assert "light.gartenlicht" in repair_user  # previous operations
    assert "validity.entity" in repair_user  # findings
    assert "does not exist" in repair_user
    assert change_set.operations[0].after == flur_automation()
    assert events(data, change_set.id) == [
        "created",
        "draft_round",
        "check",
        "draft_round",
        "check",
    ]


async def test_always_invalid_ends_failed_after_three_rounds(
    hass: HomeAssistant, data: AIDraftsData
) -> None:
    client = ScriptedClient(operations_json(bad_automation()))
    change_set = await async_create_draft(hass, data, REQUEST, client=client)

    assert change_set.status is ChangeSetStatus.FAILED
    assert change_set.rounds == MAX_REPAIR_ROUNDS == 3
    assert len(client.calls) == 4  # the first answer and three repairs
    errors = [f for f in change_set.findings if f.severity is Severity.ERROR]
    assert {f.check for f in errors} == {"validity.entity", "pipeline"}
    assert "3 repair rounds" in next(f for f in errors if f.check == "pipeline").message
    assert events(data, change_set.id)[-1] == "failed"
    assert not change_set.decided


async def test_malformed_output_is_repaired_like_any_error(
    hass: HomeAssistant, data: AIDraftsData
) -> None:
    client = ScriptedClient(
        "Sure! Here is your automation: ...", operations_json(flur_automation())
    )
    change_set = await async_create_draft(hass, data, REQUEST, client=client)

    assert change_set.status is ChangeSetStatus.CHECKED
    assert change_set.rounds == 1
    repair_user = client.calls[1][1]
    assert "drafting.output" in repair_user
    assert "not valid JSON" in repair_user


async def test_malformed_output_in_a_repair_round_keeps_the_operations(
    hass: HomeAssistant, data: AIDraftsData
) -> None:
    client = ScriptedClient(
        operations_json(bad_automation()), "oops", operations_json(flur_automation())
    )
    change_set = await async_create_draft(hass, data, REQUEST, client=client)
    assert change_set.status is ChangeSetStatus.CHECKED
    assert change_set.rounds == 2
    # In the third call the model still sees its own last valid proposal.
    assert "light.gartenlicht" in client.calls[2][1]
    assert "drafting.output" in client.calls[2][1]


async def test_always_malformed_ends_failed(
    hass: HomeAssistant, data: AIDraftsData
) -> None:
    client = ScriptedClient("nope")
    change_set = await async_create_draft(hass, data, REQUEST, client=client)
    assert change_set.status is ChangeSetStatus.FAILED
    assert change_set.rounds == 3
    assert len(client.calls) == 4
    assert change_set.operations == []


async def test_model_error_fails_at_once_and_records_the_reason(
    hass: HomeAssistant, data: AIDraftsData
) -> None:
    client = ScriptedClient(ModelError("could not reach the model server: refused"))
    with pytest.raises(ModelError, match="refused") as err:
        await async_create_draft(hass, data, REQUEST, client=client)

    assert len(client.calls) == 1
    change_set = data.changesets.get(err.value.change_set_id)
    assert change_set.status is ChangeSetStatus.FAILED
    assert change_set.rounds == 0
    assert change_set.operations == []
    [finding] = change_set.findings
    assert finding.severity is Severity.ERROR
    assert "refused" in finding.message
    assert events(data, change_set.id) == ["created", "model_error", "failed"]
    [model_error] = [
        e for e in data.journal.list(change_set.id) if e["event"] == "model_error"
    ]
    assert "refused" in model_error["data"]["reason"]


async def test_model_error_in_a_repair_round_fails_the_change_set(
    hass: HomeAssistant, data: AIDraftsData
) -> None:
    client = ScriptedClient(operations_json(bad_automation()), ModelError("timeout"))
    with pytest.raises(ModelError, match="timeout") as err:
        await async_create_draft(hass, data, REQUEST, client=client)
    change_set = data.changesets.get(err.value.change_set_id)
    assert change_set.status is ChangeSetStatus.FAILED
    assert change_set.rounds == 0
    assert change_set.operations  # the first proposal is still there
    assert "timeout" in change_set.findings[-1].message
    assert events(data, change_set.id)[-3:] == ["check", "model_error", "failed"]
    # The pipeline is free again.
    assert not data.draft_lock.locked()


async def test_unsupported_operation_never_reaches_checked(
    hass: HomeAssistant, data: AIDraftsData
) -> None:
    script = json.dumps(
        {"operations": [{"kind": "script", "op": "create", "after": {"sequence": []}}]}
    )
    client = ScriptedClient(script)
    change_set = await async_create_draft(hass, data, REQUEST, client=client)
    assert change_set.status is ChangeSetStatus.FAILED
    assert {f.check for f in change_set.findings} >= {"validity.unsupported"}


async def test_warnings_do_not_block(hass: HomeAssistant, data: AIDraftsData) -> None:
    after = flur_automation()
    after["conditions"] = [
        {"condition": "template", "value_template": "{{ states('sun.sun') | int }}"}
    ]
    change_set = await async_create_draft(
        hass, data, REQUEST, client=ScriptedClient(operations_json(after))
    )
    assert change_set.status is ChangeSetStatus.CHECKED
    assert [f.severity for f in change_set.findings] == [Severity.WARNING]


async def test_second_request_while_one_runs_is_busy(
    hass: HomeAssistant, data: AIDraftsData
) -> None:
    release = asyncio.Event()

    class Blocking(ScriptedClient):
        async def async_generate(self, system: str, user: str) -> Any:
            await release.wait()
            return await super().async_generate(system, user)

    first = hass.async_create_task(
        async_create_draft(
            hass, data, REQUEST, client=Blocking(operations_json(flur_automation()))
        )
    )
    await asyncio.sleep(0)
    await asyncio.sleep(0)
    assert data.draft_lock.locked()
    with pytest.raises(DraftBusyError):
        await async_create_draft(
            hass,
            data,
            "other",
            client=ScriptedClient(operations_json(flur_automation())),
        )
    release.set()
    assert (await first).status is ChangeSetStatus.CHECKED
    assert not data.draft_lock.locked()
    assert len(data.changesets.list()) == 1  # the refused request left nothing


async def test_every_transition_is_persisted(
    hass: HomeAssistant, data: AIDraftsData, hass_storage: dict[str, Any]
) -> None:
    spy = Spy(data)
    client = ScriptedClient(
        operations_json(bad_automation()), operations_json(flur_automation())
    )
    change_set = await async_create_draft(hass, data, REQUEST, client=client)

    summary = [(s["status"], s["rounds"], len(s["findings"])) for s in spy.states]
    assert summary == [
        ("draft", 0, 0),  # stored right after the model answered
        ("draft", 0, 1),  # checked: one error finding
        ("draft", 1, 0),  # revised
        ("checked", 1, 0),
    ]
    stored = hass_storage["ai_drafts.changesets"]["data"]["changesets"]
    assert stored[0]["id"] == change_set.id
    assert stored[0]["status"] == "checked"


async def test_journal_round_entries_carry_the_facts(
    hass: HomeAssistant, data: AIDraftsData
) -> None:
    client = ScriptedClient(
        operations_json(bad_automation()), operations_json(flur_automation())
    )
    change_set = await async_create_draft(hass, data, REQUEST, client=client)
    entries = data.journal.list(change_set.id)
    for entry in entries:
        assert entry["change_set_id"] == change_set.id
        datetime.fromisoformat(entry["ts"])
    created, round0, check0, round1, check1 = entries
    assert created["data"] == {"request": REQUEST, "model": "scripted-model"}
    assert round0["data"]["round"] == 0
    assert round0["data"]["model"] == "scripted-model"
    assert round0["data"]["operations"] == 1
    assert round0["data"]["context_size"] > 0
    assert round0["data"]["context_truncated"] is False
    assert isinstance(round0["data"]["duration_seconds"], float)
    assert check0["data"] == {
        "round": 0,
        "counts": {"error": 1, "warning": 0, "info": 0},
    }
    assert round1["data"]["round"] == 1
    assert check1["data"]["counts"] == {"error": 0, "warning": 0, "info": 0}


async def test_client_comes_from_the_config_entry(
    hass: HomeAssistant, data: AIDraftsData, aioclient_mock: Any
) -> None:
    aioclient_mock.post(
        "http://model.test/v1/chat/completions",
        json={
            "choices": [{"message": {"content": operations_json(flur_automation())}}]
        },
    )
    change_set = await async_create_draft(hass, data, REQUEST)
    assert change_set.status is ChangeSetStatus.CHECKED
    assert change_set.model == "test-model"
    assert aioclient_mock.call_count == 1
