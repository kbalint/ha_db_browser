# HA DB browser

**English** · [Magyar](README.hu.md) · [Deutsch](README.de.md)

A custom Home Assistant integration with a React admin panel for exploring the live recorder SQLite database. No separate Node.js server, database export or copy is required.

## Language and updates

The entire interface, table and field explanations, error messages and integration setup screens are available in **English, Hungarian and German**. The panel follows the current Home Assistant interface language; if unavailable, it uses the system default language. Missing or unsupported languages fall back to **English**. Regional variants such as `de-DE` and `hu-HU` are recognised. Changing the HA language updates an open panel too. Numbers and dates use the selected language and HA's configured time zone.

The product name is **HA DB browser** in every language. The internal `ha_adatterkep` domain and panel URL stay unchanged so existing installations can update. The previous default integration entry title is automatically renamed on update; custom titles are preserved.

This update is on Git branch `v01`, integration version `0.1.1`. It is not automatically merged into `main`.

## Install with HACS

1. HACS → top-right menu → **Custom repositories**.
2. Repository: `https://github.com/kbalint/ha_db_browser`, type: **Integration**.
3. Download **HA DB browser**. HACS normally installs the default branch or a release. For the unmerged `v01` update, use manual installation from the [v01 source ZIP](https://github.com/kbalint/ha_db_browser/archive/refs/heads/v01.zip); selecting `main` will not install this update.
4. Restart Home Assistant and reload your browser.
5. **Settings → Devices & services → Add integration → HA DB browser.**
6. As an administrator, open **HA DB browser** in the sidebar and start the first full analysis.

The React module is already built in the repository. HACS installations require neither Node.js nor a local build. This is a custom repository, not an entry in the default HACS catalogue.

## Manual installation

Copy `custom_components/ha_adatterkep` from the selected branch into the `custom_components` folder of your HA configuration directory, then restart HA. To create a local installation archive, run `python scripts/package.py`: `releases/ha-db-browser-0.1.1.zip`. Existing installations do not need a second integration entry.

## Requirements

- Home Assistant Core 2025.6 or later, with recorder enabled. APIs were also checked against the 2026.10.1 source; installation testing in a real HA instance is still required.
- Local, file-based SQLite in **WAL mode**, with a modern `states_meta` / `statistics_meta` schema. The absolute recorder DB path is detected automatically.
- Home Assistant administrator privileges for the panel and every data request.
- MariaDB, PostgreSQL, in-memory databases and custom SQLite URI parameters are not supported.

## Features

- Explanations of all 14 known recorder tables, fields and foreign keys in three languages.
- Actual table and index sizes using `dbstat`, free pages and separate WAL file size.
- Entity row counts, time ranges, daily activity, search and storage ranking.
- Up to 200 latest states with the JSON attributes recorded at the time, previous state and context relationships.
- Five-minute and hourly statistics linked to entities by name. Numeric IDs in the two metadata tables are independent.
- Platform, integration entry name, device manufacturer/model and sibling entities verified against the entity/device registries.

Config-entry passwords, tokens, MQTT topics and template formulas are not read. Administrators can inspect stored recorder attributes and event payloads, which may themselves contain sensitive data. User-defined entity names, identifiers and raw database values are not translated.

## Live data and full analysis

File sizes, the latest committed row and entity details refresh **every 15 seconds** while the page is visible. Only committed data is visible; recorder's `commit_interval` may introduce a delay.

Full storage/activity analysis runs only on request, at most once every five minutes. Large tables are read in primary-key batches of 5,000 rows with pauses. This is a **rolling measurement, not an atomic snapshot**: new rows appear in the next analysis, and purging or data corrections may cause differences. The measurement time is displayed. Millions of rows can take minutes and consume CPU/I/O.

Analysis can be cancelled. The last successful result stays in memory even after an error, but restarting HA requires a new analysis. Unchanged results are not retransmitted on every refresh. Entity sizes are row-proportional estimates of states plus indexes, excluding shared attributes. The technical view pages through the first 10,050 rows; use entity search instead of deep `OFFSET`. The fast view does not count all distinct attribute sets; missing values appear as `—`.

## SQLite locking and read-only access

Each operation uses a short-lived connection with `mode=ro` and `query_only=ON`, without `immutable=1`, so WAL data remains visible. There are no writes, purge, VACUUM, checkpoint, journal-mode changes or arbitrary SQL commands.

WAL allows committed data to be read alongside normal write transactions. Genuine exclusive locks, backups, migrations or file replacement may temporarily prevent reads; locks are not bypassed. Lock waiting is limited to 250 ms and SQL execution to 3 seconds per operation. Unavailable or timed-out `dbstat` measurements are marked partial, not treated as known zero sizes.

Only one DB operation runs at a time. Connections close between batches, avoiding a WAL snapshot held for minutes. SQLite may use WAL/SHM files even for read-only connections. Reads still incur load and cannot guarantee zero latency.

## Development, verification and packaging

```sh
npm ci
npm run build
npm run test:i18n
python -m unittest discover -s tests -v
python scripts/package.py
```

The build produces the local viewer (`dist`) and offline HA module (`custom_components/ha_adatterkep/frontend/panel.js`). There are no CDN or external font dependencies. ZIPs include all three README files; databases, local reports and screenshots are excluded. Start the Node viewer with `npm start`; select its language with `?lang=en`, `?lang=hu` or `?lang=de`. The HA integration does not use this server.

Tests cover WAL concurrency, new commit visibility, read-only enforcement, locks, time budgets, cancellation, admin access, registry secret filtering, translation completeness and English fallback. The language browser test uses a simulated HA connection; it does not replace installation testing in real HA.

Optional browser tests: run `npx playwright install chromium`, then `npm run test:browser`. To use an existing browser instead, set `BROWSER_EXECUTABLE` to its executable path.

Official references: [HACS](https://www.hacs.dev/docs/publish/integration/), [Recorder](https://www.home-assistant.io/integrations/recorder/), [SQLite WAL](https://sqlite.org/wal.html).

## Automatic releases

The default development branch is `master`. Every push runs translation, backend and browser tests, builds the frontend, increments the integration patch version and publishes a GitHub release with installation and source ZIPs. HACS discovers releases during its periodic update checks. Release commits use [skip ci] to avoid recursive builds.
