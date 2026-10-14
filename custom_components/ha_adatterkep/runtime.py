"""Resolve the configured recorder database, without accepting client paths."""
from pathlib import Path

from homeassistant.components.recorder import get_instance
from sqlalchemy.engine import make_url

from .database import ReaderError, SQLiteReader


def reader_for_hass(hass):
    recorder = get_instance(hass)
    if recorder.migration_in_progress:
        raise ReaderError("A recorder adatbázis migrációja még folyamatban van.")
    url = make_url(recorder.db_url)
    if url.get_backend_name() != "sqlite" or not url.database or url.database == ":memory:":
        raise ReaderError("Ez az integráció csak helyi, fájl alapú recorder SQLite adatbázist támogat.")
    if url.query:
        raise ReaderError("Egyedi SQLite URI-paraméterezés nem támogatott.")
    path = Path(url.database)
    if not path.is_absolute():
        raise ReaderError("A recorder SQLite útvonalának abszolútnak kell lennie.")
    return SQLiteReader(path)
