# Tobi — der Ergebnis-Robi

Zieht verifizierte Renn­ergebnisse (Top-5 je Geschlecht) für tippbare Rennen, matcht sie gegen das Roster,
und **veröffentlicht nur bei Sicherheit** — sonst hält er an und pingt. Er ersetzt das manuelle SQL-Seeding
und speist den Flagship-„Ergebnis-Moment". Vollständiges Design: [`docs/robot-fleet.md`](../../docs/robot-fleet.md).

## Architektur

```
races.mjs         raceId → Adapter-Refs (PTO, MIKA, …) + welche Geschlechter das Rennen wertet
adapters/pto.mjs  Quell-Adapter: protriathletes.org /results → Top-5 Slugs je Geschlecht (rein, testbar)
adapters/mika.mjs Quell-Adapter: mikatiming pid=list → Top-5 je Geschlecht (unabhängig von PTO)
roster.mjs        Slug-Universum in zwei Stufen: canonical (Tipps/Wertung) + known (Union inkl. Scrape)
canonical.mjs     löst Quell-Slug → kanonischen Slug: alias → canonical → normalisiert (Diakritika) → unknown
aliases.json      Quell-Schreibweise → kanonischer Slug (nur genuine Fälle; Transliteration macht canonical.mjs)
core.mjs          Kanonik-Auflösung + Kreuzabgleich + Konfidenz-Gate → Urteil (publish/stage/fail) + robot_runs
publish.mjs       Schreib-Schicht: raceResults.json upsert (idempotent) + Supabase race_results/robot_runs
run.mjs           Orchestrator: alle Adapter laufen lassen, bewerten, berichten; `--write`/`--today`
test.mjs          Offline-Beweis gegen die Roth-2026-Fixtures (PTO + MIKA)
```

## Modi (`run.mjs`)

```bash
node scripts/tobi/run.mjs                     # alle Rennen, live, Dry-Run (nichts geschrieben)
node scripts/tobi/run.mjs --race=se-ch-roth   # ein Rennen
node scripts/tobi/run.mjs --write             # publish → raceResults.json (+ Supabase, wenn SERVICE_ROLE)
node scripts/tobi/run.mjs --write --today      # nur heutige Rennen (Renntag-Scheduler der GitHub Action)
```
`--write` fasst `raceResults.json` **nur bei `publish`** an und **idempotent** (identische Top-5 → kein
Schreiben). Supabase-Push (`race_results` + `robot_runs`) nur, wenn `SUPABASE_SERVICE_ROLE_KEY` gesetzt ist.

## Konfidenz-Gate (Datenintegrität ist heilig)

- **AUTO-PUBLISH** nur wenn **≥2 Quellen** auf die identische Top-5 kommen, **alle** Slugs bekannt sind und
  jede erwartete Kategorie vollständig ist (5 Finisher).
- Sonst **STAGE** → Freigabe-Inbox + Ping (unbekannter Slug, unvollständig, nur 1 Quelle, Quellen uneinig).
- Ein unbekannter Finisher wird **nie** erfunden. Diskrepante Schreibweisen löst ein Alias in `aliases.json`
  (einmal mappen → für immer automatisch).

## Benutzung

```bash
node scripts/tobi/test.mjs                     # Offline-Beweis (kein Netz, keine Writes)
node scripts/tobi/run.mjs                      # alle Rennen, live, Dry-Run (nichts geschrieben)
node scripts/tobi/run.mjs --race=se-ch-roth    # ein Rennen
```

## Slice-Status

- **Slice 1 ✅** — Core + PTO-Adapter + `robot_runs`-Migration, offline gegen Roth bewiesen. Dry-Run.
- **Slice 2 ✅** — **MIKA-Adapter** (echter Kreuzabgleich) + **Kanonik-Map** (`canonical.mjs`,
  Transliterations-Normalisierung). Roth publisht jetzt **auto** mit 2 einigen Quellen (PTO×MIKA).
  `node scripts/tobi/test.mjs` = 23/23 offline. IRONMAN-Rennen (Frankfurt/Hamburg/Kona) haben noch nur
  PTO → stagen, bis ein IRONMAN-Adapter dazukommt.
- **Slice 3 ✅ (Code gebaut, noch nicht scharf)** — `publish.mjs` (idempotenter `raceResults.json`-Upsert +
  Supabase-Push) + `run.mjs --write/--today` + Workflow `.github/workflows/ingest-race-results.yml`
  (renntag-bewusst, hourly 14–21 UTC). Lokal ohne Secret getestet (Roth publisht, Datei unverändert).
  ⚠️ **Zum Scharfschalten (Dominik):** (1) `SUPABASE_SERVICE_ROLE_KEY` als GitHub-Actions-Secret,
  (2) `robot_runs`-Migration in Prod anwenden. Bis dahin: JSON-Write ok, DB-Push/Log übersprungen.
- **Slice 4/5** — In-App-Reveal + Admin-Cockpit.
