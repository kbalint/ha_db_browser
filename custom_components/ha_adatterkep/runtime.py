"""Resolve the configured recorder database, without accepting client paths."""
from pathlib import Path

from homeassistant.components.recorder import get_instance
from sqlalchemy.engine import make_url

from .database import ReaderError, SQLiteReader


def reader_for_hass(hass):
    recorder = get_instance(hass)
    if recorder.migration_in_progress:
        raise ReaderError("migrating")
    url = make_url(recorder.db_url)
    if url.get_backend_name() != "sqlite" or not url.database or url.database == ":memory:":
        raise ReaderError("sqlite_only")
    if url.query:
        raise ReaderError("uri_unsupported")
    path = Path(url.database)
    if not path.is_absolute():
        raise ReaderError("absolute_path")
    return SQLiteReader(path)
