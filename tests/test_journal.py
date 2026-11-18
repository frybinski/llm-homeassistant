"""Tests for the journal."""

from datetime import datetime
from typing import Any

from homeassistant.core import HomeAssistant

from custom_components.ai_drafts.journal import MAX_ENTRIES, STORAGE_KEY, Journal


def stored(hass_storage: dict[str, Any]) -> list[dict[str, Any]]:
    return hass_storage[STORAGE_KEY]["data"]["entries"]


async def test_log_appends_and_persists(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    journal = Journal(hass)
    await journal.async_load()
    assert journal.list() == []
    await journal.async_log("cs_1", "created", {"request": "x"})
    await journal.async_log("cs_2", "created")
    await journal.async_log("cs_1", "applied", {"decided_in": "domain"})

    entries = journal.list()
    assert [(e["change_set_id"], e["event"]) for e in entries] == [
        ("cs_1", "created"),
        ("cs_2", "created"),
        ("cs_1", "applied"),
    ]
    assert entries[1]["data"] == {}
    assert datetime.fromisoformat(entries[0]["ts"]).tzinfo is not None
    assert set(entries[0]) == {"ts", "change_set_id", "event", "data"}
    assert stored(hass_storage) == entries
    assert [e["event"] for e in journal.list("cs_1")] == ["created", "applied"]


async def test_entries_survive_a_reload(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    journal = Journal(hass)
    await journal.async_load()
    await journal.async_log("cs_1", "created")
    again = Journal(hass)
    await again.async_load()
    assert again.list() == journal.list()


async def test_list_returns_copies(hass: HomeAssistant) -> None:
    journal = Journal(hass)
    await journal.async_load()
    await journal.async_log("cs_1", "created")
    journal.list()[0]["event"] = "tampered"
    assert journal.list()[0]["event"] == "created"


async def test_the_journal_is_capped_and_drops_the_oldest(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    assert MAX_ENTRIES == 2000
    hass_storage[STORAGE_KEY] = {
        "version": 1,
        "minor_version": 1,
        "key": STORAGE_KEY,
        "data": {
            "entries": [
                {
                    "ts": "2026-01-01T00:00:00+00:00",
                    "change_set_id": "cs_old",
                    "event": f"e{n}",
                    "data": {},
                }
                for n in range(1999)
            ]
        },
    }
    journal = Journal(hass)
    await journal.async_load()
    assert len(journal.list()) == 1999
    await journal.async_log("cs_new", "created")
    assert len(journal.list()) == 2000
    await journal.async_log("cs_new", "check")
    await journal.async_log("cs_new", "applied")
    entries = journal.list()
    assert len(entries) == 2000
    assert entries[0]["event"] == "e2"  # e0 and e1 were dropped
    assert [e["event"] for e in entries[-3:]] == ["created", "check", "applied"]
    assert len(stored(hass_storage)) == 2000


async def test_malformed_storage_is_ignored(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    hass_storage[STORAGE_KEY] = {
        "version": 1,
        "minor_version": 1,
        "key": STORAGE_KEY,
        "data": {
            "entries": [
                "junk",
                {"ts": "t", "change_set_id": "c", "event": "e", "data": {}},
            ]
        },
    }
    journal = Journal(hass)
    await journal.async_load()
    assert len(journal.list()) == 1
