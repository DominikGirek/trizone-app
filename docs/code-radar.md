# Code-Radar — automatischer Rabattcode-Finder

Ein „Roboter" (GitHub Action) durchsucht **wöchentlich** die Shownotes unserer
bekannten Podcasts nach neuen Rabattcodes und legt sie in eine **Prüf-Liste**.
Veröffentlicht wird **nie automatisch** — ein toter Code an der Kasse kostet
Vertrauen. Du bestätigst gute Codes von Hand (~2 Min/Woche).

```
Podcasts (RSS)  →  scripts/ingest-codes.mjs  →  src/data/codeInbox.json  →  du prüfst  →  src/lib/discountCodes.ts (live)
```

## Eine neue Quelle hinzufügen  ← das Wichtigste

Öffne **`src/data/codeSources.json`** und füge **eine Zeile** hinzu:

```jsonc
{ "name": "Name des Podcasts", "type": "podcast" }
```

- Mehr ist nicht nötig: den RSS-Feed findet der Roboter selbst über die
  iTunes-Suche (kein API-Key).
- Optional:
  - `"athleteId": "jan-frodeno"` — wenn es der eigene Podcast eines Profis ist
    (Codes erscheinen dann automatisch auch im Athleten-Profil).
  - `"country": "US"` / `"GB"` — falls der Name im falschen Store landet (Standard: DE).
  - `"rss": "https://…"` — exakten Feed festnageln, statt ihn suchen zu lassen.

Beim nächsten Lauf ist die Quelle dabei. Fertig.

## So prüfst du die Funde

`src/data/codeInbox.json` enthält die Kandidaten (`status: "pending"`):

```jsonc
{ "code": "PACETRI20", "brand": "PILLAR Performance", "percent": 20,
  "podcast": "PACE – der Ausdauerpodcast", "snippet": "…mit dem Code PACETRI20 …",
  "url": "…", "status": "pending" }
```

Guten Code prüfen → als Eintrag in `src/lib/discountCodes.ts` übernehmen
(Format dort). Erst dann ist er in der App sichtbar. Den `snippet` nutzt du als
Kontext; im Zweifel beim Shop gegenchecken.

Die Funde laufen bewusst **mit Rauschen** (lieber zu viel finden als zu wenig) —
Fehltreffer einfach ignorieren.

## Manuell starten / lokal testen

```bash
npm run ingest:codes                 # newest 10 episodes/feed, last 180 days
node scripts/ingest-codes.mjs --max=15 --days=120
```

Oder auf GitHub: **Actions → „Code-Radar (podcasts)" → Run workflow**.

## Ausbaustufen

- **Stufe 1 (jetzt):** Podcasts via RSS-Shownotes. ✅
- **Stufe 2:** YouTube — Video-Beschreibungen + Untertitel über die offizielle
  YouTube-Data-API (braucht einen gratis API-Key als GitHub-Secret). Neue
  Einträge mit `"type": "youtube"`.
- **Stufe 3:** Affiliate-Feeds (Awin etc.) als „Wahrheits-Schicht" mit echtem
  Ablaufdatum. `"type": "affiliate"`.
- **Instagram:** bewusst manuell (kein offener Zugang, Sperr-Risiko).
- **Bessere Extraktion:** optional Claude Haiku als KI-Extraktor (versteht
  Sprach-Varianten besser) — andockbar, sobald ein `ANTHROPIC_API_KEY`-Secret
  gesetzt ist.

## Warum so (Datenintegrität)

Maschine **sammelt**, Mensch **bestätigt**. Das hält die [Daten-Integritäts-Regel](privacy-policy.md)
ein: nie erfundene/tote Codes ausliefern. Das 👍/👎 + der Auto-Cutoff in der App
sind das zusätzliche Sicherheitsnetz im Betrieb.
