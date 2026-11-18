"""Change set model, state machine and persistent store.

A change set is a proposal produced by the model. It is checked
deterministically and only written after a human approved it. The model and the
state machine are plain Python and know nothing about Home Assistant; only
``ChangeSetStore`` touches ``hass``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
import logging
from typing import TYPE_CHECKING, Any, Final, Self

from homeassistant.helpers.storage import Store
from homeassistant.util.ulid import ulid

if TYPE_CHECKING:
    from collections.abc import Iterable, Mapping

    from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

MAX_REPAIR_ROUNDS: Final = 3
STORAGE_KEY: Final = "blaupause.changesets"
STORAGE_VERSION: Final = 1
ID_PREFIX: Final = "cs_"
PIPELINE_CHECK: Final = "pipeline"


class ChangeSetError(Exception):
    """Base class for all change set errors."""


class InvalidTransitionError(ChangeSetError):
    """The requested action is not allowed in the current status."""


class RepairLimitError(ChangeSetError):
    """The change set already used up its repair rounds."""


class ApplyBlockedError(ChangeSetError):
    """The change set carries error findings and must not be applied."""


class ChangeSetStatus(StrEnum):
    """Lifecycle status of a change set."""

    DRAFT = "draft"
    CHECKED = "checked"
    FAILED = "failed"
    APPLIED = "applied"
    REVERTED = "reverted"
    DISCARDED = "discarded"


class OperationKind(StrEnum):
    """What kind of Home Assistant object an operation touches."""

    AUTOMATION = "automation"
    SCRIPT = "script"
    HELPER = "helper"
    DASHBOARD_VIEW = "dashboard_view"
    DASHBOARD_CARD = "dashboard_card"


class OperationType(StrEnum):
    """What an operation does with its target."""

    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


class Severity(StrEnum):
    """Severity of a finding. Only ``error`` blocks applying."""

    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


# The single source of truth for the state machine; the methods consult it.
ALLOWED_TRANSITIONS: Final[Mapping[ChangeSetStatus, frozenset[ChangeSetStatus]]] = {
    ChangeSetStatus.DRAFT: frozenset(
        {
            ChangeSetStatus.CHECKED,
            ChangeSetStatus.FAILED,
            ChangeSetStatus.DISCARDED,
        }
    ),
    ChangeSetStatus.CHECKED: frozenset(
        {ChangeSetStatus.APPLIED, ChangeSetStatus.DISCARDED}
    ),
    ChangeSetStatus.FAILED: frozenset({ChangeSetStatus.DISCARDED}),
    ChangeSetStatus.APPLIED: frozenset({ChangeSetStatus.REVERTED}),
    ChangeSetStatus.REVERTED: frozenset(),
    ChangeSetStatus.DISCARDED: frozenset(),
}


def _require_mapping(value: Any, what: str) -> Mapping[str, Any]:
    if not isinstance(value, dict):
        raise ChangeSetError(f"{what} must be an object")
    return value


def _require_str(value: Any, what: str) -> str:
    if not isinstance(value, str) or not value:
        raise ChangeSetError(f"{what} must be a non-empty string")
    return value


def _optional_str(value: Any, what: str) -> str | None:
    if value is None:
        return None
    return _require_str(value, what)


def _enum[E: StrEnum](enum_cls: type[E], value: Any, what: str) -> E:
    try:
        return enum_cls(value)
    except ValueError:
        raise ChangeSetError(f"{what} has invalid value {value!r}") from None


def _parse_datetime(value: Any, what: str) -> datetime:
    if not isinstance(value, str):
        raise ChangeSetError(f"{what} must be an ISO 8601 string")
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        raise ChangeSetError(f"{what} is not a valid ISO 8601 datetime") from None
    if parsed.tzinfo is None:
        raise ChangeSetError(f"{what} must carry a timezone")
    return parsed.astimezone(UTC)


@dataclass(frozen=True, slots=True)
class Finding:
    """One result of a deterministic check."""

    severity: Severity
    check: str
    message: str
    path: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Return the JSON representation."""
        return {
            "severity": self.severity.value,
            "check": self.check,
            "message": self.message,
            "path": self.path,
        }

    @classmethod
    def from_dict(cls, data: Any) -> Self:
        """Parse and validate the JSON representation."""
        data = _require_mapping(data, "finding")
        return cls(
            severity=_enum(Severity, data.get("severity"), "finding.severity"),
            check=_require_str(data.get("check"), "finding.check"),
            message=_require_str(data.get("message"), "finding.message"),
            path=_optional_str(data.get("path"), "finding.path"),
        )


@dataclass(frozen=True, slots=True)
class Operation:
    """A single create, update or delete of one Home Assistant object."""

    kind: OperationKind
    op: OperationType
    target_id: str | None = None
    before: dict[str, Any] | None = None
    after: dict[str, Any] | None = None

    def __post_init__(self) -> None:
        """Enforce the invariants of each operation type."""
        for name, value in (("before", self.before), ("after", self.after)):
            if value is not None and not isinstance(value, dict):
                raise ChangeSetError(f"operation.{name} must be an object or null")
        if self.target_id is not None and not self.target_id:
            raise ChangeSetError("operation.target_id must not be empty")

        match self.op:
            case OperationType.CREATE:
                if self.after is None:
                    raise ChangeSetError("a create operation needs 'after'")
                if self.before is not None:
                    raise ChangeSetError("a create operation must not have 'before'")
            case OperationType.UPDATE:
                if self.target_id is None:
                    raise ChangeSetError("an update operation needs 'target_id'")
                if self.after is None:
                    raise ChangeSetError("an update operation needs 'after'")
            case OperationType.DELETE:
                if self.target_id is None:
                    raise ChangeSetError("a delete operation needs 'target_id'")
                if self.after is not None:
                    raise ChangeSetError("a delete operation must not have 'after'")

    def to_dict(self) -> dict[str, Any]:
        """Return the JSON representation."""
        return {
            "kind": self.kind.value,
            "op": self.op.value,
            "target_id": self.target_id,
            "before": self.before,
            "after": self.after,
        }

    @classmethod
    def from_dict(cls, data: Any) -> Self:
        """Parse and validate the JSON representation."""
        data = _require_mapping(data, "operation")
        return cls(
            kind=_enum(OperationKind, data.get("kind"), "operation.kind"),
            op=_enum(OperationType, data.get("op"), "operation.op"),
            target_id=_optional_str(data.get("target_id"), "operation.target_id"),
            before=data.get("before"),
            after=data.get("after"),
        )


@dataclass(slots=True)
class ChangeSet:
    """A proposal with its checks and decision, driven by a state machine."""

    id: str
    request: str
    status: ChangeSetStatus
    operations: list[Operation]
    model: str | None
    created: datetime
    findings: list[Finding] = field(default_factory=list)
    rounds: int = 0
    decided: datetime | None = None

    @classmethod
    def new(
        cls,
        request: str,
        operations: Iterable[Operation],
        model: str | None = None,
    ) -> Self:
        """Create a fresh draft."""
        return cls(
            id=f"{ID_PREFIX}{ulid()}",
            request=request,
            status=ChangeSetStatus.DRAFT,
            operations=list(operations),
            model=model,
            created=datetime.now(UTC),
        )

    @property
    def has_errors(self) -> bool:
        """Return True if any finding has severity error."""
        return any(f.severity is Severity.ERROR for f in self.findings)

    def _transition(self, target: ChangeSetStatus, action: str) -> None:
        if target not in ALLOWED_TRANSITIONS[self.status]:
            raise InvalidTransitionError(
                f"cannot {action} a change set in status '{self.status}'"
            )
        self.status = target

    def _require_status(self, expected: ChangeSetStatus, action: str) -> None:
        if self.status is not expected:
            raise InvalidTransitionError(
                f"cannot {action} a change set in status '{self.status}'"
            )

    def complete_check(self, findings: Iterable[Finding]) -> None:
        """Record check results; no error finding means ``checked``."""
        self._require_status(ChangeSetStatus.DRAFT, "complete the check of")
        self.findings = list(findings)
        if not self.has_errors:
            self._transition(ChangeSetStatus.CHECKED, "check")

    def revise(self, operations: Iterable[Operation]) -> None:
        """Replace the operations for one repair round."""
        self._require_status(ChangeSetStatus.DRAFT, "revise")
        if self.rounds >= MAX_REPAIR_ROUNDS:
            raise RepairLimitError(
                f"repair limit of {MAX_REPAIR_ROUNDS} rounds reached"
            )
        self.operations = list(operations)
        self.findings = []
        self.rounds += 1

    def fail(self, reason: str | None = None) -> None:
        """Give up on a draft, optionally recording why."""
        self._transition(ChangeSetStatus.FAILED, "fail")
        if reason:
            self.findings.append(Finding(Severity.ERROR, PIPELINE_CHECK, reason))

    def apply(self) -> None:
        """Mark a checked change set as applied."""
        if self.status is ChangeSetStatus.CHECKED and self.has_errors:
            raise ApplyBlockedError("change set has error findings")
        self._transition(ChangeSetStatus.APPLIED, "apply")
        self.decided = datetime.now(UTC)

    def discard(self) -> None:
        """Throw the change set away without applying it."""
        self._transition(ChangeSetStatus.DISCARDED, "discard")
        self.decided = datetime.now(UTC)

    def revert(self) -> None:
        """Mark an applied change set as reverted."""
        self._transition(ChangeSetStatus.REVERTED, "revert")

    def to_dict(self) -> dict[str, Any]:
        """Return the JSON representation (the contract of PLAN.md section 3)."""
        return {
            "id": self.id,
            "request": self.request,
            "status": self.status.value,
            "operations": [op.to_dict() for op in self.operations],
            "findings": [f.to_dict() for f in self.findings],
            "model": self.model,
            "rounds": self.rounds,
            "created": self.created.isoformat(),
            "decided": self.decided.isoformat() if self.decided else None,
        }

    @classmethod
    def from_dict(cls, data: Any) -> Self:
        """Parse and validate the JSON representation."""
        data = _require_mapping(data, "change set")
        change_set_id = _require_str(data.get("id"), "id")
        if not change_set_id.startswith(ID_PREFIX):
            raise ChangeSetError(f"id must start with '{ID_PREFIX}'")
        rounds = data.get("rounds")
        if not isinstance(rounds, int) or isinstance(rounds, bool) or rounds < 0:
            raise ChangeSetError("rounds must be a non-negative integer")
        operations = data.get("operations")
        findings = data.get("findings")
        if not isinstance(operations, list):
            raise ChangeSetError("operations must be a list")
        if not isinstance(findings, list):
            raise ChangeSetError("findings must be a list")
        decided = data.get("decided")
        return cls(
            id=change_set_id,
            request=_require_str(data.get("request"), "request"),
            status=_enum(ChangeSetStatus, data.get("status"), "status"),
            operations=[Operation.from_dict(op) for op in operations],
            findings=[Finding.from_dict(f) for f in findings],
            model=_optional_str(data.get("model"), "model"),
            rounds=rounds,
            created=_parse_datetime(data.get("created"), "created"),
            decided=None if decided is None else _parse_datetime(decided, "decided"),
        )


class ChangeSetStore:
    """Persist change sets in ``.storage/blaupause.changesets``."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize an empty store; call ``async_load`` before use."""
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._items: dict[str, ChangeSet] = {}

    async def async_load(self) -> None:
        """Load change sets, skipping entries that cannot be parsed."""
        data = await self._store.async_load()
        self._items = {}
        raw_items = data.get("changesets", []) if isinstance(data, dict) else []
        if not isinstance(raw_items, list):
            _LOGGER.warning("Ignoring malformed change set storage")
            return
        for raw in raw_items:
            try:
                item = ChangeSet.from_dict(raw)
            except ChangeSetError as err:
                _LOGGER.warning(
                    "Skipping stored change set that failed to parse: %s", err
                )
                continue
            self._items[item.id] = item

    async def async_add(self, change_set: ChangeSet) -> None:
        """Add a new change set and persist."""
        if change_set.id in self._items:
            raise ChangeSetError(f"change set {change_set.id} already exists")
        self._items[change_set.id] = change_set
        await self._async_save()

    async def async_update(self, change_set: ChangeSet) -> None:
        """Persist the new state of a change set that is already stored."""
        if change_set.id not in self._items:
            raise ChangeSetError(f"change set {change_set.id} is unknown")
        self._items[change_set.id] = change_set
        await self._async_save()

    def get(self, change_set_id: str) -> ChangeSet | None:
        """Return a change set by id."""
        return self._items.get(change_set_id)

    def list(self) -> list[ChangeSet]:
        """Return all change sets, newest first."""
        return sorted(self._items.values(), key=lambda cs: cs.created, reverse=True)

    async def _async_save(self) -> None:
        await self._store.async_save(
            {"changesets": [cs.to_dict() for cs in self._items.values()]}
        )
