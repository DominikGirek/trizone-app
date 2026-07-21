# TriZone — Robot-Flotte (Design-Doc)

> **Status:** Design abgeschlossen 2026-07-21 (via `/grill-me`). **Tobi Slices 1–2 ✅ gebaut & bewiesen**
> (Roth auto-publisht offline mit PTO×MIKA, 23/23). Lebendiges Dokument — Entscheidungen ins §5-Log. Code: `scripts/tobi/`.

---

## 0. Leitentscheidung

**Die Robi-Flotte sind volle Engagement-Maschinen — aber streng gegated.**
Sie halten nicht nur leise Daten frisch, sie *erzeugen Momente*, die die Leute in die App zurückholen.
„Gegated" = erzeugen Momente, aber **nie Spam** und **nie ungeprüfte Daten** (Datenintegrität ist heilig).

Warum: Der App-Wert explodiert am Renntag. Ein Robi, der Ergebnisse still in die DB legt, ist verschenkt.
Ein Robi, der „🏁 Roth entschieden — dein Tipp: 9 Punkte, Platz 2 in deiner Gruppe" auslöst, ist der Grund,
warum jemand die App behält.

---

## 1. Zwei Spezies von Robotern

| | **Keeper-Robis** | **Moment-Robis** |
|---|---|---|
| Job | Datenbank frisch halten | user-sichtbaren Moment erzeugen |
| Auslöser | Zeitplan (wöchentlich) | Event (Rennen endet, Athlet raus, …) |
| Sichtbarkeit | unsichtbar | Push / In-App-Banner / Inbox |
| Zeitkritik | egal | hoch (Sekunden–Stunden) |
| Datenrisiko | mittel | **hoch** (geht direkt an Menschen) |

Die 10 existierenden Robis sind **alle Keeper**. Die spannende, noch fehlende Frontier = **Moment-Robis**.

---

## 2. Bestandsaufnahme — was heute schon läuft

Alle als GitHub-Actions-Crons, wöchentlich, über die Woche verteilt (Lastspreizung), committen nach
`src/data/*.json` via `scripts/ci-commit-data.mjs` mit `[skip ci]`. **Kosten: 0 € (GitHub Actions), 24/7, ohne Mac.**

| Robi | Cron | Output | Typ |
|---|---|---|---|
| `ingest-codes` | So 05:23 | Rabattcodes aus Podcasts → `codeInbox.json` (**Review-Inbox**) + `autoCodes.json` | Keeper (+Inbox-Gate) |
| `ingest-events` | Mo 03:17 | `eventIndex.json` | Keeper |
| `ingest-pro-athletes` | Di 04:13 | WTCS-Roster → `proAthletes.json` | Keeper |
| `ingest-pro-starts` (PTO) | Mi 04:43 | `proStartsPTO.json` | Keeper |
| `ingest-pro-starts-media` | Do 05:07 | `proStartsMedia.json` | Keeper |
| `ingest-pro-starts-llm` | Fr 05:31 | `proStartsLLM.json` | Keeper |
| `ingest-pro-starts-mika` | So 06:11 | `proStartsMika.json` | Keeper |
| `ingest-race-venues` | Sa 05:41 | `raceVenues.json` | Keeper |
| `ingest-pro-starts-ironman` | — (aus) | guarded, Lizenz-Reserve | Keeper (aus) |
| `deploy-site` | bei Push | Code-Radar-Site | Deploy |

**Bekannte Lücken (heute):**
- **Tobi (Ergebnis-Robi) existiert nur zur Hälfte.** `sync-race-results.mjs` *schiebt* nur verifizierte
  Ergebnisse (`raceResults.json`) → Supabase (braucht SERVICE_ROLE, kein Workflow, manuell/lokal).
  Das *Ziehen → Roster-Matchen → 100 % Verifizieren* fehlt. Dominik seedet bis heute manuell per SQL.
- **Nichts ist renntag-/event-getrieben.** Alles wöchentlich.
- **Withdrawal-Blindheit.** Crons *addieren* Starter, erkennen aber keine *Absagen* (manueller Override
  `raceWithdrawals.json` existiert als Notlösung).
- **Kein Push, kein Banner** — kein Robi erreicht je den User.
- **Keine Übersicht / kein Cockpit** — man sieht nur in GitHub-Logs, was lief.
- **Keine Alarmierung**, wenn ein Robi kaputt ist oder Müll produziert.

---

## 3. Das Moment-Menü (Kandidaten für Moment-Robis)

> „★" = Vorschlag, auf den Dominik evtl. nicht gekommen wäre. Tier-Zuordnung s. §6.

**A · Daten-Momente (Datenintegrität-kritisch, brauchen harte Verify-Gate)**
- **Ergebnis-Moment** — Rennen entschieden → dein Tipp gescored → deine Gruppen-Platzierung **← FLAGSHIP**
- **Lineup-Change-Moment** — „Laura ist raus", „X nachgerückt" (betrifft laufende Tipps)
- **Breaking-Race-Status** — abgesagt / verkürzt / verschoben (= die alte „hot-news-push"-Idee)

**B · Loop-/Social-Momente (kein Datenrisiko, reine Bindung, billig)**
- ★ **Tipp-Fenster schließt** — „Roth sperrt in 24 h, du hast noch nicht getippt" (Reaktivierung, Kernloop)
- ★ **Du wurdest überholt** — „Luca hat dich in eurer Gruppe überholt" (sozialer Sog, extrem sticky)
- ★ **Großer Name gemeldet** — „Blummenfelt startet bei einem Rennen, das du verfolgst"
- **Rabattcode-Drop** — Code für Marke/Rennen, dem du folgst (Monetarisierung + Bindung)
- **Knapp-daneben** — „1 Platz von +3 entfernt" (emotionaler Haken nach der Auswertung)

**C · Live-Momente (hoher Aufwand, riesige Wirkung)**
- **Live-Ticker-Moment** — Führungswechsel / dein getippter Athlet führt (raceresult/WTCS nativ)

---

## 4. Architektur — `Tobi-Core` + Quell-Adapter

Falsche Dichotomie „universal vs. per-Rennen". **Nicht** ein Robi pro Rennen (Wartungshölle, bricht ständig,
Rennen teilen sich ohnehin Quellen) und **nicht** ein monolithischer Universal-Parser (zu fragil).

**Sweet Spot: ein `Tobi-Core` + Adapter pro DATENQUELLE** (nicht pro Rennen) — spiegelt exakt die schon
bewährte Startlisten-Architektur (`ingest-pro-starts-PTO/-media/-llm/-mika/-ironman`, die mergen).

- **Tobi-Core** (einmal schreiben, universal): Roster-Matching (Slug-Map) · Konfidenz-Gate ·
  Cross-Source-Verifikation · Publish → `raceResults.json` + Supabase · Moment auslösen.
- **Adapter** (spezialisiert, je 1 pro Quelle): PTO/protriathletes · IRONMAN · **raceresult** (schon für
  den Live-Ticker gebaut!) · **World-Triathlon-API** (Client existiert!) · MIKA · Editorial/LLM-Fallback.
- Ein tippbares Rennen ist mit *seinen* Adaptern getaggt (Roth = [MIKA, PTO]; Kona = [IRONMAN, PTO];
  T100 = [raceresult/PTO]).
- **Genauigkeit** kommt aus Quellen-Spezialisierung + Kreuzabgleich, **nicht** aus per-Rennen-Code →
  „per-Rennen-Genauigkeit ohne per-Rennen-Wartung". Mehrere Adapter = zugleich der Kreuzabgleich, der das
  Konfidenz-Gate speist (2 einig → Auto-Publish; nur 1 / uneinig → Freigabe-Inbox).
- Kleine, stabile Oberfläche: tippbare Rennen = eine kuratierte Handvoll/Jahr (Kona, Roth, T100-Serie,
  IM Pro Series), nicht „alle Triathlons".
- Optional für die 2–3 Kronjuwelen (Kona/Roth): dünne renn-spezifische Feinjustierung *über* den Adaptern.

---

## 5. Entscheidungs-Log

- **2026-07-21** — Flotte = **Engagement-Maschinen, gegated** (nicht nur Klempner). ✅
- **2026-07-21** — **Flagship-Moment = Ergebnis-Moment** (Rennen entschieden → Tipp gescored →
  Gruppen-Platzierung). Verschmilzt Ergebnisse + Tippspiel + Gruppen zu einem emotionalen Höhepunkt;
  zwingt Tobi (#88) endlich fertig & bombensicher; soziale Momente setzen auf demselben Event auf. ✅
- **2026-07-21** — **Tobi = Auto-Publish, konfidenz-gegated.** Standardpfad = automatische Veröffentlichung
  (Tempo am Renntag). Das Konfidenz-Gate ist kein Alternativmodus, sondern das *Sicherheitsventil*: nur bei
  100 % (jeder Top-5-Slug gematcht **und** ≥2 Quellen einig) feuert er allein; sonst nichts publishen →
  Freigabe-Inbox + Ping. Datenintegrität bleibt heilig. ✅
- **2026-07-21** — **Zustellung = Phasung.** (1) JETZT: Tobi + inszenierter **In-App-Reveal** (Picks vs.
  echtes Ergebnis, Punkte zählen hoch, Platzierung ändert sich) — sofort da für jeden, der die App öffnet,
  ohne Push-Infra/Login-Gate. (2) NACH Login-Gate: **Push** als dünne letzte Schicht auf die fertige
  Choreografie. Prinzipien: erster Push heilig (Hochwert-Moment) · nur an Rennen-Tipper (kein Spam) ·
  Push = Klingel, Reveal = Raum. ✅
- **2026-07-21** — **Cockpit = Führung durch Ausnahme, nicht durch Dashboard.** Drei Ebenen, zu 90 %
  Datenmodell + Kanal: (1) `robot_runs`-Log (Supabase-Tabelle: Robi, Zeit, Änderung, Konfidenz,
  Status ok/staged/failed) · (2) Freigabe-Inbox für angehaltene Fälle mit *Approve*-Knopf · (3) Ping an
  genau eine Person (Dominik), nur wenn nötig. UI = verstecktes Admin-Panel *in TriZone* (nur eigener
  Account), kein VPS, kein zweites Login. Robis bleiben gratis auf GitHub Actions; Panel *liest* nur.
  **Live-„Watch"-Dashboard bewusst NICHT** (Eitelkeit, frisst Zeit) — aber jederzeit später nachrüstbar,
  weil es nur eine Lese-Oberfläche auf dasselbe `robot_runs`-Log wäre. ✅
- **2026-07-21** — **Erste Moment-Welle = Tobi → Trittbrettfahrer → Withdrawal-Erkennung.** Tier 0
  (überholt / knapp daneben) fährt fast gratis auf Tobis Ergebnis-Event mit; Tier-1-Withdrawal-Erkennung
  fixt nebenbei die Datenlücke (Withdrawal-Blindheit). Tier 2/3 zurückgestellt bis Push existiert. ✅
- **2026-07-21** — **Sequencing = drei getrennte Spuren.** (1) **Login-Gate bleibt #1, unangetastet** —
  der Release-Blocker; nichts hier verwässert ihn. (2) **Tobi + In-App-Reveal = Parallelspur, darf jetzt** —
  orthogonal zum Login (kein Push/Auth), killt das manuelle SQL-Seeding, macht den Flagship für TestFlight
  real; Ziel: fertig vors nächste tippbare Rennen. (3) **Alles Push-Abhängige (Tier 2/3) = nach dem
  Login-Gate.** ✅ → **Entscheidung: Tobi jetzt angehen (Slice 1).**

---

## 6. Rest-Roster nach Tiers (nach Tobi)

- **Tier 0 · Trittbrettfahrer auf Tobi:** „Du wurdest überholt", „Knapp daneben" — nur Leaderboard-Delta,
  fast gratis, sobald Tobi + Scoring laufen.
- **Tier 1 · auf Startlisten-Crons:** Withdrawal-Erkennung („Laura raus"), „Großer Name gemeldet" — Diff
  auf die bestehenden Start­listen; Withdrawal fixt zugleich einen echten Bug.
- **Tier 2 · reiner Timer, push-abhängig:** „Tipp-Fenster schließt".
- **Tier 3 · neue Maschinerie/Risiko:** Breaking-Race-Status (hot-news), Code-Drop, Live-Ticker-Moment.

---

## 7. Tobi — konkreter Bauplan (erste Spur)

**Architektur:** `Tobi-Core` + Quell-Adapter (§4). **Auto-Publish, konfidenz-gegated** (§5).
**Test-Fixture:** die bereits verifizierten Roth-2026-Ergebnisse (`raceResults.json`, `se-ch-roth`) — wir
*kennen* die richtige Antwort, also können wir Tobi gegen die Wahrheit prüfen, bevor irgendwas live geht.

**Dünne, vertikale Slices (jede für sich beweisbar):**
1. **Core + 1 Adapter + `robot_runs`-Log, OFFLINE bewiesen** *(keine Secrets, keine Prod-Writes)* —
   Roster-Match (bestehende Slug-Map) · Konfidenz-Gate · erster Adapter (Empfehlung: PTO/protriathletes,
   am strukturiertesten + schon in unserem Stack; per Feasibility-Check zu Beginn bestätigen) → schreibt in
   `raceResults.json`. Gegen die Roth-Fixture verifiziert. Migration `robot_runs` als Datei entworfen.
2. **2.–3. Adapter** → echter Kreuzabgleich (≥2 Quellen), damit das Konfidenz-Gate feuern kann.
3. **GitHub Action** (renntag-bewusster Zeitplan: stündlich ab ~16:00 bis verifiziert, dann Stopp) +
   Prod-Wiring nach Supabase (`race_results` + `robot_runs`). ⚠️ **Braucht von Dominik:**
   `SUPABASE_SERVICE_ROLE_KEY` als GitHub-Actions-Secret + `robot_runs`-Migration in Prod (per Browser).
4. **In-App-Reveal** (der „Raum"): Picks vs. echtes Ergebnis, Punkte zählen hoch, Platzierungs-Delta;
   Tier-0-Trittbrettfahrer (überholt/knapp daneben) hier mitberechnet.
5. **Admin-Panel-Skelett** — liest `robot_runs` + Staged-Inbox (Cockpit).

**Ohne Dominik baubar:** Slices 1, 4, 5 + Migrationsdatei (lokal gegen die Roth-Fixture, keine Prod-Writes,
keine Secrets). **Nur Dominik:** GitHub-Secret setzen + Migration in Prod anwenden (Slice 3).

### Slice 1 — Stand: ✅ gebaut & bewiesen (2026-07-21)
Code in `scripts/tobi/` (`core.mjs`, `adapters/pto.mjs`, `roster.mjs`, `aliases.json`, `races.mjs`,
`run.mjs`, `test.mjs`, `fixtures/`) + Migration `supabase/migrations/20260721130000_robot_runs.sql` (Entwurf).
`node scripts/tobi/test.mjs` → **13/13 Assertions** gegen die Roth-Wahrheit. Live-Dry-Run über 4 Rennen läuft.

**Erkenntnisse aus dem Live-Lauf (fürs Design wichtig):**
- Das Roster-Match ist *real* nötig, nicht theoretisch: PTO schreibt Namen anders als unser gewertetes
  Roster. Bereits 3 verifizierte Alias-Fälle gefunden & gemappt: `carolin-pohle`→`caroline-pohle` (Roth),
  `solveig-loevseth`→`solveig-lovseth` (Hamburg), `katrine-graesboell-christensen`→`…graesboll…`.
- **Slice-2-Muss: Kanonik-Map.** „Bekannt" reicht nicht — unsere Roster-Union enthält *beide* Schreibweisen
  (weil Startlisten-Robis PTO-Spellings scrapen). Tobi muss auf die Schreibweise **kanonisieren, die die Tipps
  nutzen** (sonst matcht ein Tipp `…graesboll…` nicht das Ergebnis `…graesboell…`). → in Slice 2:
  normalisierte Auto-Alias-Ableitung (Diakritika/oe↔o) + evtl. Roster-Dedup.
- Bestätigt: mit nur 1 Quelle (PTO) staged Tobi *immer* — Auto-Publish braucht Slice 2 (2. Quelle). Das ist
  korrekt & sicher, kein Bug.

### Slice 2 — Stand: ✅ gebaut & bewiesen (2026-07-21)
Zwei Teile, beide offline gegen Roth verifiziert (`node scripts/tobi/test.mjs` → **23/23**):
- **Kanonik-Map** (`canonical.mjs`): löst Quell-Slug → gewerteter Slug über `alias → canonical →
  normalisiert → unknown`. Die Transliterations-Normalisierung (ø/ö→oe↔o, ä, ü, ß) löst `solveig-loevseth`
  & `katrine-graesboell` **automatisch** — nur *genuine* Schreibunterschiede (`carolin`↔`caroline`) brauchen
  noch einen manuellen Alias. `roster.mjs` unterscheidet jetzt **canonical** (Tipps/Wertung: mocks +
  tippableFields + raceResults) vs. **known** (Union inkl. Scrape). Sicherheit: mehrdeutige Normalform →
  *kein* Auto-Match, wird gestaged.
- **MIKA-Adapter** (`adapters/mika.mjs`): mikatiming `pid=list` → Top-5 je Geschlecht, unabhängig von PTO.
  Roth **publisht jetzt automatisch** (PTO×MIKA einig, alle Slugs kanonisch). Schöner Nebeneffekt: MIKA
  schreibt `Caroline` Pohle korrekt, wo PTO `carolin` hatte — die Quellen ergänzen sich.
- Offen bleibt: IRONMAN-Rennen (Frankfurt/Hamburg/Kona) haben nur PTO → stagen bis zu einem IRONMAN- oder
  raceresult-Adapter (kann in Slice 3 mitkommen oder später).

### Slice 3 — Stand: ✅ Code gebaut, noch nicht scharfgeschaltet (2026-07-21)
- **`publish.mjs`**: `raceResults.json`-Upsert (nur bei `publish`, **idempotent** — Serializer reproduziert
  die Datei byte-genau, hand-kuratierte `source` wird nie überschrieben) + Supabase `race_results`-Upsert
  (Leaderboards) + `robot_runs`-Insert (Cockpit, jeder Lauf).
- **`run.mjs --write/--today`**: `--write` handelt nach dem Urteil (publish → schreiben; stage/fail → nur
  loggen); `--today` filtert auf heutige Rennen (Renntag-Scheduler). Ohne Secret: JSON-Write ok, DB
  übersprungen.
- **Workflow `.github/workflows/ingest-race-results.yml`**: hourly 14–21 UTC (16–23 CEST), `--write --today`,
  committet via `ci-commit-data.mjs`, liest `SUPABASE_SERVICE_ROLE_KEY` aus den Secrets. Idempotent →
  Off-Day-/Bereits-publisht-Läufe sind No-Ops.
- Lokal ohne Secret verifiziert: Roth publisht, `raceResults.json` bleibt **unverändert** (idempotent),
  Supabase sauber übersprungen. `--today` heute (21.07.) = „No race scheduled".
- **Scharfschalten:** (1) `SUPABASE_SERVICE_ROLE_KEY` als GitHub-Actions-Secret — ⏳ **offen (Dominik; ein
  Admin-Key, den Claude nicht anfassen darf).** (2) `robot_runs`-Migration in Prod — ✅ **erledigt
  2026-07-21 per Browser** (Tabelle da, 3 Indizes, RLS an, 0 Zeilen). Sobald das Secret gesetzt ist, ist
  Tobi live.

---

## 8. Leitplanken (gelten für die ganze Flotte)

- **Datenintegrität ist heilig** — nie erfundene Ergebnisse/Daten; im Zweifel anhalten + Ping.
- **Login-Gate bleibt #1** vor dem öffentlichen Release; die Robi-Spur verwässert ihn nie.
- **Kosten null halten** — GitHub Actions statt VPS; kein Paperclip-Betrieb über Claude-/ChatGPT-Abo
  (ToS-/Ban-Risiko). LLM nur mit API-Key und nur wo nötig (Tobi matcht primär ohne LLM).
- **SERVICE_ROLE-Key** nur als Secret (GitHub/Env), niemals committen; nur der PUBLIC anon-Key shipt.
- **Ask before build** — kein `eas build/submit` ohne ausdrückliches OK.

---

## Anhang · Referenzen
- Roadmap-Memos: `race-center`, `tobi-results-robot`, `startlist-robot`, `code-radar`, `hot-news-push`
- Bestehender Code: `scripts/ingest-*.mjs`, `scripts/sync-race-results.mjs`, `.github/workflows/ingest-*.yml`
