# HA DB browser

[English](README.md) · **Magyar** · [Deutsch](README.de.md)

Home Assistant egyéni integráció React adminpanellel az éles recorder SQLite adatbázisának böngészéséhez. Nem kell külön Node.js szerver, adatbázis-export vagy másolat.

## Nyelv és frissítés

A teljes felület, a táblák és mezők magyarázatai, a hibák és az integráció beállítási képernyői **angolul, magyarul és németül** érhetők el. A panel a Home Assistant aktuális felületi nyelvét követi; ha ez nem áll rendelkezésre, a rendszer alapnyelvét használja. Hiányzó vagy nem támogatott nyelvnél **angolra** vált. A régiós változatok, például `de-DE` és `hu-HU`, támogatottak. A HA nyelvének változása a nyitott panelen is érvényesül. A számok és időpontok a kiválasztott nyelv, illetve a HA beállított időzónája szerint jelennek meg.

Az alkalmazás neve minden nyelven **HA DB browser**. A belső `ha_adatterkep` azonosító és a panel útvonala a korábbi telepítések frissíthetősége miatt változatlan. A korábbi alapértelmezett integrációnév frissítéskor automatikusan átneveződik; az egyedileg megadott neveket nem írja felül.

A `v01` Git-ág tartalmazza ezt a frissítést, az integráció verziója `0.1.1`. A `main` ágba ettől még nem kerül automatikusan.

## Telepítés HACS-ból

1. HACS → jobb felső menü → **Egyéni tárolók**.
2. Tároló: `https://github.com/kbalint/ha_db_browser`, típus: **Integráció**.
3. Töltsd le a **HA DB browser** integrációt. A HACS általában az alapértelmezett ágat vagy egy kiadást telepít. Az egyelőre különálló `v01` frissítéshez használd a [v01 forrás ZIP-et](https://github.com/kbalint/ha_db_browser/archive/refs/heads/v01.zip) és a kézi telepítést; a `main` kiválasztása ezt a frissítést nem telepíti.
4. Indítsd újra a Home Assistantot, és töltsd újra a böngészőt.
5. **Beállítások → Eszközök és szolgáltatások → Integráció hozzáadása → HA DB browser.**
6. Adminként nyisd meg az oldalsávban a **HA DB browser** panelt, és indítsd el az első teljes elemzést.

A React modul előre felépítve szerepel a repóban. HACS-telepítéshez nem kell Node.js vagy build. Ez egyéni tároló, nem a HACS alapértelmezett katalógusának része.

## Kézi telepítés

A kiválasztott ág `custom_components/ha_adatterkep` mappáját másold a HA konfigurációs könyvtárának `custom_components` mappájába, majd indítsd újra a HA-t. Helyi csomag készíthető a `python scripts/package.py` paranccsal: `releases/ha-db-browser-0.1.1.zip`. Meglévő integrációnál nem kell új példányt hozzáadni.

## Követelmények

- Home Assistant Core 2025.6 vagy újabb, engedélyezett recorderrel. A használt HA API-kat a 2026.10.1 forrásával is összevetettük; valódi HA-telepítési próba még szükséges.
- Helyi fájl alapú SQLite, **WAL módban**, modern `states_meta` / `statistics_meta` sémával. Az abszolút recorder DB-útvonalat automatikusan felismeri.
- Home Assistant adminjogosultság a panelhez és minden adatkéréshez.
- MariaDB, PostgreSQL, memória-DB és egyedi SQLite URI-paraméterek nem támogatottak.

## Funkciók

- Mind a 14 ismert recorder-tábla leírása, mezői és idegen kulcsai három nyelven.
- Tényleges tábla- és indexméretek `dbstat` alapján; szabad lapok és külön WAL-méret.
- Entitynkénti sorszám, időtartomány, napi forgalom, keresés és méretrangsor.
- Legutóbbi legfeljebb 200 állapot, akkori JSON-attribútumok, előző állapot és kontextuskapcsolatok.
- Ötperces és órás statisztikák, entity/statistic név szerinti összekapcsolással. A két metaadat-tábla numerikus azonosítói függetlenek.
- Entity/device registry alapján igazolt platform, integrációbejegyzés neve, eszköz gyártója/modellje és testvér-entityk.

Az integráció nem olvas config-entry jelszót, tokent, MQTT topicot vagy template-képletet. Az admin látja a recorderben tárolt attribútumokat és eseményadatokat; ezek önmagukban is tartalmazhatnak érzékeny adatot. A felhasználói entitynevek, azonosítók és a nyers adatbázisértékek nem fordítódnak le.

## Élő adatok és teljes elemzés

A fájlméretek, a legutóbbi commitolt sor és az entity-adatlap **15 másodpercenként** frissülnek látható lapon. Csak commitolt adat látható; a recorder `commit_interval` miatt késés lehet.

A teljes méret- és forgalomelemzés csak kézi indításra fut, legfeljebb ötpercenként. A nagy táblákat 5000 soros, elsődleges kulcs szerinti darabokban olvassa, szünetekkel. Ez **gördülő mérés, nem atomi snapshot**: közben érkező sorok a következő elemzésben jelennek meg, purge vagy adatjavítás eltérést okozhat. A felület jelzi a mérés idejét. Többmillió sornál percekig tarthat, és CPU/I/O-terheléssel jár.

A munka megszakítható. Az utolsó sikeres eredmény hiba esetén is megmarad a memóriában, de HA-újraindításkor új elemzés kell. A változatlan eredményt nem küldi újra minden frissítéskor. Az entityméret sorarányos becslés a states + indexei méretéből, megosztott attribútumok nélkül. A technikai nézet az első 10 050 sort lapozza; mély `OFFSET` helyett használd az entitykeresést. A gyors nézet nem számolja végig az összes különböző attribútumkészletet; a hiányzó érték `—`.

## SQLite-lock és csak olvasás

Minden művelet rövid életű `mode=ro`, `query_only=ON` kapcsolatot használ, `immutable=1` nélkül, hogy lássa a WAL-t. Nincs írás, purge, VACUUM, checkpoint, journalmód-váltás vagy tetszőleges SQL-végrehajtás.

WAL módban a normál író tranzakció mellett olvashatók a commitolt adatok. Valódi kizárólagos lock, mentés, migráció vagy fájlcsere idején az olvasás meghiúsulhat; az integráció nem kerüli meg a zárat. Lockra legfeljebb 250 ms-ot vár, a SQL-végrehajtási keret műveletenként 3 másodperc. Az időkorlátos vagy nem elérhető `dbstat` mérés részlegesként jelenik meg, nem nulla méretként.

Egyszerre egy DB-művelet fut. A szakaszok között a kapcsolat bezárul, így nem tart fenn percekig egy WAL-snapshotot. Az SQLite read-only kapcsolatokhoz is használhatja a WAL/SHM fájlokat. Az olvasás nem jelent nulla terhelést vagy garantáltan nulla késleltetést.

## Fejlesztés, ellenőrzés és csomagolás

```sh
npm ci
npm run build
npm run test:i18n
python -m unittest discover -s tests -v
python scripts/package.py
```

A build elkészíti a helyi nézegetőt (`dist`) és az offline HA-modult (`custom_components/ha_adatterkep/frontend/panel.js`). Nincs CDN- vagy külső fontfüggőség. A ZIP-ek tartalmazzák mindhárom README-t; adatbázisok, helyi riportok és képernyőképek nem kerülnek bele. A Node nézegető `npm start` paranccsal indítható, a nyelve `?lang=en`, `?lang=hu` vagy `?lang=de` paraméterrel választható; a HA-integráció nem használja ezt a szervert.

A tesztek ellenőrzik a WAL-párhuzamosságot, friss commitok láthatóságát, read-only tiltást, lockot, időkeretet, megszakítást, adminjogokat, registry titokszűrést, a három fordítás teljességét és az angol fallbacket. A nyelvi böngészőteszt szimulált HA-kapcsolatot használ; nem helyettesíti a valódi HA-telepítési próbát.

Opcionális böngészőteszt: `npx playwright install chromium`, majd `npm run test:browser`. Meglévő böngésző használatához a `BROWSER_EXECUTABLE` környezeti változóban add meg a futtatható fájlját.

Hivatalos háttér: [HACS](https://www.hacs.dev/docs/publish/integration/), [Recorder](https://www.home-assistant.io/integrations/recorder/), [SQLite WAL](https://sqlite.org/wal.html).

## Automatikus kiadások

Az alapértelmezett fejlesztési ág a `master`. Minden push fordítási, backend- és böngészőteszteket futtat, felépíti a frontendet, növeli az integráció patch verzióját, és GitHub release-t készít a telepítő és forrás ZIP-pel. A HACS az időszakos ellenőrzés során jelzi az új kiadásokat. A verziócommitok [skip ci] jelölése megakadályozza az ismétlődő buildet.
