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

## Quellen-Stand
Jeder Start trägt ein `confidence`: **`confirmed`** (offizielle/Medien-Startliste)
oder **`expected`** (angekündigt). Im Profil als „✓ bestätigt" / „erwartet".

| Layer | Quelle | Robo | Key? | Status |
|---|---|---|---|---|
| **WTCS** | World-Triathlon-API (Elite-Entries) | `ingest-pro-athletes.mjs` | – | ✅ live |
| **IRONMAN/70.3/Challenge/T100** | protriathletes.org (server-gerendert!) | `ingest-pro-starts.mjs` | – | ✅ live |
| Medien-Startlisten (früh, z. B. triathlon.de) | Artikel → Abgleich mit Roster | `ingest-pro-starts-media.mjs` | – | ✅ live |
| Angekündigt/„erwartet" | News/Interviews per LLM | (Robo #4) | Haiku | geplant |

Medien-Startlisten: Registry `src/data/proStartArticles.json` (eine Zeile pro
Artikel). Der Roboter **parst die Startlisten-Tabelle** (BIB · Name · Nation;
M#/W# → Geschlecht, ISO-3→ISO-2-Land) und legt **alle** gelisteten Pros an +
bestätigte Starts mit Link zum Artikel — oft **früher** als PTO (z. B. IRONMAN
Frankfurt = 70 Pros auf triathlon.de, bevor PTO es hat). `<script>`/JSON-LD wird
vorher entfernt (sonst landen Athleten aus fremden Event-Schemas in der Liste).

**Wichtige Spike-Erkenntnis:** protriathletes.org ist **server-gerendert** (die
frühere „JS-gerendert"-Annahme stimmte nicht — die getestete 2026-Liste war nur
leer). Ergebnis-/Teilnehmer-/Rankings-Seiten haben die Daten im HTML → ein
**schlanker Node-Roboter reicht, kein Headless-Browser.** Eine Quelle deckt
IRONMAN, 70.3, Challenge und T100 ab; Land kommt aus der PTO-Weltrangliste.

**Ehrliche Grenze:** PTO-Teilnehmerlisten erscheinen erst **wenige Wochen vor dem
Rennen** (T100 früh, IRONMAN/Challenge spät). Früh angekündigte Ziel-Rennen (Kona,
Roth) Monate vorher liefern erst Robo #3 (Medien-Startlisten) + #4 (News) als
`expected`.

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
