# Event-History-Index (vergangene Lokal-Events)

Der DTU-Kalender (`dtu-kalender.de`) listet **nur zukünftige** Events — kein Archiv,
keine Datums-Parameter. Vergangene lokale Triathlons (für den „Vergangene"-Reiter)
kommen daher aus einem **generierten Index**, den ein kleines Ingest-Skript baut.

Zwei Fakten machen das zuverlässig & ohne Fabrikation möglich:

1. **DTU-Detailseiten bleiben per ID erreichbar**, auch nachdem das Event aus der
   Liste gefallen ist (`…/event/sport/show/6641` → „37. Aasee Triathlon", 14.06.).
2. **racepedia/raceresult archivieren** ihre Ergebnis-/Live-Seiten (racepedia über
   Jahres-Subdomains, z. B. `aasee-triathlon-2025.racepedia.de`).

## Wie es funktioniert

```
scripts/ingest-events.mjs   →   src/data/eventIndex.json   →   App (Vergangene-Tab)
```

- Das Skript ermittelt die höchste DTU-Event-ID aus der Liste und **scannt ein
  ID-Fenster nach unten** (IDs sind Erstellungs-, nicht Datums-Reihenfolge), ruft
  jede `show/{id}`-Detailseite ab, behält **beendete Events der letzten 12 Monate**
  (echtes Datum aus der Seite) und mergt sie in `src/data/eventIndex.json`
  (Union per id, älter als 12 Monate wird geprunt → Forward-Akkumulation).
- Die App liest den Index über `src/services/pastEvents.ts` und mischt ihn in den
  Event-Feed (`getAllEvents`), de-dupliziert gegen den Live-Feed.
- **Tippen auf ein vergangenes Event** öffnet das bestehende `/local/[id]` — die
  Detailseite holt das Event live nach (Name, Veranstalter, Ergebnis-/Live-Ticker
  via Veranstalter-Scan). Der Index liefert also nur die **Liste**.

## Lokal ausführen

```bash
npm run ingest:events                 # Standard-Fenster (600 IDs zurück)
node scripts/ingest-events.mjs --window=950   # tieferer Backfill (mehr Vergangenheit)
node scripts/ingest-events.mjs --months=12    # Aufbewahrungsfenster in Monaten
```

Ergebnis: aktualisiertes `src/data/eventIndex.json` (committen).

## Täglich frisch halten

Damit neue „gerade vergangene" Events automatisch nachrücken, das Skript **täglich**
laufen lassen — z. B. als GitHub Action:

```yaml
# .github/workflows/ingest-events.yml
name: Ingest events
on:
  schedule: [{ cron: '0 4 * * *' }]   # täglich 04:00 UTC
  workflow_dispatch:
jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: node scripts/ingest-events.mjs --window=400
      - run: |
          git config user.name  "trizone-bot"
          git config user.email "bot@trizone.app"
          git add src/data/eventIndex.json
          git commit -m "chore: refresh event index" || echo "no changes"
          git push
```

## Frische ohne App-Release (optional)

Statt den gebündelten Snapshot bei jedem Release neu auszuliefern, kann der Index
**gehostet** werden (CDN/Static-Host). Setzt man `EXPO_PUBLIC_EVENT_INDEX_URL` auf
die JSON-URL, lädt die App den Index von dort (mit dem gebündelten Snapshot als
Fallback). So genügt ein Cron, der die JSON neu hochlädt.

## Datenintegrität

Alle Namen/Daten stammen aus echten DTU-/Timing-Seiten; `finished` wird aus dem
echten Datum abgeleitet; Ticker werden (Datum/Jahr) verifiziert. **Nichts wird
erfunden** — gibt es kein Archiv, gibt es keinen Eintrag. Siehe auch das
Roadmap-Memory (Code-Radar nutzt dieselbe Cron-Idee).

## Grenzen (v1)

- Der Backfill ist **fensterbegrenzt** → jüngere Vergangenheit ist gut abgedeckt;
  die volle Tiefe baut sich über den täglichen Lauf (Forward-Akkumulation) auf.
- Geocoding ist grob (Bundesland-Zentroid); die Detailseite geocodet den genauen
  Ort beim Öffnen.
