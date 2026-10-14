"""Chunked analysis orchestration, shared by HA and integration tests."""
from __future__ import annotations

import asyncio
from collections import defaultdict
import logging
import time

from .database import ReaderError, stamp
from .i18n import translate

_LOGGER = logging.getLogger(__name__)


def merge(target, row):
    target["rows"] = target.get("rows", 0) + row["rows"]
    for key, fn in (("first", min), ("last", max)):
        if row[key] is not None:
            target[key] = row[key] if target.get(key) is None else fn(target[key], row[key])
    target["stateBytes"] = target.get("stateBytes", 0) + (row.get("stateBytes") or 0)


async def scan(reader, execute, progress, pause=0.025):
    """No persistent transaction; watermarked rolling analysis, not atomic snapshot."""
    result = await execute(reader.skeleton)
    entities = {e["metadata_id"]: e for e in result["entities"]}
    stats = {s["id"]: s for s in result["stats"]}
    event_types = {e["event_type_id"]: {**e, "rows": 0, "first": None, "last": None} for e in await execute(reader.event_types)}
    days = defaultdict(int)
    for table in result["tables"]:
        name = table["name"]
        progress({"phase": name, "rowsRead": 0})
        if name in result["watermarks"]:
            cursor, count = 0, 0
            while True:
                chunk = await execute(reader.chunk, name, cursor, result["watermarks"][name])
                if not chunk:
                    break
                for row in chunk:
                    if name == "states":
                        key = row["metadata_id"]
                        if key in entities:
                            merge(entities[key], row)
                        days[row["day"]] += row["rows"]
                    elif name == "events":
                        key = row["event_type_id"]
                        if key in event_types:
                            merge(event_types[key], row)
                    elif row["metadata_id"] in stats:
                        key = row["metadata_id"]
                        stat = stats[key].setdefault(name, {"metadata_id": key, "rows": 0, "first": None, "last": None})
                        merge(stat, row)
                    count += row["rows"]
                cursor = max(r["cursor"] for r in chunk)
                progress({"phase": name, "rowsRead": count})
                await asyncio.sleep(pause)
            table["rows"] = count
        else:
            table["rows"] = await execute(reader.small_count, name)
        # dbstat may be absent in the SQLite build. Never fabricate physical sizes.
        for object_name in [name] + [i["name"] for i in table["indexes"]]:
            try:
                size = await execute(reader.object_size, object_name)
            except ReaderError:
                result["storageAvailable"] = False
                size = {"name": object_name, "bytes": None, "payload": None, "unused": None, "pages": None}
            result["objects"].append(size)
            if object_name == name:
                table["storage"] = size
            else:
                next(i for i in table["indexes"] if i["name"] == object_name).update(size)
            await asyncio.sleep(pause)
    result["entities"].sort(key=lambda x: x["rows"], reverse=True)
    result["events"] = sorted(event_types.values(), key=lambda x: x["rows"], reverse=True)
    result["days"] = [{"day": k or "—", "rows": v} for k, v in sorted(days.items(), key=lambda x: x[0] or "")]
    result.update(await execute(reader.live))
    result["generated"] = stamp()
    return result


class AnalysisManager:
    """Serialize I/O; retain the last good scan and bound refresh requests."""

    def __init__(self, reader, executor, guard=None):
        self.reader, self.executor = reader, executor
        self.guard = guard
        self.snapshot = None
        self.task = None
        self.state = {"running": False, "phase": "idle", "rowsRead": 0, "error": None}
        self._lock = asyncio.Lock()
        self.last_start = 0.0

    async def execute(self, fn, *args):
        async with self._lock:
            if self.guard:
                self.guard()
            # Cancelling an await does not terminate the underlying sqlite worker.
            # Keep the serialization lock until that bounded worker really ends.
            job = asyncio.ensure_future(self.executor(fn, *args))
            try:
                return await asyncio.shield(job)
            except asyncio.CancelledError:
                try:
                    await job
                except Exception:
                    pass
                raise

    async def run(self):
        self.state = {"running": True, "phase": "starting", "rowsRead": 0, "error": None}
        self.last_start = time.monotonic()
        try:
            self.snapshot = await scan(self.reader, self.execute, self.state.update)
            self.state.update({"phase": "complete", "completed": stamp()})
        except asyncio.CancelledError:
            self.state.update({"phase": "cancelled"})
            raise
        except Exception as err:
            if not isinstance(err, ReaderError):
                _LOGGER.exception("HA DB browser background analysis failed")
            code = err.code if isinstance(err, ReaderError) else "analysis_failed"
            self.state.update({"phase": "error", "errorCode": code, "error": translate(code)})
        finally:
            self.state["running"] = False

    async def close(self):
        if self.task and not self.task.done():
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
            self.state.update({"running": False, "phase": "cancelled"})
