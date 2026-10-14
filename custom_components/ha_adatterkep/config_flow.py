"""Single-instance, UI-configured recorder explorer."""
try:
    import probatio as vol
except ImportError:
    import voluptuous as vol

from homeassistant import config_entries

from .const import DOMAIN
from .database import ReaderError
from .runtime import reader_for_hass


class AdatterkepConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        errors = {}
        if user_input is not None:
            try:
                reader = reader_for_hass(self.hass)
                await self.hass.async_add_executor_job(reader.validate)
            except ReaderError as err:
                return self.async_show_form(step_id="user", data_schema=vol.Schema({}),
                                            errors={"base": "cannot_connect"},
                                            description_placeholders={"error": str(err)})
            return self.async_create_entry(title="HA Adattérkép", data={})
        return self.async_show_form(step_id="user", data_schema=vol.Schema({}), errors=errors,
                                    description_placeholders={"error": ""})
