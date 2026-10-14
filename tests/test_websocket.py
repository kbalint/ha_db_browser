"""Authorization and privacy contract tests with a minimal HA adapter."""
import asyncio
import importlib
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import AsyncMock

root = Path(__file__).resolve().parents[1]
pkg = sys.modules.setdefault("explorer_test", types.ModuleType("explorer_test"))
pkg.__path__ = [str(root / "custom_components" / "ha_adatterkep")]


def mod(name, **values):
    module = types.ModuleType(name)
    module.__dict__.update(values)
    sys.modules[name] = module
    return module


mod("voluptuous", Required=lambda name: name, Optional=lambda name, **kw: name, In=lambda values: values)
mod("homeassistant")
mod("homeassistant.components")
mod("homeassistant.core", callback=lambda fn: fn)
mod("homeassistant.components.websocket_api", websocket_command=lambda schema: lambda fn: fn,
    async_response=lambda fn: fn)
mod("homeassistant.helpers")
mod("homeassistant.helpers.device_registry", async_get=lambda hass: hass.devices)
mod("homeassistant.helpers.entity_registry", async_get=lambda hass: hass.entities)
mod("homeassistant.components.recorder", get_instance=lambda hass: types.SimpleNamespace(migration_in_progress=False))
ws = importlib.import_module("explorer_test.websocket")
from explorer_test.scanner import AnalysisManager


class Connection:
    def __init__(self, admin):
        self.user = types.SimpleNamespace(is_admin=admin)
        self.result = None
        self.error = None

    def send_error(self, message_id, code, message):
        self.error = (code, message)

    def send_result(self, message_id, data):
        self.result = data


class Registry:
    def __init__(self, values):
        self.entities = values

    def async_get(self, key):
        return self.entities.get(key)


class WebsocketTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.execute = AsyncMock()
        self.manager = AnalysisManager(types.SimpleNamespace(), self.execute)
        self.hass = types.SimpleNamespace(data={"ha_adatterkep": {"manager": self.manager}})

    async def test_non_admin_cannot_query(self):
        c = Connection(False)
        await ws.websocket_query(self.hass, c, {"id": 1, "action": "entity", "params": {"id": "sensor.private"}})
        self.assertEqual(c.error[0], "unauthorized")
        self.execute.assert_not_called()

    async def test_unknown_or_deep_table_is_not_executed(self):
        c = Connection(True)
        await ws.websocket_query(self.hass, c, {"id": 1, "action": "table", "params": {"name": "states", "offset": 999999}})
        self.assertEqual(c.error[0], "read_failed")
        self.execute.assert_not_called()

    async def test_unchanged_snapshot_not_retransmitted(self):
        self.manager.snapshot = {"generated": "test-generation", "private": "data"}
        c = Connection(True)
        await ws.websocket_query(self.hass, c, {"id": 1, "action": "overview", "params": {"generation": "test-generation"}})
        self.assertTrue(c.result["unchanged"])
        self.assertIsNone(c.result["analysis"])

    def test_registry_provenance_does_not_leak_credentials(self):
        entity = types.SimpleNamespace(entity_id="sensor.test", platform="mqtt", config_entry_id="entry", device_id="device")
        sibling = types.SimpleNamespace(entity_id="sensor.test_voltage", device_id="device")
        device = types.SimpleNamespace(name_by_user=None, name="Plug", manufacturer="Test", model="V1", identifiers={("mqtt", "private-mac")})
        entry = types.SimpleNamespace(domain="mqtt", title="Mosquitto", data={"password": "SECRET", "topic": "private/topic"})
        self.hass.entities = Registry({"sensor.test": entity, "sensor.test_voltage": sibling})
        self.hass.devices = Registry({"device": device})
        self.hass.config_entries = types.SimpleNamespace(async_get_entry=lambda key: entry)
        result = ws.provenance(self.hass, "sensor.test")
        self.assertEqual(result["platform"], "mqtt")
        self.assertEqual(result["siblings"], ["sensor.test_voltage"])
        self.assertNotIn("SECRET", str(result))
        self.assertNotIn("private/topic", str(result))
        self.assertNotIn("private-mac", str(result))


if __name__ == "__main__":
    unittest.main()
