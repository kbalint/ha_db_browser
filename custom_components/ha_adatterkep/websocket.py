"""Authenticated HA WebSocket API. No arbitrary SQL or client-supplied paths."""
from __future__ import annotations

import asyncio
import logging
import time

try:
    import probatio as vol
except ImportError:
    import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import callback
from homeassistant.helpers import device_registry as dr, entity_registry as er

from .const import DOMAIN, SCAN_COOLDOWN
from .database import ReaderError

_LOGGER = logging.getLogger(__name__)


def provenance(hass, entity_id):
    """Only registry attribution; never return config-entry data or credentials."""
    entity = er.async_get(hass).async_get(entity_id)
    if not entity:
        return {"registered": False, "note": "Nincs entity registry bejegyzés (például YAML entity vagy régi statisztika)."}
    entry = hass.config_entries.async_get_entry(entity.config_entry_id) if entity.config_entry_id else None
    device = dr.async_get(hass).async_get(entity.device_id) if entity.device_id else None
    siblings = [e.entity_id for e in er.async_get(hass).entities.values()
                if entity.device_id and e.device_id == entity.device_id and e.entity_id != entity_id][:50]
    return {"registered": True, "platform": entity.platform,
            "configEntry": {"domain": entry.domain, "title": entry.title} if entry else None,
            "device": {"name": device.name_by_user or device.name,
                       "manufacturer": device.manufacturer, "model": device.model} if device else None,
            "siblings": siblings,
            "note": "Entity/device registry alapján. MQTT topic, jelszó és template-képlet nincs kiolvasva."}


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/query",
    vol.Required("action"): vol.In(["overview", "status", "live", "refresh", "cancel", "entity", "context", "table"]),
    vol.Optional("params", default={}): dict,
})
@websocket_api.async_response
async def websocket_query(hass, connection, msg):
    if not connection.user or not connection.user.is_admin:
        connection.send_error(msg["id"], "unauthorized", "Csak Home Assistant admin használhatja.")
        return
    manager = hass.data.get(DOMAIN, {}).get("manager")
    if not manager:
        connection.send_error(msg["id"], "not_loaded", "Az integráció nincs betöltve.")
        return
    action, params = msg["action"], msg.get("params", {})
    try:
        if action == "overview":
            unchanged = manager.snapshot and params.get("generation") == manager.snapshot["generated"]
            result = {"analysis": None if unchanged else manager.snapshot, "unchanged": bool(unchanged), "status": dict(manager.state)}
        elif action == "status":
            result = dict(manager.state)
        elif action == "refresh":
            if manager.task and not manager.task.done():
                result = dict(manager.state)
            elif manager.last_start and time.monotonic() - manager.last_start < SCAN_COOLDOWN:
                raise ReaderError("Teljes elemzés legfeljebb ötpercenként indítható. Az entityadatok közben élőben olvashatók.")
            else:
                # Set running synchronously: repeated refresh messages cannot spawn duplicate jobs.
                manager.state.update({"running": True, "phase": "queued", "error": None})
                manager.task = hass.async_create_background_task(manager.run(), f"{DOMAIN} analysis")
                result = dict(manager.state)
        elif action == "cancel":
            await manager.close()
            result = dict(manager.state)
        else:
            # No reads during recorder migration or HA database-lock maintenance.
            from homeassistant.components.recorder import get_instance
            recorder = get_instance(hass)
            if recorder.migration_in_progress:
                raise ReaderError("A recorder migrál; az olvasás átmenetileg szünetel.")
            if action == "live":
                result = await asyncio.wait_for(manager.execute(manager.reader.live), 8)
            elif action == "entity":
                value = params.get("id")
                if not isinstance(value, str) or len(value) > 255:
                    raise ReaderError("Hibás entityazonosító")
                result = await asyncio.wait_for(manager.execute(manager.reader.entity, value, manager.snapshot), 8)
                result["provenance"] = provenance(hass, value)
            elif action == "context":
                value = params.get("id")
                if not isinstance(value, str):
                    raise ReaderError("Hibás kontextusazonosító")
                result = await asyncio.wait_for(manager.execute(manager.reader.context, value), 8)
            elif action == "table":
                value, offset = params.get("name"), params.get("offset", 0)
                if not isinstance(value, str) or not isinstance(offset, int) or offset < 0 or offset > 10000:
                    raise ReaderError("A technikai nézet csak az első 10 050 sort lapozza; használd az entitykeresőt.")
                result = await asyncio.wait_for(manager.execute(manager.reader.table, value, offset, manager.snapshot), 8)
        connection.send_result(msg["id"], result)
    except (ReaderError, TimeoutError) as err:
        connection.send_error(msg["id"], "read_failed", str(err) or "Az adatbázis most foglalt. Próbáld később.")
    except Exception:
        _LOGGER.exception("Adattérkép query failed: %s", action)
        connection.send_error(msg["id"], "read_failed", "Olvasási hiba; részletek a HA naplójában.")


@callback
def async_register_commands(hass):
    websocket_api.async_register_command(hass, websocket_query)
