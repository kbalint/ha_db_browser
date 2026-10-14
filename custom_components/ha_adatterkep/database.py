"""Bounded, read-only SQLite queries. No Home Assistant dependency.

Each operation owns a short-lived connection; never use immutable=1 on a live WAL
database. No journal-mode changes, checkpoint, VACUUM, or recorder write session.
"""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
import time
from typing import Any
from .i18n import translate

CHUNK_SIZE = 5000
QUERY_SECONDS = 3.0
ALLOWED_TABLES = frozenset({
    "event_data", "event_types", "state_attributes", "states_meta",
    "statistics_meta", "recorder_runs", "schema_changes", "statistics_runs",
    "events", "states", "statistics", "statistics_short_term", "sqlite_stat1",
    "migration_changes",
})


class ReaderError(Exception):
    """A safe, user-presentable read failure."""
    def __init__(self, code):
        self.code = code
        super().__init__(translate(code))


def stamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean(value: Any) -> Any:
    if isinstance(value, bytes):
        return value.hex()
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()}
    if isinstance(value, list):
        return [clean(v) for v in value]
    return value


def parse(value: str | None) -> dict:
    try:
        return json.loads(value or "{}")
    except (ValueError, TypeError):
        return {"raw": value}


class SQLiteReader:
    """Read committed WAL data with short snapshots and hard query budgets."""

    def __init__(self, path: str | Path, query_seconds: float = QUERY_SECONDS):
        self.path = Path(path).absolute()
        self.query_seconds = query_seconds

    @contextmanager
    def connect(self):
        db = None
        try:
            db = sqlite3.connect(self.path.as_uri() + "?mode=ro", uri=True, timeout=0.25)
            db.row_factory = sqlite3.Row
            db.execute("PRAGMA query_only=ON")
            deadline = time.monotonic() + self.query_seconds
            db.set_progress_handler(lambda: int(time.monotonic() > deadline), 1000)
            yield db
        except sqlite3.OperationalError as err:
            text = str(err).lower()
            if "locked" in text or "busy" in text:
                raise ReaderError("db_busy") from err
            if "interrupted" in text:
                raise ReaderError("query_timeout") from err
            raise ReaderError("sqlite_failed") from err
        finally:
            if db is not None:
                db.close()

    @staticmethod
    def rows(db, sql, params=()):
        return clean([dict(r) for r in db.execute(sql, params)])

    def validate(self):
        with self.connect() as db:
            tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if not {"states", "states_meta", "state_attributes", "statistics_meta"} <= tables:
                raise ReaderError("schema_missing")
            columns = {r[1] for r in db.execute("PRAGMA table_info(states)")}
            if not {"metadata_id", "last_updated_ts", "context_id_bin"} <= columns:
                raise ReaderError("schema_states")
            mode = db.execute("PRAGMA journal_mode").fetchone()[0]
            if mode != "wal":
                raise ReaderError("wal_required")
            return {"journalMode": mode}

    def live(self):
        with self.connect() as db:
            last = self.rows(db, "SELECT state_id,last_updated_ts FROM states ORDER BY state_id DESC LIMIT 1")
            return {"checked": stamp(), "fileBytes": self.path.stat().st_size,
                    "walBytes": self._size(Path(str(self.path) + "-wal")),
                    "pageSize": db.execute("PRAGMA page_size").fetchone()[0],
                    "pageCount": db.execute("PRAGMA page_count").fetchone()[0],
                    "freePages": db.execute("PRAGMA freelist_count").fetchone()[0],
                    "latest": last[0] if last else None}

    @staticmethod
    def _size(path):
        try:
            return path.stat().st_size
        except FileNotFoundError:
            return 0

    def skeleton(self):
        with self.connect() as db:
            schema = self.rows(db, "SELECT name,type,tbl_name,sql FROM sqlite_master")
            tables = []
            for t in schema:
                name = t["name"]
                if t["type"] != "table" or name not in ALLOWED_TABLES:
                    continue
                tables.append({**t, "rows": 0, "storage": None,
                               "columns": self.rows(db, f'PRAGMA table_info("{name}")'),
                               "foreignKeys": self.rows(db, f'PRAGMA foreign_key_list("{name}")'),
                               "indexes": [i for i in schema if i["type"] == "index" and i["tbl_name"] == name]})
            meta = self.rows(db, "SELECT * FROM states_meta")
            stats = self.rows(db, "SELECT * FROM statistics_meta")
            version = self.rows(db, "SELECT * FROM schema_changes ORDER BY change_id DESC LIMIT 1")
            watermarks = {}
            for table, pk in (("states", "state_id"), ("events", "event_id"), ("statistics", "id"), ("statistics_short_term", "id")):
                row = db.execute(f'SELECT max("{pk}") FROM "{table}"').fetchone()
                watermarks[table] = row[0] or 0
        return {"generated": stamp(), "schemaVersion": version[0] if version else {},
                "tables": tables, "objects": [], "entities": [{**m, "rows": 0, "first": None, "last": None, "stateBytes": 0} for m in meta],
                "stats": stats, "days": [], "events": [], "watermarks": watermarks,
                "consistency": "rolling", "storageAvailable": True}

    def object_size(self, name):
        # Name is a bound parameter, including schema-supplied index names.
        with self.connect() as db:
            try:
                row = self.rows(db, "SELECT name,sum(pgsize) bytes,sum(payload) payload,sum(unused) unused,count(*) pages FROM dbstat WHERE name=? GROUP BY name", (name,))
                return row[0] if row else {"name": name, "bytes": 0, "payload": 0, "unused": 0, "pages": 0}
            except ReaderError:
                raise

    def small_count(self, name):
        if name not in ALLOWED_TABLES:
            raise ReaderError("unknown_table")
        with self.connect() as db:
            return db.execute(f'SELECT count(*) FROM "{name}"').fetchone()[0]

    def chunk(self, table, after, until):
        """Each chunk releases its WAL snapshot before the next chunk starts."""
        choices = {"states": ("state_id", "last_updated_ts", "metadata_id"),
                   "events": ("event_id", "time_fired_ts", "event_type_id"),
                   "statistics": ("id", "start_ts", "metadata_id"),
                   "statistics_short_term": ("id", "start_ts", "metadata_id")}
        if table not in choices:
            raise ReaderError("unsupported_table")
        pk, ts, key = choices[table]
        extra = ",sum(length(cast(state AS blob))) stateBytes" if table == "states" else ""
        day = f",strftime('%Y-%m-%d',{ts},'unixepoch') day" if table == "states" else ""
        group = f"{key},day" if table == "states" else key
        with self.connect() as db:
            result = self.rows(db, f'''SELECT {key},count(*) rows,min({ts}) first,max({ts}) last,max({pk}) cursor{extra}{day}
                FROM (SELECT * FROM "{table}" WHERE {pk}>? AND {pk}<=? ORDER BY {pk} LIMIT ?)
                GROUP BY {group}''', (after, until, CHUNK_SIZE))
        return result

    def event_types(self):
        with self.connect() as db:
            return self.rows(db, "SELECT * FROM event_types")

    def entity(self, entity_id, snapshot=None):
        with self.connect() as db:
            metas = self.rows(db, "SELECT * FROM states_meta WHERE entity_id=?", (entity_id,))
            stats = self.rows(db, "SELECT * FROM statistics_meta WHERE statistic_id=?", (entity_id,))
            if not metas and not stats:
                raise ReaderError("unknown_entity")
            meta, statistic = (metas[0] if metas else None), (stats[0] if stats else None)
            if snapshot:
                meta = next((m for m in snapshot["entities"] if m["entity_id"] == entity_id), meta)
                statistic = next((s for s in snapshot["stats"] if s["statistic_id"] == entity_id), statistic)
            history = []
            if meta:
                columns = {r[1] for r in db.execute("PRAGMA table_info(states)")}
                reported = "s.last_reported_ts" if "last_reported_ts" in columns else "NULL last_reported_ts"
                history = self.rows(db, f'''SELECT s.state_id,s.state,s.last_updated_ts,
                    coalesce(s.last_changed_ts,s.last_updated_ts) last_changed_ts,{reported},s.old_state_id,s.attributes_id,
                    hex(s.context_id_bin) context,hex(s.context_parent_id_bin) parentContext,
                    a.shared_attrs,p.state previous_state,p.attributes_id previous_attributes_id
                    FROM states s LEFT JOIN state_attributes a USING(attributes_id)
                    LEFT JOIN states p ON p.state_id=s.old_state_id
                    WHERE s.metadata_id=? ORDER BY s.last_updated_ts DESC LIMIT 200''', (meta["metadata_id"],))
                for r in history:
                    r["attributes"] = parse(r.pop("shared_attrs"))
            series = {}
            if statistic:
                for table, out in (("statistics", "statHistory"), ("statistics_short_term", "shortHistory")):
                    series[out] = self.rows(db, f'SELECT start_ts,mean,min,max,state,sum,last_reset_ts FROM {table} WHERE metadata_id=? ORDER BY start_ts DESC LIMIT 200', (statistic["id"],))
        # Full-entity DISTINCT/COUNTs are deliberately absent from the live path.
        # They would rescan hundreds of thousands of rows on every auto refresh.
        return {"meta": meta, "statistic": statistic, "history": history,
                "activity": [], "breakdown": None, "attributes": [],
                "statHistory": series.get("statHistory", []), "shortHistory": series.get("shortHistory", []),
                "sampledAt": stamp(), "detailScope": "latest_200"}

    def context(self, value):
        if len(value) != 32:
            raise ReaderError("invalid_context")
        try:
            binary = bytes.fromhex(value)
        except ValueError as err:
            raise ReaderError("invalid_context") from err
        with self.connect() as db:
            states = self.rows(db, '''SELECT m.entity_id,s.state,s.state_id,s.last_updated_ts
                FROM states s LEFT JOIN states_meta m USING(metadata_id)
                WHERE s.context_id_bin=? LIMIT 100''', (binary,))
            events = self.rows(db, '''SELECT t.event_type,e.time_fired_ts,
                hex(e.context_parent_id_bin) parent,d.shared_data FROM events e
                LEFT JOIN event_types t USING(event_type_id) LEFT JOIN event_data d USING(data_id)
                WHERE e.context_id_bin=? LIMIT 100''', (binary,))
            for e in events:
                e["data"] = parse(e.pop("shared_data"))
        return {"states": states, "events": events}

    def table(self, name, offset=0, snapshot=None):
        if name not in ALLOWED_TABLES:
            raise ReaderError("unknown_table")
        # Bounded UI pagination; deep OFFSET scans are forbidden on the live DB.
        offset = max(0, min(int(offset), 10000))
        with self.connect() as db:
            rows = self.rows(db, f'SELECT * FROM "{name}" LIMIT 50 OFFSET ?', (offset,))
        total = next((t["rows"] for t in snapshot["tables"] if t["name"] == name), 0) if snapshot else 0
        return {"rows": rows, "offset": offset, "total": min(total, 10050), "actualTotal": total, "limited": total > 10050}
