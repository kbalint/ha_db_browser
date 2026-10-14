# HA Adattérkép

Home Assistant egyéni integráció, beépített magyar React adminpanellel az **éles recorder SQLite adatbázis** feltérképezéséhez. A HACS szabványos `custom_components/ha_adatterkep` könyvtárszerkezetét használja. Nem kell Node.js, külön szerver, export vagy másolt adatbázis a Home Assistant gépére.

## Telepítés

### Helyi ZIP / kézi telepítés

1. A `releases/ha-adatterkep-0.1.0.zip` fájl `custom_components/ha_adatterkep` mappáját másold a Home Assistant konfigurációs könyvtárának `custom_components` mappájába.
2. Indítsd újra a Home Assistantot.
3. **Beállítások → Eszközök és szolgáltatások → Integráció hozzáadása → HA Adattérkép.**
4. Adminként nyisd meg az oldalsávban a **HA Adattérkép** panelt.
5. Indítsd el az első teljes elemzést. A legfrissebb commit és a fájlméretek addig is látszanak.

### HACS egyéni tároló

1. HACS → jobb felső menü → **Egyéni tárolók**.
2. Tároló: `https://github.com/kbalint/ha_db_browser`, típus: **Integráció**.
3. Keresd meg és töltsd le a **HA Adattérkép** integrációt.
4. Indítsd újra a Home Assistantot, majd add hozzá az integrációt a fent leírt módon.

A szükséges React modul a repóban előre felépítve szerepel. HACS telepítéshez nem kell Node.js vagy helyi build. Ez egyéni tárolóként telepíthető integráció, nem a HACS alapértelmezett katalógusának része.

## Követelmények

- Home Assistant Core 2025.6 vagy újabb; a felhasznált API-kat a 2026.10.1-es forrással is összevetettük. Valós HA-példányba történő telepítést ebben a környezetben még nem teszteltünk.
- Engedélyezett recorder, helyi fájl alapú **SQLite WAL módban**. Egyedi, abszolút recorder DB-útvonalat automatikusan felismer; tetszőleges kliensoldali útvonalat nem fogad el.
- Modern `states_meta` / `statistics_meta` séma. MariaDB, PostgreSQL, memória-DB és egyedi SQLite URI-paraméterek nem támogatottak.
- Home Assistant admin jogosultság. A panel és minden adatot visszaadó WebSocket kérés ellenőrzi.

## Mit mutat?

- Mind a 14 ismert recorder-tábla magyar magyarázata, oszlopai és idegen kulcsai.
- Tényleges tábla- és indexméretek `dbstat` alapján, külön a szabad lapok és a WAL-fájl mérete.
- Entitynkénti sorszám, időtartomány, napi forgalom, méretrangsor.
- Legutóbbi legfeljebb 200 állapot, akkori JSON attribútumok és előző állapot; kontextushoz kapcsolt állapotok/események.
- Ötperces és órás statisztikák, megfelelő név szerinti entity/statistic kapcsolattal.
- **Entity/device registry alapján bizonyított integráció/platform, config entry megjelenítési név, eszköz gyártó/modell és testvér-entityk.** Config entry jelszót, tokeneket, MQTT topicot és template-képletet nem olvas ki. A recorderben tárolt történeti attribútumokat és eseményadatokat az admin látja, ezek maguk tartalmazhatnak érzékeny adatot.

## Mit jelent az élő frissítés?

A panelen a fájlméretek és a legutóbbi commitolt állapotsor **15 másodpercenként** frissülnek, amíg a lap látható. Az entity-adatlap ugyanígy újraolvassa a legutóbbi rekordokat; a recorder `commit_interval` miatt a DB késhet a HA aktuális állapotához képest.

A teljes történet sorszámai, méretei és rangsorai **kézzel indítható elemzésből** származnak. Nincs folyamatos, automatikus teljes szkennelés. Az elemzés megszakítható és legfeljebb ötpercenként indítható. A legutóbbi sikeres eredmény memóriában marad; hiba esetén megmarad, HA újraindításkor új elemzés kell. A változatlan eredményt nem küldi újra minden frissítéskor.

A többmilliós táblákat 5000 soros, elsődleges kulcs szerinti szakaszokban olvassa, rövid szünetekkel. **Ez gördülő mérés, nem egyetlen tranzakciós snapshot**: közben érkező sorok, purge vagy adatjavítás eltérést okozhatnak. A felület jelzi a mérés idejét. A helyi 1,66 GiB-os másolaton a Python elemzés kb. 46 másodperc alatt futott le csökkentett tesztszünettel; HA-n az alapbeállítással és lassabb tárolón tovább tarthat.

Az entityméret sorarányos becslés a states + indexei méretéből, megosztott attribútumok nélkül. A technikai rekordnézet legfeljebb az első 10 050 sort lapozza; mély `OFFSET` helyett az entitykereső használható. A drága teljes entitynkénti DISTINCT attribútumszámlálás nincs a gyors frissítésbe téve; az entity-adatlapon a hiányzó érték `—`.

## Olvasás lockolt SQLite mellett

- Minden művelet saját, rövid életű `mode=ro` kapcsolatot nyit, `query_only=ON` beállítással. Nem használ `immutable=1`-et, mert az élő WAL tartalmát figyelembe kell venni.
- Nem old fel SQLite lockot, nem állít journal módot és nem használ HA recorder író sessiont.
- WAL módban a szokásos író tranzakció mellett olvasható a legutóbbi commitolt tartalom. Egy valódi kizárólagos lock, fájlcsere, mentés vagy migráció ideiglenesen megakadályozhatja az olvasást: ilyenkor hibát jelez, nem próbálja megkerülni a zárat.
- A lockra várás legfeljebb 250 ms. A teljes művelet SQL-végrehajtási kerete 3 másodperc; progress handler megszakítja a túl hosszú lekérdezést. Egy nagy objektum `dbstat` mérése ezért elmaradhat; ezt részleges méretmérésként jelzi.
- Egy integrációpéldányon belül egyszerre egy DB-művelet fut. A teljes szkennelés a szakaszok között elengedi az olvasási snapshotot, így nem tart fenn percekig egy WAL-nézetet.
- Az olvasásnak ettől még van CPU/I/O-költsége; nem ígér nulla terhelést vagy késleltetést. A WAL/SHM kísérőfájlokat az SQLite a read-only kapcsolatokhoz is használja. A program nem törli és nem cseréli őket.

Nincs törlés, purge, VACUUM, checkpoint, szűrőmódosítás vagy tetszőleges SQL-végrehajtás az integrációban.

## Fejlesztés és csomagolás

```sh
npm ci
npm run build
python -m unittest discover -s tests -v
python scripts/package.py
```

A build a helyi nézegetőt (`dist`) és a HA-ba csomagolt, offline React modult (`custom_components/ha_adatterkep/frontend/panel.js`) is elkészíti. Nincs CDN- vagy külső fontfüggőség. A release script kifejezett fájllistából dolgozik; a DB, a helyi riportok és a képernyőképek nem kerülnek a ZIP-be.

Ellenőrizve: konkurens WAL-írás/olvasás, friss WAL-commit láthatósága, read-only tiltás, SQL-időkorlát, darabolt számlálás, megszakítás, admin API-ellenőrzés és registry titokszűrés. A teljes adatbázismásolaton mind a 14 tábla mérete és sorszáma egyezett az eredeti elemzéssel. A React webkomponens és HA `callWS` illesztés böngészőtesztje szimulált HA-kapcsolattal fut; ez nem helyettesíti az éles HA telepítési próbát.

A korábbi, másolaton futó Node nézegető forrása is megmaradt (`npm start`); az élő HA integráció nem használja.

Hivatalos háttér: [HACS integrációs szerkezet](https://www.hacs.dev/docs/publish/integration/), [Recorder](https://www.home-assistant.io/integrations/recorder/), [SQLite WAL](https://sqlite.org/wal.html).
