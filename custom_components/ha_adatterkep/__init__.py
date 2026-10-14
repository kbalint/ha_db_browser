"""Admin-only live recorder database explorer."""
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.components.recorder import get_instance
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady

from .const import DOMAIN, PANEL_PATH, VERSION
from .database import ReaderError
from .runtime import reader_for_hass
from .scanner import AnalysisManager
from .websocket import async_register_commands


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    try:
        reader = reader_for_hass(hass)
        await hass.async_add_executor_job(reader.validate)
    except ReaderError as err:
        raise ConfigEntryNotReady(str(err)) from err

    state = hass.data.setdefault(DOMAIN, {})
    def guard():
        if get_instance(hass).migration_in_progress:
            raise ReaderError("A recorder migrál; az olvasás átmenetileg szünetel.")

    manager = AnalysisManager(reader, hass.async_add_executor_job, guard)
    state["manager"] = manager
    if not state.get("registered"):
        await hass.http.async_register_static_paths([
            StaticPathConfig("/ha_adatterkep_static", str(Path(__file__).parent / "frontend"), True)
        ])
        async_register_commands(hass)
        state["registered"] = True
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_PATH,
        webcomponent_name="ha-adatterkep-panel",
        sidebar_title="HA Adattérkép",
        sidebar_icon="mdi:database-search",
        module_url=f"/ha_adatterkep_static/panel.js?v={VERSION}",
        require_admin=True,
        config_panel_domain=DOMAIN,
    )
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    state = hass.data.get(DOMAIN, {})
    if manager := state.pop("manager", None):
        await manager.close()
    frontend.async_remove_panel(hass, PANEL_PATH)
    return True
