# Tobi — der Ergebnis-Robi

Zieht verifizierte Renn­ergebnisse (Top-5 je Geschlecht) für tippbare Rennen, matcht sie gegen das Roster,
und **veröffentlicht nur bei Sicherheit** — sonst hält er an und pingt. Er ersetzt das manuelle SQL-Seeding
und speist den Flagship-„Ergebnis-Moment". Vollständiges Design: [`docs/robot-fleet.md`](../../docs/robot-fleet.md).

## Architektur

```
raceMap.json      DIE Registry: PTO-Slug → app raceId (+ optional MIKA + single-gender-Override). Einzige Pflege.
races.mjs         lädt raceMap → fertige Adapter-Refs; füllt Jahr automatisch (kein Datum, kein Hardcode-Jahr)
adapters/pto.mjs  Quell-Adapter: protriathletes.org /results → Top-5 Slugs je Geschlecht (rein, testbar)
adapters/mika.mjs Quell-Adapter: mikatiming pid=list → Top-5 je Geschlecht (unabhängig von PTO)
roster.mjs        Slug-Universum in zwei Stufen: canonical (Tipps/Wertung) + known (Union inkl. Scrape)
canonical.mjs     löst Quell-Slug → kanonischen Slug: alias → canonical → normalisiert (Diakritika) → unknown
aliases.json      Quell-Schreibweise → kanonischer Slug (nur genuine Fälle; Transliteration macht canonical.mjs)
core.mjs          Kanonik + Kreuzabgleich + Stabilitäts-Gate → Urteil (publish/stage/fail) + robot_runs
publish.mjs       Schreib-Schicht: raceResults.json upsert (idempotent) + Supabase race_results/robot_runs + fetchLastRun
run.mjs           Orchestrator: Registry iterieren, Fertiges/Nicht-Gelaufenes überspringen, bewerten, schreiben
test.mjs          Offline-Beweis gegen die Roth-2026-Fixtures (PTO + MIKA + Stabilitäts-Gate)
```

## Selbst-entdeckend (24/7)

Tobi iteriert `raceMap.json` bei **jedem** Lauf — **kein Datum, kein manuelles Triggern**:
- Rennen schon vollständig in `raceResults.json` → übersprungen (kein Fetch).
- Rennen noch nicht gelaufen → Quellen liefern keine Finisher → still übersprungen (kein Log-Rauschen).
- Rennen fertig → Gate greift → Publish.

**Ein neues tippbares Rennen = eine Zeile in `raceMap.json`** (nur verifizierten PTO-Slug eintragen).

**Überfällig-Alarm (gegen stilles Versagen):** jede Registry-Zeile trägt ihr `date` (von der PTO-Renn-Seite).
Ist ein Rennen **>36 h** nach seinem Datum immer noch ohne Ergebnis → Tobi schreibt eine sichtbare
`ÜBERFÄLLIG`-Zeile in `robot_runs` (Cockpit-Ping) statt still zu überspringen — fängt falschen/fehlenden
PTO-Slug oder ein Rennen, das PTO nicht publisht hat. Log-Dedup (`sameRun`): eine Zeile pro Zustand, kein
Stunden-Spam; verankert zugleich die Stabilitäts-Uhr am Erst-Sichtungszeitpunkt.

## Konfidenz-Gate (Hybrid — „nie falsche Ergebnisse")

Auto-Publish, wenn alle Top-5 kanonisch aufgelöst + jede erwartete Kategorie komplett (5) **UND**
- **Cross-Source:** ≥2 unabhängige Quellen liefern das identische Top-5 (→ sofort, z. B. Roth PTO×MIKA), **ODER**
- **Temporal:** eine einzelne Quelle ist **stabil** — der vorige Lauf (≥~45 min her, aus `robot_runs`) hatte
  das identische Top-5 (finalisierte Ergebnisse ändern sich nicht mehr).

Sonst → `stage` (geloggt; nächster Lauf bestätigt). Unbekannter Slug / unvollständig → nie publishen.

## Modi (`run.mjs`)

```bash
node scripts/tobi/run.mjs                     # ganze Registry, live, Dry-Run (nichts geschrieben)
node scripts/tobi/run.mjs --race=se-ch-roth   # ein Rennen erzwingen (ignoriert den „schon fertig"-Skip)
node scripts/tobi/run.mjs --write             # publish → raceResults.json (+ Supabase, wenn SERVICE_ROLE)
```
`--write` fasst `raceResults.json` **nur bei `publish`** an und **idempotent**. Supabase-Push nur mit `SUPABASE_SERVICE_ROLE_KEY`.

## Konfidenz-Gate (Datenintegrität ist heilig)

- **AUTO-PUBLISH** nur wenn **≥2 Quellen** auf die identische Top-5 kommen, **alle** Slugs bekannt sind und
  jede erwartete Kategorie vollständig ist (5 Finisher).
- Sonst **STAGE** → Freigabe-Inbox + Ping (unbekannter Slug, unvollständig, nur 1 Quelle, Quellen uneinig).
- Ein unbekannter Finisher wird **nie** erfunden. Diskrepante Schreibweisen löst ein Alias in `aliases.json`
  (einmal mappen → für immer automatisch).

## Status

- **Slices 1–3 ✅ LIVE** (2026-07-22) — Core + PTO/MIKA-Adapter + Kanonik-Map + `publish.mjs` +
  Workflow (hourly 14–21 UTC). Secret gesetzt + `robot_runs`-Migration angewandt; Smoke-Test bestanden.
- **Auto-Discovery ✅** — `raceMap.json`-Registry + Iterieren/Skip + **Temporal-Stabilitäts-Gate** (Hybrid)
  + **Überfällig-Alarm** (`overdue.mjs`, gegen stilles Versagen) + Log-Dedup. `test.mjs` = 33/33 offline.
  Tobi läuft **hands-off 24/7** und meldet sich, wenn ein erwartetes Ergebnis ausbleibt.
- **In-App-Reveal ✅** (Slice 4) — `src/app/reveal/[id].tsx` + Dashboard-Cue (separates Feature).
- **Offen:** IRONMAN-Adapter (Kona/Frankfurt cross-source statt nur PTO+Stabilität) · Kona in `raceMap`
  (PTO-Slug 2026 noch 404) · Slice 5 (Admin-Cockpit) · Gruppen-Rang im Reveal.
- **Cross-Saison-Hinweis:** ein bereits publishtes `raceId` wird übersprungen; für die nächste Saison
  muss die App/Season den alten Eintrag zurücksetzen (raceIds sind jahresunabhängig).
