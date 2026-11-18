"""Runtime data of a loaded config entry."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from homeassistant.config_entries import ConfigEntry

    from .apply import SnapshotStore
    from .changeset import ChangeSetStore
    from .journal import Journal


@dataclass(slots=True)
class AIDraftsData:
    """Stores, journal and locks of one loaded entry (``entry.runtime_data``)."""

    entry: ConfigEntry
    changesets: ChangeSetStore
    journal: Journal
    snapshots: SnapshotStore
    # Held while a draft runs; a second request meanwhile is refused as busy.
    draft_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    # Serialises every read-modify-write of automations.yaml (apply and revert).
    write_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
