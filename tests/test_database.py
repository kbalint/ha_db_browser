"""Executable with stdlib unittest; no HA install or production DB writes."""
import asyncio
import importlib.util
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import threading
import time
import types
import unittest

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "custom_components" / "ha_adatterkep"
# Import the pure reader/scanner without executing HA's integration entrypoint.
module = types.ModuleType("explorer_test")
module.__path__ = [str(PACKAGE)]
sys.modules["explorer_test"] = module
from explorer_test.database import ReaderError, SQLiteReader
from explorer_test import scanner
from explorer_test import database

DDL = """
CREATE TABLE states_meta(metadata_id INTEGER PRIMARY KEY,entity_id TEXT);
CREATE TABLE state_attributes(attributes_id INTEGER PRIMARY KEY,shared_attrs TEXT);
CREATE TABLE states(state_id INTEGER PRIMARY KEY,metadata_id INTEGER,state TEXT,last_updated_ts FLOAT,last_changed_ts FLOAT,last_reported_ts FLOAT,old_state_id INTEGER,attributes_id INTEGER,context_id_bin BLOB,context_parent_id_bin BLOB);
CREATE INDEX ix_states_metadata_id_last_updated_ts ON states(metadata_id,last_updated_ts);
CREATE INDEX ix_states_context_id_bin ON states(context_id_bin);
CREATE TABLE statistics_meta(id INTEGER PRIMARY KEY,statistic_id TEXT,source TEXT,unit_of_measurement TEXT,mean_type INTEGER);
CREATE TABLE statistics(id INTEGER PRIMARY KEY,metadata_id INTEGER,start_ts FLOAT,mean FLOAT,min FLOAT,max FLOAT,state FLOAT,sum FLOAT,last_reset_ts FLOAT);
CREATE TABLE statistics_short_term(id INTEGER PRIMARY KEY,metadata_id INTEGER,start_ts FLOAT,mean FLOAT,min FLOAT,max FLOAT,state FLOAT,sum FLOAT,last_reset_ts FLOAT);
CREATE TABLE schema_changes(change_id INTEGER PRIMARY KEY,schema_version INTEGER);
CREATE TABLE event_types(event_type_id INTEGER PRIMARY KEY,event_type TEXT);
CREATE TABLE event_data(data_id INTEGER PRIMARY KEY,shared_data TEXT);
CREATE TABLE events(event_id INTEGER PRIMARY KEY,event_type_id INTEGER,data_id INTEGER,time_fired_ts FLOAT,context_id_bin BLOB,context_parent_id_bin BLOB);
CREATE INDEX ix_events_context_id_bin ON events(context_id_bin);
INSERT INTO states_meta VALUES(7,'sensor.test');
INSERT INTO state_attributes VALUES(1,'{"unit_of_measurement":"W","device_class":"power"}');
INSERT INTO statistics_meta VALUES(90,'sensor.test','recorder','W',1);
INSERT INTO schema_changes VALUES(1,53);
INSERT INTO statistics VALUES(1,90,100,42,40,44,NULL,NULL,NULL);
INSERT INTO statistics_short_term VALUES(1,90,100,41,40,42,NULL,NULL,NULL);
INSERT INTO event_types VALUES(1,'test_event');
INSERT INTO event_data VALUES(1,'{"entity_id":"sensor.test"}');
"""
CONTEXT = bytes.fromhex("01" * 16)


class DatabaseTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "recorder.db"
        self.writer = sqlite3.connect(self.path)
        self.writer.execute("PRAGMA journal_mode=WAL")
        self.writer.executescript(DDL)
        self.writer.executemany("INSERT INTO states VALUES(?,7,?, ?,NULL,NULL,?,1,?,NULL)",
                                [(i, str(i), 1700000000+i, i-1 if i>1 else None, CONTEXT) for i in range(1,121)])
        self.writer.execute("INSERT INTO events VALUES(1,1,1,1700000001,?,NULL)", (CONTEXT,))
        self.writer.commit()
        self.reader = SQLiteReader(self.path)

    def tearDown(self):
        self.writer.close()
        self.temp.cleanup()

    async def execute(self, fn, *args):
        return await asyncio.to_thread(fn, *args)

    def test_read_only_and_missing_database(self):
        self.assertEqual(self.reader.validate()["journalMode"], "wal")
        with self.reader.connect() as db:
            with self.assertRaises(sqlite3.OperationalError):
                db.execute("DELETE FROM states")
        missing = self.path.with_name("does-not-exist.db")
        with self.assertRaises(ReaderError):
            SQLiteReader(missing).live()
        self.assertFalse(missing.exists())

    def test_live_reads_uncheckpointed_wal_commit(self):
        self.writer.execute("INSERT INTO states(state_id,metadata_id,state,last_updated_ts,attributes_id) VALUES(121,7,'99',1700000121,1)")
        self.writer.commit()
        self.assertGreater(self.reader.live()["walBytes"], 0)
        self.assertEqual(self.reader.live()["latest"]["state_id"], 121)
        d = self.reader.entity("sensor.test")
        self.assertEqual(d["history"][0]["state"], "99")
        self.assertEqual(d["history"][0]["attributes"]["unit_of_measurement"], "W")
        self.assertEqual(d["statistic"]["id"], 90)  # NOT states_meta.metadata_id=7
        self.assertEqual(d["statHistory"][0]["mean"], 42)
        self.assertEqual(len(self.reader.context(CONTEXT.hex())["states"]), 100)
        self.assertEqual(self.reader.context(CONTEXT.hex())["events"][0]["data"]["entity_id"], "sensor.test")

    async def test_scan_counts_matches_sql_and_releases_writer(self):
        old_chunk = database.CHUNK_SIZE
        database.CHUNK_SIZE = 20
        latencies = []
        stop = threading.Event()
        def writer_loop():
            c = sqlite3.connect(self.path, timeout=.25)
            while not stop.is_set():
                start = time.monotonic()
                c.execute("UPDATE states SET state=state WHERE state_id=1")
                c.commit()
                latencies.append(time.monotonic()-start)
                time.sleep(.003)
            c.close()
        t = threading.Thread(target=writer_loop)
        t.start()
        try:
            result = await scanner.scan(self.reader, self.execute, lambda p: None, pause=.005)
        finally:
            stop.set(); t.join(); database.CHUNK_SIZE = old_chunk
        state = next(t for t in result["tables"] if t["name"] == "states")
        self.assertEqual(state["rows"], 120)
        self.assertEqual(result["entities"][0]["rows"], 120)
        self.assertEqual(sum(d["rows"] for d in result["days"]), 120)
        self.assertEqual(result["stats"][0]["statistics"]["rows"], 1)
        self.assertEqual(result["events"][0]["rows"], 1)
        self.assertEqual(result["consistency"], "rolling")
        self.assertTrue(latencies)
        self.assertLess(max(latencies), .25)

    def test_limits_and_injection(self):
        with self.assertRaises(ReaderError):
            self.reader.table('states"; DELETE FROM states; --')
        with self.assertRaises(ReaderError):
            self.reader.context("' OR 1=1 --")
        with self.assertRaises(ReaderError):
            self.reader.chunk("sqlite_master", 0, 100)
        bounded = SQLiteReader(self.path, query_seconds=.01)
        start = time.monotonic()
        with self.assertRaises(ReaderError):
            with bounded.connect() as db:
                db.execute("WITH RECURSIVE cnt(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM cnt WHERE x<100000000) SELECT sum(x) FROM cnt").fetchone()
        self.assertLess(time.monotonic()-start, 1)

    async def test_cancel_and_failed_scan_preserve_snapshot(self):
        manager = scanner.AnalysisManager(self.reader, self.execute)
        manager.snapshot = {"previous": True}
        async def wait_forever():
            await asyncio.sleep(60)
        manager.task = asyncio.create_task(wait_forever())
        await manager.close()
        self.assertTrue(manager.task.cancelled())
        self.assertEqual(manager.snapshot, {"previous": True})
        manager.reader = SQLiteReader(self.path.with_name("missing.db"))
        await manager.run()
        self.assertFalse(manager.state["running"])
        self.assertEqual(manager.state["phase"], "error")
        self.assertEqual(manager.snapshot, {"previous": True})

    def test_non_wal_rejected(self):
        other = self.path.with_name("delete-journal.db")
        c = sqlite3.connect(other); c.executescript(DDL); c.close()
        with self.assertRaisesRegex(ReaderError, "WAL"):
            SQLiteReader(other).validate()

    def test_exclusive_lock_returns_quick_busy_error(self):
        locked = self.path.with_name("exclusive.db")
        c = sqlite3.connect(locked)
        c.execute("PRAGMA journal_mode=WAL")
        c.executescript(DDL)
        c.execute("PRAGMA locking_mode=EXCLUSIVE")
        c.execute("BEGIN EXCLUSIVE")
        c.execute("UPDATE states_meta SET entity_id=entity_id")
        c.commit()
        start = time.monotonic()
        try:
            with self.assertRaisesRegex(ReaderError, "foglalt"):
                SQLiteReader(locked).live()
            self.assertLess(time.monotonic()-start, .8)
        finally:
            c.close()

    async def test_cancel_waits_for_running_worker_before_next_query(self):
        manager = scanner.AnalysisManager(self.reader, self.execute)
        running = threading.Event()
        finished = threading.Event()
        def work():
            running.set()
            time.sleep(.08)
            finished.set()
        first = asyncio.create_task(manager.execute(work))
        while not running.is_set():
            await asyncio.sleep(.002)
        first.cancel()
        second = asyncio.create_task(manager.execute(lambda: finished.is_set()))
        with self.assertRaises(asyncio.CancelledError):
            await first
        self.assertTrue(await second)


if __name__ == "__main__":
    unittest.main()
