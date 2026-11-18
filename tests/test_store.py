"""Tests for the change set store."""

from datetime import timedelta
import logging
from typing import Any

from homeassistant.core import HomeAssistant
import pytest

from custom_components.blaupause.changeset import (
    STORAGE_KEY,
    ChangeSet,
    ChangeSetError,
    ChangeSetStatus,
    ChangeSetStore,
    Finding,
    Operation,
    OperationKind,
    OperationType,
    Severity,
)


def make_changeset(request: str = "req") -> ChangeSet:
    return ChangeSet.new(
        request,
        [Operation(OperationKind.AUTOMATION, OperationType.CREATE, after={"a": 1})],
        "ai_task.test",
    )


async def test_empty_store(hass: HomeAssistant, hass_storage: dict[str, Any]) -> None:
    store = ChangeSetStore(hass)
    await store.async_load()
    assert store.list() == []
    assert store.get("cs_missing") is None


async def test_persists_across_reload(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    store = ChangeSetStore(hass)
    await store.async_load()
    first = make_changeset("first")
    second = make_changeset("second")
    second.created = first.created + timedelta(seconds=5)  # unambiguous order
    await store.async_add(first)
    await store.async_add(second)

    first.complete_check([Finding(Severity.WARNING, "c", "m")])
    await store.async_update(first)

    assert hass_storage[STORAGE_KEY]["version"] == 1

    reloaded = ChangeSetStore(hass)
    await reloaded.async_load()
    assert [cs.request for cs in reloaded.list()] == ["second", "first"]
    assert reloaded.get(first.id) == first
    assert reloaded.get(first.id).status is ChangeSetStatus.CHECKED  # type: ignore[union-attr]
    assert reloaded.get(second.id) == second


async def test_add_duplicate_and_update_unknown(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    store = ChangeSetStore(hass)
    await store.async_load()
    cs = make_changeset()
    with pytest.raises(ChangeSetError):
        await store.async_update(cs)
    await store.async_add(cs)
    with pytest.raises(ChangeSetError):
        await store.async_add(cs)


async def test_corrupt_entry_is_skipped_with_warning(
    hass: HomeAssistant,
    hass_storage: dict[str, Any],
    caplog: pytest.LogCaptureFixture,
) -> None:
    good = make_changeset("good")
    hass_storage[STORAGE_KEY] = {
        "version": 1,
        "minor_version": 1,
        "key": STORAGE_KEY,
        "data": {
            "changesets": [
                {"id": "cs_broken", "status": "nonsense"},
                good.to_dict(),
                "not even an object",
            ]
        },
    }
    store = ChangeSetStore(hass)
    with caplog.at_level(logging.WARNING):
        await store.async_load()
    assert [cs.request for cs in store.list()] == ["good"]
    assert caplog.text.count("Skipping stored change set") == 2
