# HA DB browser

<img src="custom_components/ha_adatterkep/brand/icon.png" alt="HA DB browser Symbol" width="96">

Die Integration enthält ein eigenes cyanfarbenes Datenbank-Lupen-Symbol. Home Assistant ab 2026.3 zeigt diese lokalen Markenbilder nach Installation und Neustart an; ältere Versionen können einen Platzhalter anzeigen.

[English](README.md) · [Magyar](README.hu.md) · **Deutsch**

Benutzerdefinierte Home-Assistant-Integration mit React-Adminpanel zum Durchsuchen der laufenden Recorder-SQLite-Datenbank. Kein separater Node.js-Server, Datenbankexport oder Kopieren erforderlich.

## Sprache und Aktualisierung

Die gesamte Oberfläche, Tabellen- und Feldbeschreibungen, Fehlermeldungen und der Einrichtungsdialog sind auf **Englisch, Ungarisch und Deutsch** verfügbar. Das Panel folgt der aktuellen Home-Assistant-Oberflächensprache. Ist diese nicht verfügbar, verwendet es die Systemstandardsprache. Fehlende oder nicht unterstützte Sprachen fallen auf **Englisch** zurück. Regionale Varianten wie `de-DE` und `hu-HU` werden erkannt. Änderungen der HA-Sprache wirken auch im geöffneten Panel. Zahlen und Datumsangaben verwenden die ausgewählte Sprache und die in HA eingestellte Zeitzone.

Der Produktname lautet in jeder Sprache **HA DB browser**. Die interne Kennung `ha_adatterkep` und die Panel-URL bleiben für bestehende Installationen unverändert. Der frühere Standardname des Integrationseintrags wird beim Update automatisch ersetzt; individuelle Namen bleiben erhalten.

Diese Aktualisierung liegt im Git-Branch `v01`, Integrationsversion `0.1.1`. Sie wird dadurch nicht automatisch nach `main` übernommen.

## Installation über HACS

1. HACS → Menü oben rechts → **Benutzerdefinierte Repositories**.
2. Repository: `https://github.com/kbalint/ha_db_browser`, Typ: **Integration**.
3. **HA DB browser** herunterladen. HACS installiert normalerweise den Standardbranch oder ein Release. Das noch separate `v01`-Update über die [v01-Quell-ZIP](https://github.com/kbalint/ha_db_browser/archive/refs/heads/v01.zip) manuell installieren; die Auswahl von `main` installiert dieses Update nicht.
4. Home Assistant neu starten und den Browser neu laden.
5. **Einstellungen → Geräte & Dienste → Integration hinzufügen → HA DB browser.**
6. Als Administrator **HA DB browser** in der Seitenleiste öffnen und die erste vollständige Analyse starten.

Das React-Modul ist bereits im Repository gebaut. Für HACS sind weder Node.js noch ein lokaler Build erforderlich. Dies ist ein benutzerdefiniertes Repository, kein Eintrag im HACS-Standardkatalog.

## Manuelle Installation

Den Ordner `custom_components/ha_adatterkep` des gewünschten Branches in den Ordner `custom_components` des HA-Konfigurationsverzeichnisses kopieren und HA neu starten. Mit `python scripts/package.py` lässt sich lokal `releases/ha-db-browser-0.1.1.zip` erstellen. Bei einer bestehenden Installation keinen zusätzlichen Integrationseintrag anlegen.

## Voraussetzungen

- Home Assistant Core 2025.6 oder neuer mit aktiviertem Recorder. Die APIs wurden auch mit dem Quellstand 2026.10.1 verglichen; ein Installationstest in echtem HA steht noch aus.
- Lokale dateibasierte SQLite-Datenbank im **WAL-Modus**, mit aktuellem `states_meta`-/`statistics_meta`-Schema. Der absolute Recorder-DB-Pfad wird automatisch erkannt.
- Home-Assistant-Administratorrechte für Panel und sämtliche Datenanfragen.
- MariaDB, PostgreSQL, Speicherdatenbanken und benutzerdefinierte SQLite-URI-Parameter werden nicht unterstützt.

## Funktionen

- Beschreibungen aller 14 bekannten Recorder-Tabellen, ihrer Felder und Fremdschlüssel in drei Sprachen.
- Tatsächliche Tabellen- und Indexgrößen mit `dbstat`; freie Seiten und separate WAL-Dateigröße.
- Zeilenanzahl, Zeitraum, tägliche Aktivität, Suche und Größenrangliste pro Entität.
- Bis zu 200 letzte Zustände mit damaligen JSON-Attributen, vorherigem Zustand und Kontextbeziehungen.
- Fünf-Minuten- und Stundenstatistiken mit namensbasierter Zuordnung von Entität und Statistik. Die numerischen IDs der Metadatentabellen sind unabhängig.
- Durch Entitäts-/Geräteverzeichnis belegte Plattform, Name des Integrationseintrags, Gerätehersteller/-modell und weitere Entitäten desselben Geräts.

Passwörter, Tokens, MQTT-Topics und Template-Formeln aus Konfigurationseinträgen werden nicht gelesen. Administratoren sehen gespeicherte Recorder-Attribute und Ereignisinhalte, die selbst sensible Daten enthalten können. Benutzerspezifische Entitätsnamen, Kennungen und rohe Datenbankwerte werden nicht übersetzt.

## Live-Daten und vollständige Analyse

Dateigrößen, letzte bestätigte Zeile und Entitätsdetails aktualisieren sich bei sichtbarer Seite **alle 15 Sekunden**. Nur bestätigte Daten sind sichtbar; der Recorder-`commit_interval` kann eine Verzögerung verursachen.

Die vollständige Größen-/Aktivitätsanalyse startet ausschließlich manuell, höchstens alle fünf Minuten. Große Tabellen werden nach Primärschlüssel in Abschnitten zu 5.000 Zeilen mit Pausen gelesen. Es handelt sich um eine **gleitende Messung, keinen atomaren Snapshot**: neue Zeilen erscheinen in der nächsten Analyse; Bereinigung oder Datenkorrekturen können Abweichungen verursachen. Der Messzeitpunkt wird angezeigt. Millionen von Zeilen können Minuten dauern und CPU-/I/O-Last erzeugen.

Die Analyse ist abbrechbar. Das letzte erfolgreiche Ergebnis bleibt bei Fehlern im Arbeitsspeicher, nach einem HA-Neustart ist jedoch eine neue Analyse nötig. Unveränderte Ergebnisse werden nicht bei jeder Aktualisierung erneut übertragen. Entitätsgrößen sind zeilenanteilige Schätzungen aus states und Indizes ohne gemeinsame Attribute. Die technische Ansicht zeigt die ersten 10.050 Zeilen; statt tiefem `OFFSET` die Entitätssuche verwenden. Die Schnellansicht zählt nicht alle unterschiedlichen Attributsätze; fehlende Werte erscheinen als `—`.

## SQLite-Sperren und Schreibschutz

Jeder Vorgang nutzt eine kurzlebige Verbindung mit `mode=ro` und `query_only=ON`, ohne `immutable=1`, damit WAL-Daten sichtbar bleiben. Keine Schreibzugriffe, Purge-, VACUUM- oder Checkpoint-Aufrufe, Journalmodusänderungen oder beliebigen SQL-Befehle.

Im WAL-Modus können bestätigte Daten während normaler Schreibtransaktionen gelesen werden. Echte Exklusivsperren, Sicherungen, Migrationen oder Dateiaustausch können Lesezugriffe vorübergehend verhindern; Sperren werden nicht umgangen. Die Wartezeit auf Sperren beträgt höchstens 250 ms, das SQL-Zeitbudget pro Vorgang 3 Sekunden. Nicht verfügbare oder zeitlich abgebrochene `dbstat`-Messungen werden als unvollständig gekennzeichnet, nicht als Größe null.

Es läuft jeweils ein DB-Vorgang. Zwischen Abschnitten wird die Verbindung geschlossen, sodass kein minutenlanger WAL-Snapshot bestehen bleibt. SQLite kann WAL-/SHM-Dateien auch für schreibgeschützte Verbindungen verwenden. Lesen bedeutet weder null Last noch garantiert null Verzögerung.

## Entwicklung, Prüfung und Paketierung

```sh
npm ci
npm run build
npm run test:i18n
python -m unittest discover -s tests -v
python scripts/package.py
```

Der Build erzeugt den lokalen Betrachter (`dist`) und das Offline-HA-Modul (`custom_components/ha_adatterkep/frontend/panel.js`). Keine CDN- oder externen Schriftabhängigkeiten. ZIPs enthalten alle drei README-Dateien; Datenbanken, lokale Berichte und Screenshots sind ausgeschlossen. Der Node-Betrachter startet mit `npm start`; `?lang=en`, `?lang=hu` oder `?lang=de` wählt die Sprache. Die HA-Integration nutzt diesen Server nicht.

Tests prüfen WAL-Parallelität, Sichtbarkeit neuer Commits, Schreibschutz, Sperren, Zeitlimit, Abbruch, Adminrechte, Geheimnisschutz im Registry-Zugriff, Vollständigkeit aller Übersetzungen und englischen Fallback. Der Sprach-Browsertest verwendet eine simulierte HA-Verbindung und ersetzt keinen echten HA-Installationstest.

Optionale Browsertests: `npx playwright install chromium`, anschließend `npm run test:browser`. Für einen vorhandenen Browser dessen ausführbare Datei über die Umgebungsvariable `BROWSER_EXECUTABLE` angeben.

Offizielle Grundlagen: [HACS](https://www.hacs.dev/docs/publish/integration/), [Recorder](https://www.home-assistant.io/integrations/recorder/), [SQLite WAL](https://sqlite.org/wal.html).

## Automatische Releases

Der Standard-Entwicklungsbranch ist `master`. Jeder Push führt Übersetzungs-, Backend- und Browsertests aus, baut das Frontend, erhöht die Patch-Version der Integration und veröffentlicht ein GitHub-Release mit Installations- und Quellcode-ZIP. HACS erkennt neue Releases bei regelmäßigen Aktualisierungsprüfungen. Release-Commits verwenden [skip ci], um rekursive Builds zu verhindern.
