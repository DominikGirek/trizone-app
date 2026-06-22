# Athlete Hub — Datenstruktur & Pipeline (für den Raspberry Pi)

Ziel: aus jedem Athleten-Profil eine kleine „Bibel" machen (Steckbrift, Vita,
Erfolge, **offizielle Links/Social**, später Foto & Ergebnisse). Die anreicherbaren
Daten liegen bewusst **getrennt vom Code** in JSON-Dateien, damit ein automatischer
Job (Pi / Cron) sie regenerieren kann, **ohne TypeScript anzufassen** — gleiches
Muster wie `eventIndex.json` und `teamIndex.json`.

## Dateien
- **`src/data/athleteLinks.json`** — offizielle Auftritte je Athlet:in.
  ```jsonc
  {
    "generatedAt": "ISO-Datum",
    "links": {
      "<athleteId>": {            // id aus src/mocks/athletes.ts
        "instagram": "https://…", // volle URL
        "youtube":   "https://…",
        "website":   "https://…",
        "podcast":   "https://…", // z. B. Frodeno „Going Mental"
        "strava":    "https://…"
      }
    }
  }
  ```
- Gemerged in **`src/services/athletes.ts`** (`withLinks()`): `athlete.links = { …base, …athleteLinks[id] }`.
  Wird in `getAthletes`, `getAthleteById`, `getAthletesByIds` angewandt → Profilseite
  (`src/app/athlete/[id].tsx`) zeigt die Links automatisch (leer = ausgeblendet).

## Regeln (Datenintegrität — hart)
- **Nur verifizierte, offizielle** Accounts. Niemals Handles raten.
- Verifikation: offizielle Website, verifizierter Account (blauer Haken / Followerzahl),
  Verlinkung von triathlon.org / Marken-/Verbandsseiten. Im Zweifel **weglassen**.
- Eine fehlende Angabe ist okay (UI blendet sie aus). Ein falscher Link ist nicht okay.

## Was der Pi tun soll (geplant)
1. Über `src/mocks/athletes.ts` iterieren (id + name + country).
2. Pro Athlet:in offizielle Präsenzen suchen (Suchmaschine/LLM), Kandidaten **verifizieren**.
3. `athleteLinks.json` schreiben (Union/Update; nur verifizierte Felder).
4. Optional später: zweite Datei `athleteProfiles.json` für **Steckbrief** (birthYear,
   heightCm, weightKg, residence), **Vita** und **Erfolge** — Felder existieren bereits
   im `Athlete`-Typ (`src/types/index.ts`), aktuell nur für Top-Namen kuratiert.
5. Optional: Ergebnisse für WTCS-Athlet:innen über die World-Triathlon-API
   (Name→WT-ID-Mapping), PTO-Stats für Langdistanz.
6. **Fotos:** nur mit Rechten/Lizenz (Urheberrecht) — nicht scrapen.

Frische ohne App-Release später wie bei den anderen Indizes möglich
(`EXPO_PUBLIC_ATHLETE_LINKS_URL` + Fallback auf gebündelte JSON) — bei Bedarf nachrüsten.

## Aktueller Seed (manuell verifiziert 2026-06-22, 14 Top-Athlet:innen)
Frodeno (IG + Podcast „Going Mental"), Lange (IG + Website), Haug (IG), Philipp (IG +
Website), Funk (IG + YouTube), Lindemann (IG), Kienle (IG + YouTube + Website),
Lucy Charles-Barclay (IG + YouTube + Website), Blummenfelt (IG), Ryf (IG + YouTube +
Website), A. Brownlee (IG), Yee (IG), Beaugrand (IG), Knibb (IG). Rest folgt über den Pi.
