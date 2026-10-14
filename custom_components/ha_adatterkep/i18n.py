"""Backend messages; stable error codes and English fallback."""
MESSAGES = {
    "en": {
        "db_busy": "The database is busy (backup, purge or migration). Try again later.",
        "query_timeout": "The query reached its time limit and was stopped to protect the live recorder.",
        "sqlite_failed": "SQLite read failed; check the database and Home Assistant logs.",
        "schema_missing": "Unsupported recorder schema: modern metadata tables are missing.",
        "schema_states": "Unsupported recorder states schema.",
        "wal_required": "Live analysis requires SQLite in WAL mode. This integration does not change journal mode.",
        "unknown_table": "Unknown table.",
        "unsupported_table": "Unsupported analysis table.",
        "unknown_entity": "Unknown entity or statistical series.",
        "invalid_context": "Invalid context identifier.",
        "migrating": "Recorder migration is in progress; reads are temporarily paused.",
        "sqlite_only": "Only local, file-based recorder SQLite databases are supported.",
        "uri_unsupported": "Custom SQLite URI parameters are not supported.",
        "absolute_path": "The recorder SQLite path must be absolute.",
        "scan_cooldown": "Full analysis can run once every five minutes. Entity details remain readable live.",
        "invalid_entity": "Invalid entity identifier.",
        "pagination_limit": "The technical view only pages through the first 10,050 rows; use entity search.",
        "admin_required": "Only Home Assistant administrators can use this integration.",
        "not_loaded": "The integration is not loaded.",
        "read_failed": "Read failed; see the Home Assistant logs.",
        "analysis_failed": "Analysis failed. See the Home Assistant logs for details.",
        "registry_missing": "No entity registry entry (for example, a YAML entity or an old statistical series).",
        "registry_note": "Based on the entity/device registries. MQTT topics, passwords and template formulas are not read.",
    },
    "hu": {
        "db_busy": "Az adatbázis most foglalt (mentés, purge vagy migráció). Próbáld később.",
        "query_timeout": "A lekérdezés elérte az időkeretet; az éles recorder védelmében megszakadt.",
        "sqlite_failed": "Az SQLite olvasás sikertelen; ellenőrizd az adatbázist és a Home Assistant naplóját.",
        "schema_missing": "Nem támogatott recorder séma: hiányoznak az új metaadat-táblák.",
        "schema_states": "Nem támogatott recorder states séma.",
        "wal_required": "Az élő elemzés WAL módú SQLite adatbázist igényel. Az integráció nem módosítja a journal módot.",
        "unknown_table": "Ismeretlen tábla.",
        "unsupported_table": "Nem támogatott elemzési tábla.",
        "unknown_entity": "Ismeretlen entity vagy statisztikai idősor.",
        "invalid_context": "Hibás kontextusazonosító.",
        "migrating": "A recorder migrál; az olvasás átmenetileg szünetel.",
        "sqlite_only": "Csak helyi, fájl alapú recorder SQLite adatbázis támogatott.",
        "uri_unsupported": "Egyedi SQLite URI-paraméterezés nem támogatott.",
        "absolute_path": "A recorder SQLite útvonalának abszolútnak kell lennie.",
        "scan_cooldown": "Teljes elemzés legfeljebb ötpercenként indítható. Az entityadatok közben élőben olvashatók.",
        "invalid_entity": "Hibás entityazonosító.",
        "pagination_limit": "A technikai nézet csak az első 10 050 sort lapozza; használd az entitykeresőt.",
        "admin_required": "Csak Home Assistant admin használhatja az integrációt.",
        "not_loaded": "Az integráció nincs betöltve.",
        "read_failed": "Olvasási hiba; részletek a Home Assistant naplójában.",
        "analysis_failed": "Az elemzés sikertelen. Részletek a Home Assistant naplójában.",
        "registry_missing": "Nincs entity registry bejegyzés (például YAML entity vagy régi statisztika).",
        "registry_note": "Entity/device registry alapján. MQTT topic, jelszó és template-képlet nincs kiolvasva.",
    },
    "de": {
        "db_busy": "Die Datenbank ist belegt (Sicherung, Bereinigung oder Migration). Bitte später erneut versuchen.",
        "query_timeout": "Die Abfrage hat das Zeitlimit erreicht und wurde zum Schutz des laufenden Recorders beendet.",
        "sqlite_failed": "SQLite-Lesezugriff fehlgeschlagen; Datenbank und Home-Assistant-Protokoll prüfen.",
        "schema_missing": "Nicht unterstütztes Recorder-Schema: aktuelle Metadatentabellen fehlen.",
        "schema_states": "Nicht unterstütztes Recorder-Zustandsschema.",
        "wal_required": "Die Live-Analyse benötigt SQLite im WAL-Modus. Die Integration ändert den Journalmodus nicht.",
        "unknown_table": "Unbekannte Tabelle.",
        "unsupported_table": "Nicht unterstützte Analysetabelle.",
        "unknown_entity": "Unbekannte Entität oder statistische Zeitreihe.",
        "invalid_context": "Ungültige Kontextkennung.",
        "migrating": "Recorder-Migration läuft; Lesezugriffe sind vorübergehend angehalten.",
        "sqlite_only": "Nur lokale, dateibasierte Recorder-SQLite-Datenbanken werden unterstützt.",
        "uri_unsupported": "Benutzerdefinierte SQLite-URI-Parameter werden nicht unterstützt.",
        "absolute_path": "Der Pfad zur Recorder-SQLite-Datei muss absolut sein.",
        "scan_cooldown": "Eine vollständige Analyse ist alle fünf Minuten möglich. Entitätsdetails bleiben live lesbar.",
        "invalid_entity": "Ungültige Entitätskennung.",
        "pagination_limit": "Die technische Ansicht zeigt nur die ersten 10.050 Zeilen; bitte die Entitätssuche verwenden.",
        "admin_required": "Nur Home-Assistant-Administratoren dürfen die Integration verwenden.",
        "not_loaded": "Die Integration ist nicht geladen.",
        "read_failed": "Lesezugriff fehlgeschlagen; siehe Home-Assistant-Protokoll.",
        "analysis_failed": "Analyse fehlgeschlagen. Einzelheiten im Home-Assistant-Protokoll.",
        "registry_missing": "Kein Eintrag im Entitätsverzeichnis (etwa eine YAML-Entität oder eine alte Statistik).",
        "registry_note": "Basierend auf Entitäts-/Geräteverzeichnis. MQTT-Topics, Passwörter und Template-Formeln werden nicht gelesen.",
    },
}


def normalize_language(value):
    language = str(value or "en").lower().replace("_", "-").split("-")[0]
    return language if language in MESSAGES else "en"


def translate(code, language="en"):
    return MESSAGES[normalize_language(language)].get(code, MESSAGES["en"].get(code, code))


def localized_status(state, language="en"):
    result = dict(state)
    if code := result.get("errorCode"):
        result["error"] = translate(code, language)
    return result
