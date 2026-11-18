"""Shared fixtures."""

from pathlib import Path

from homeassistant.core import HomeAssistant
import pytest


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations: None) -> None:
    """Let Home Assistant load custom_components/ai_drafts in every test."""


@pytest.fixture
def config_dir(hass: HomeAssistant, tmp_path: Path) -> Path:
    """A real configuration directory that includes automations.yaml."""
    (tmp_path / "configuration.yaml").write_text(
        "automation: !include automations.yaml\n", encoding="utf-8"
    )
    hass.config.config_dir = str(tmp_path)
    return tmp_path
