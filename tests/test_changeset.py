"""Tests for the change set model and state machine (plain Python, no hass)."""

from datetime import UTC, datetime
import re
from typing import Any

import pytest

from custom_components.ai_drafts.changeset import (
    ALLOWED_TRANSITIONS,
    MAX_REPAIR_ROUNDS,
    ApplyBlockedError,
    ChangeSet,
    ChangeSetError,
    ChangeSetStatus,
    Finding,
    InvalidTransitionError,
    Operation,
    OperationKind,
    OperationType,
    RepairLimitError,
    Severity,
)

S = ChangeSetStatus

ERROR = Finding(Severity.ERROR, "schema", "broken", "action[0]")
WARNING = Finding(Severity.WARNING, "plausibility", "odd")
INFO = Finding(Severity.INFO, "note", "fyi")
REFERENCING = Finding(
    Severity.WARNING, "conflicts", "clash", None, ("p:light.a:on", "t:x:trigger:0")
)


def make_op(**overrides: Any) -> Operation:
    """Return a valid create operation, with fields overridden."""
    fields: dict[str, Any] = {
        "kind": OperationKind.AUTOMATION,
        "op": OperationType.CREATE,
        "after": {"alias": "Flur", "triggers": []},
    }
    fields.update(overrides)
    return Operation(**fields)


def make_changeset(status: ChangeSetStatus = S.DRAFT) -> ChangeSet:
    """Return a change set forced into ``status`` (bypassing the machine)."""
    cs = ChangeSet.new("Turn on the light", [make_op()], "ai_task.test")
    cs.status = status
    return cs


# --- Transition table ---------------------------------------------------------

# method name -> (callable taking a change set, set of statuses it is allowed from)
ACTIONS: dict[str, Any] = {
    "complete_check": (lambda cs: cs.complete_check([]), {S.DRAFT}),
    "revise": (lambda cs: cs.revise([make_op()]), {S.DRAFT}),
    "fail": (lambda cs: cs.fail("boom"), {S.DRAFT}),
    "apply": (lambda cs: cs.apply(), {S.CHECKED}),
    "discard": (lambda cs: cs.discard(), {S.DRAFT, S.CHECKED, S.FAILED}),
    "revert": (lambda cs: cs.revert(), {S.APPLIED}),
}

PAIRS = [(status, name) for status in S for name in ACTIONS]


@pytest.mark.parametrize(("status", "action"), PAIRS)
def test_every_status_action_pair(status: ChangeSetStatus, action: str) -> None:
    run, allowed_from = ACTIONS[action]
    cs = make_changeset(status)
    if status in allowed_from:
        run(cs)
    else:
        with pytest.raises(InvalidTransitionError):
            run(cs)
        assert cs.status is status


def test_transition_table_is_exhaustive_and_terminal_states_are_final() -> None:
    assert set(ALLOWED_TRANSITIONS) == set(S)
    assert ALLOWED_TRANSITIONS[S.REVERTED] == frozenset()
    assert ALLOWED_TRANSITIONS[S.DISCARDED] == frozenset()


@pytest.mark.parametrize(
    ("action", "start", "end"),
    [
        ("complete_check", S.DRAFT, S.CHECKED),
        ("fail", S.DRAFT, S.FAILED),
        ("discard", S.DRAFT, S.DISCARDED),
        ("discard", S.CHECKED, S.DISCARDED),
        ("discard", S.FAILED, S.DISCARDED),
        ("apply", S.CHECKED, S.APPLIED),
        ("revert", S.APPLIED, S.REVERTED),
    ],
)
def test_resulting_status(action: str, start: ChangeSetStatus, end: ChangeSetStatus):
    cs = make_changeset(start)
    ACTIONS[action][0](cs)
    assert cs.status is end


def test_new_changeset() -> None:
    cs = ChangeSet.new("req", [make_op()], "m")
    assert cs.status is S.DRAFT
    assert cs.rounds == 0
    assert cs.findings == []
    assert cs.decided is None
    assert re.fullmatch(r"cs_[0-9A-Z]{26}", cs.id)
    assert cs.created.tzinfo is not None
    assert cs.created.utcoffset() == UTC.utcoffset(None)
    assert ChangeSet.new("req", [], None).id != cs.id


# --- complete_check / revise / fail -------------------------------------------


def test_complete_check_without_errors_becomes_checked() -> None:
    cs = make_changeset()
    cs.complete_check([WARNING, INFO])
    assert cs.status is S.CHECKED
    assert cs.findings == [WARNING, INFO]


def test_complete_check_with_errors_stays_draft() -> None:
    cs = make_changeset()
    cs.complete_check([ERROR, WARNING])
    assert cs.status is S.DRAFT
    assert cs.findings == [ERROR, WARNING]


def test_revise_replaces_operations_clears_findings_counts_round() -> None:
    cs = make_changeset()
    cs.complete_check([ERROR])
    new_op = make_op(after={"alias": "Fixed"})
    cs.revise([new_op])
    assert cs.operations == [new_op]
    assert cs.findings == []
    assert cs.rounds == 1
    assert cs.status is S.DRAFT


def test_repair_limit() -> None:
    cs = make_changeset()
    for expected in range(1, MAX_REPAIR_ROUNDS + 1):
        cs.complete_check([ERROR])
        cs.revise([make_op()])
        assert cs.rounds == expected
    assert MAX_REPAIR_ROUNDS == 3
    cs.complete_check([ERROR])
    with pytest.raises(RepairLimitError):
        cs.revise([make_op()])
    assert cs.rounds == MAX_REPAIR_ROUNDS
    assert cs.findings == [ERROR]  # untouched by the refused revision
    cs.fail("gave up")
    assert cs.status is S.FAILED


def test_fail_appends_pipeline_error() -> None:
    cs = make_changeset()
    cs.fail("model unreachable")
    assert cs.findings == [Finding(Severity.ERROR, "pipeline", "model unreachable")]


def test_fail_without_reason_adds_no_finding() -> None:
    cs = make_changeset()
    cs.fail()
    assert cs.findings == []


# --- apply guard --------------------------------------------------------------


def test_apply_sets_decided_and_ignores_warnings() -> None:
    cs = make_changeset()
    cs.complete_check([WARNING, INFO])
    assert cs.decided is None
    cs.apply()
    assert cs.status is S.APPLIED
    assert cs.decided is not None
    assert cs.decided.tzinfo is not None


def test_apply_blocked_by_error_even_when_status_is_checked() -> None:
    data = make_changeset(S.CHECKED).to_dict()
    data["findings"] = [ERROR.to_dict()]
    cs = ChangeSet.from_dict(data)  # reachable through storage
    assert cs.status is S.CHECKED
    with pytest.raises(ApplyBlockedError):
        cs.apply()
    assert cs.status is S.CHECKED
    assert cs.decided is None


def test_discard_sets_decided_and_revert_keeps_it() -> None:
    cs = make_changeset()
    cs.discard()
    assert cs.decided is not None

    applied = make_changeset(S.CHECKED)
    applied.apply()
    decided = applied.decided
    applied.revert()
    assert applied.status is S.REVERTED
    assert applied.decided == decided


def test_all_errors_derive_from_base() -> None:
    for err in (InvalidTransitionError, RepairLimitError, ApplyBlockedError):
        assert issubclass(err, ChangeSetError)


# --- operation invariants -----------------------------------------------------


@pytest.mark.parametrize(
    "kwargs",
    [
        {"op": OperationType.CREATE, "after": {"a": 1}},
        {"op": OperationType.CREATE, "after": {"a": 1}, "target_id": "x"},
        {"op": OperationType.UPDATE, "target_id": "x", "after": {"a": 1}},
        {
            "op": OperationType.UPDATE,
            "target_id": "x",
            "before": {"a": 0},
            "after": {"a": 1},
        },
        {"op": OperationType.DELETE, "target_id": "x"},
        {"op": OperationType.DELETE, "target_id": "x", "before": {"a": 0}},
    ],
)
def test_valid_operations(kwargs: dict[str, Any]) -> None:
    Operation(kind=OperationKind.SCRIPT, **kwargs)


@pytest.mark.parametrize(
    "kwargs",
    [
        {"op": OperationType.CREATE},  # no after
        {"op": OperationType.CREATE, "after": {"a": 1}, "before": {"a": 0}},
        {"op": OperationType.UPDATE, "after": {"a": 1}},  # no target
        {"op": OperationType.UPDATE, "target_id": "x"},  # no after
        {"op": OperationType.DELETE},  # no target
        {"op": OperationType.DELETE, "target_id": "x", "after": {"a": 1}},
        {"op": OperationType.CREATE, "after": [1]},  # not an object
        {"op": OperationType.CREATE, "after": {"a": 1}, "target_id": ""},
    ],
)
def test_invalid_operations(kwargs: dict[str, Any]) -> None:
    with pytest.raises(ChangeSetError):
        Operation(kind=OperationKind.AUTOMATION, **kwargs)


# --- serialization ------------------------------------------------------------

EXPECTED_KEYS = {
    "id",
    "request",
    "status",
    "operations",
    "findings",
    "model",
    "rounds",
    "created",
    "decided",
}


def full_changeset() -> ChangeSet:
    cs = ChangeSet.new(
        "Turn on the light",
        [
            make_op(),
            make_op(
                kind=OperationKind.DASHBOARD_CARD,
                op=OperationType.UPDATE,
                target_id="lovelace.0",
                before={"type": "button"},
                after={"type": "light"},
            ),
            make_op(op=OperationType.DELETE, target_id="old", after=None),
        ],
        "ai_task.test",
    )
    cs.complete_check([WARNING, REFERENCING])
    cs.apply()
    return cs


def test_to_dict_has_exactly_the_contract_keys() -> None:
    data = full_changeset().to_dict()
    assert set(data) == EXPECTED_KEYS
    assert set(data["operations"][0]) == {"kind", "op", "target_id", "before", "after"}
    assert set(data["findings"][0]) == {
        "severity",
        "check",
        "message",
        "path",
        "net_refs",
    }
    assert data["status"] == "applied"
    assert data["operations"][0]["kind"] == "automation"
    assert datetime.fromisoformat(data["created"]).utcoffset() is not None
    assert datetime.fromisoformat(data["decided"]).utcoffset() is not None
    assert make_changeset().to_dict()["decided"] is None


def test_round_trip() -> None:
    cs = full_changeset()
    again = ChangeSet.from_dict(cs.to_dict())
    assert again == cs
    assert again.to_dict() == cs.to_dict()


def test_round_trip_through_json() -> None:
    import json

    cs = full_changeset()
    assert ChangeSet.from_dict(json.loads(json.dumps(cs.to_dict()))) == cs


def _mutated(**changes: Any) -> dict[str, Any]:
    data = full_changeset().to_dict()
    data.update(changes)
    return data


@pytest.mark.parametrize(
    "bad",
    [
        None,
        [],
        "x",
        _mutated(id="nope"),
        _mutated(id=5),
        _mutated(request=""),
        _mutated(status="unknown"),
        _mutated(status=None),
        _mutated(operations={}),
        _mutated(operations=[{"kind": "automation", "op": "create"}]),
        _mutated(operations=[{"kind": "nope", "op": "create", "after": {}}]),
        _mutated(operations=["x"]),
        _mutated(findings=[{"severity": "fatal", "check": "c", "message": "m"}]),
        _mutated(findings=[{"severity": "error", "check": "c"}]),
        _mutated(findings="x"),
        _mutated(model=3),
        _mutated(rounds=-1),
        _mutated(rounds="1"),
        _mutated(rounds=True),
        _mutated(created="yesterday"),
        _mutated(created="2026-11-18T12:00:00"),  # naive
        _mutated(created=None),
        _mutated(decided="soon"),
        _mutated(decided=5),
    ],
)
def test_from_dict_rejects_bad_input(bad: Any) -> None:
    with pytest.raises(ChangeSetError):
        ChangeSet.from_dict(bad)


def test_from_dict_rejects_missing_keys() -> None:
    for key in ("id", "request", "status", "operations", "findings", "created"):
        data = full_changeset().to_dict()
        del data[key]
        with pytest.raises(ChangeSetError):
            ChangeSet.from_dict(data)


def test_finding_net_refs_default_to_empty_and_serialize_as_list() -> None:
    assert WARNING.net_refs == ()
    assert WARNING.to_dict()["net_refs"] == []
    assert REFERENCING.to_dict()["net_refs"] == ["p:light.a:on", "t:x:trigger:0"]


def test_finding_without_net_refs_key_still_loads() -> None:
    """Change sets stored before net_refs existed must stay readable."""
    data = full_changeset().to_dict()
    for finding in data["findings"]:
        del finding["net_refs"]
    loaded = ChangeSet.from_dict(data)
    assert [f.net_refs for f in loaded.findings] == [(), ()]


@pytest.mark.parametrize(
    "bad", ["p:a", None, ("p:a",), {"p:a": 1}, [""], [None], [5], ["p:a", ""]]
)
def test_finding_rejects_bad_net_refs(bad: Any) -> None:
    data = full_changeset().to_dict()
    data["findings"][0]["net_refs"] = bad
    with pytest.raises(ChangeSetError):
        ChangeSet.from_dict(data)
