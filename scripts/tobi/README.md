# Tobi — der Ergebnis-Robi

Zieht verifizierte Renn­ergebnisse (Top-5 je Geschlecht) für tippbare Rennen, matcht sie gegen das Roster,
und **veröffentlicht nur bei Sicherheit** — sonst hält er an und pingt. Er ersetzt das manuelle SQL-Seeding
und speist den Flagship-„Ergebnis-Moment". Vollständiges Design: [`docs/robot-fleet.md`](../../docs/robot-fleet.md).

## Architektur

```
races.mjs        raceId → Adapter-Refs (+ welche Geschlechter das Rennen wertet)
adapters/pto.mjs Quell-Adapter: protriathletes.org /results → Top-5 Slugs je Geschlecht (rein, testbar)
roster.mjs       Universum bekannter Athleten-Slugs (Union aller App-Quellen) + Geschlecht
aliases.json     Quell-Schreibweise → kanonischer Roster-Slug (Ausnahme-Auflösung, wächst mit der Zeit)
core.mjs         Roster-Match + Alias + Konfidenz-Gate → Urteil (publish/stage/fail) + robot_runs-Record
run.mjs          Orchestrator (Dry-Run): Adapter laufen lassen, bewerten, berichten
test.mjs         Offline-Beweis gegen die Roth-2026-Fixture
```

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

- **Slice 1 ✅** — Core + PTO-Adapter + `robot_runs`-Migration, offline gegen Roth bewiesen (13/13). Dry-Run,
  keine Prod-Writes, keine Secrets.
- **Slice 2** — 2.–3. Adapter (MIKA/IRONMAN/World-Triathlon) → echter Kreuzabgleich fürs Auto-Publish;
  **Kanonik-Map** (normalisierte Schreibweisen automatisch auf den gewerteten Slug ziehen).
- **Slice 3** — GitHub Action (renntag-bewusst) + Prod-Write (`raceResults.json`) + Supabase-Push.
  ⚠️ Braucht `SUPABASE_SERVICE_ROLE_KEY` als GitHub-Actions-Secret + `robot_runs`-Migration in Prod.
- **Slice 4/5** — In-App-Reveal + Admin-Cockpit.
