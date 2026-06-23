# Pro-Athleten-Roboter

Legt **Profi-Athlet:innen** automatisch aus echten **Startlisten** an — jede:r
bekommt ein volles Profil (Steckbrief, Kommende Starts, Links, News, Codes). Nur
Elite/Pro, **nie Age Grouper**.

```
World-Triathlon-API (Elite-Entries)  →  scripts/ingest-pro-athletes.mjs  →  src/data/proAthletes.json  →  App merged auf den kuratierten Stand
```

## Was er füllt
- **Athlet:in:** id (Namens-Slug), Name, ISO-2-Land (Flagge), Geschlecht, Serie
  (`wtcs`), Geburtsjahr, Link zum offiziellen World-Triathlon-Profil.
- **Kommende Starts:** Event + Datum + Ort, und als Quelle der **Link zur
  Event-/Startlisten-Seite** — Tippen im Profil öffnet die Startliste, auf der
  der/die Athlet:in steht.

Der Merge passiert in `services/athletes.ts`: kuratierte Athlet:innen
(`mocks/athletes.ts`) **gewinnen** bei gleicher id, generierte kommen oben drauf →
hand-getunte Profile bleiben maßgeblich, neue Pros erscheinen automatisch.

## Quellen-Stand (ehrlich)
| Circuit | Startliste maschinenlesbar? | Status |
|---|---|---|
| **WTCS** (World Triathlon API) | ✅ Elite-Entries, sauber | **live** |
| IRONMAN / 70.3 / Pro Series | ❌ JS-gerendert (ironman.com) | Headless-Robo |
| T100 / PTO | ❌ JS-gerendert (protriathletes.org) | Headless-Robo |

Die anderen Circuits liefern ihre Startlisten erst per JavaScript im Browser aus
(kein `__NEXT_DATA__`, keine Namen im HTML) → ein reiner Node-Roboter kommt nicht
ran. Dafür kommt ein **Headless-Browser-Roboter** (Playwright in der Action) als
nächster Schritt; Muster und App-Merge stehen schon, er muss nur dasselbe
`proAthletes.json`-Format schreiben.

## Manuell / Zeitplan
```bash
npm run ingest:pro                 # nächste 150 Tage WTCS
node scripts/ingest-pro-athletes.mjs --days=90
```
Automatisch: **dienstags** (GitHub Action „Ingest pro athletes (WTCS)"), committet
`proAthletes.json` nur bei echten Änderungen.

## Datenintegrität
Nur **Elite-Programme** der World-Triathlon-API (keine Age Grouper). Namen, Länder,
Daten kommen 1:1 aus der offiziellen API; nichts erfunden. Start-URLs zeigen auf die
offizielle Event-Seite mit der Startliste.
