"""Append-only protocol of everything that happens to a change set."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, Final

from homeassistant.helpers.storage import Store

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

STORAGE_KEY: Final = "ai_drafts.journal"
STORAGE_VERSION: Final = 1
MAX_ENTRIES: Final = 2000

EVENT_CREATED: Final = "created"
EVENT_DRAFT_ROUND: Final = "draft_round"
EVENT_CHECK: Final = "check"
EVENT_FAILED: Final = "failed"
EVENT_MODEL_ERROR: Final = "model_error"
EVENT_APPLIED: Final = "applied"
EVENT_DISCARDED: Final = "discarded"
EVENT_REVERTED: Final = "reverted"


class Journal:
    """Entries ``{ts, change_set_id, event, data}`` in ``.storage/ai_drafts.journal``.

    The newest ``MAX_ENTRIES`` are kept; older ones are dropped.
    """

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize an empty journal; call ``async_load`` before use."""
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._entries: list[dict[str, Any]] = []

    async def async_load(self) -> None:
        """Load the stored entries."""
        data = await self._store.async_load()
        entries = data.get("entries") if isinstance(data, dict) else None
        self._entries = [e for e in entries or [] if isinstance(e, dict)]

    async def async_log(
        self,
        change_set_id: str,
        event: str,
        data: dict[str, Any] | None = None,
    ) -> None:
        """Append an entry and persist."""
        self._entries.append(
            {
                "ts": datetime.now(UTC).isoformat(),
                "change_set_id": change_set_id,
                "event": event,
                "data": data or {},
            }
        )
        if len(self._entries) > MAX_ENTRIES:
            del self._entries[: len(self._entries) - MAX_ENTRIES]
        await self._store.async_save({"entries": self._entries})

    def list(self, change_set_id: str | None = None) -> list[dict[str, Any]]:
        """Return the entries, oldest first, optionally of one change set."""
        return [
            dict(e)
            for e in self._entries
            if change_set_id is None or e.get("change_set_id") == change_set_id
        ]
