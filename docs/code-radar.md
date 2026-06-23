# Code-Radar — automatischer Rabattcode-Finder

Ein „Roboter" (GitHub Action) durchsucht **wöchentlich** Podcasts und
YouTube-Kanäle nach neuen Rabattcodes und **stellt sie vollautomatisch live** in
der App — kein manueller Schritt. Dein einziger Hebel: einen Code bei Bedarf
**offline nehmen** (Blockliste).

Damit nur Brauchbares live geht, gibt es ein **Qualitäts-Gate**: veröffentlicht
wird nur, was einen **Rabatt-% UND eine echte Shop-URL** hat (Marke = erkannte
Marke oder aus der Shop-Domain). Alles andere bleibt nur im Debug-Log
(`codeInbox.json`). Für Aktualität: nur die **4 neuesten Folgen/Videos** je Quelle,
**Ablaufdaten** werden erkannt (`validUntil` → App blendet abgelaufene aus),
bereits abgelaufene Codes kommen gar nicht erst rein.

```
Podcasts (RSS) + YouTube  →  scripts/ingest-codes.mjs  →  src/data/autoCodes.json  →  LIVE in der App
                                                       ↘  src/data/codeInbox.json (alle Funde, Debug)
src/data/codeBlocklist.json  →  nimmt Codes wieder offline (dein einziger Eingriff)
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

Für einen **YouTube-Kanal** stattdessen:

```jsonc
{ "name": "Lionel Sanders (YouTube)", "type": "youtube",
  "youtube": "https://www.youtube.com/@Lionel.Sanders", "athleteId": "lionel-sanders" }
```

(Kanal-URL, `@handle` oder `channel/UC…` — der Roboter liest den keyless
Kanal-Feed inkl. Video-Beschreibungen.) Beim nächsten Lauf ist die Quelle dabei.

## Einen Code offline nehmen  ← dein einziger Eingriff

Trage in **`src/data/codeBlocklist.json`** die **id** (aus `autoCodes.json`, z. B.
`"cand-pace-pacetri20"`) **oder** den reinen **Code** (`"PACETRI20"`) ein:

```jsonc
{ "blocked": ["PACETRI20", "cand-besenwagen-besenwagen20"] }
```

Die App blendet ihn sofort aus (beim nächsten Laden/OTA) und der Roboter
veröffentlicht ihn nicht erneut. Sonst musst du nichts tun.

## Was wo liegt

- **`src/data/autoCodes.json`** — die **live** ausgespielten Codes (nicht von Hand
  bearbeiten, der Roboter überschreibt sie). Die App lädt diese Datei **zur
  Laufzeit** von der GitHub-Raw-URL (überschreibbar via `EXPO_PUBLIC_CODES_URL`),
  mit dem gebündelten Stand als Fallback → **neue Wochen-Codes erscheinen ohne
  App-Update** (`src/services/codes.ts`).
- **`src/data/codeInbox.json`** — *alle* Funde inkl. der nicht-veröffentlichten
  (Debug/Transparenz). Beispiel-Eintrag:

```jsonc
{ "code": "PACETRI20", "brand": "PILLAR Performance", "percent": 20,
  "validUntil": "2026-12-31", "source": "PACE – der Ausdauerpodcast",
  "sourceType": "podcast", "url": "…", "status": "pending" }
```

- **`src/lib/discountCodes.ts`** — die **kuratierten** Codes von Hand (gewinnen bei
  Code-Dopplung). Die App zeigt kuratierte + Auto-Codes zusammen.

`validUntil` ist nur gesetzt, wenn in den Shownotes ein Ablaufdatum stand —
übernimm es 1:1 in den Code-Eintrag (die App versteckt abgelaufene automatisch).

Guten Code prüfen → als Eintrag in `src/lib/discountCodes.ts` übernehmen
(Format dort). Erst dann ist er in der App sichtbar. Den `snippet` nutzt du als
Kontext; im Zweifel beim Shop gegenchecken.

Die Funde laufen bewusst **mit Rauschen** (lieber zu viel finden als zu wenig) —
Fehltreffer einfach ignorieren.

## Manuell starten / lokal testen

```bash
npm run ingest:codes                 # newest 4 episodes/feed, last 365 days
node scripts/ingest-codes.mjs --max=8 --days=400
```

Oder auf GitHub: **Actions → „Code-Radar (podcasts)" → Run workflow**.

## Bekannte Grenze: veraltete iTunes-Feeds

Bei wenigen Podcasts liefert die iTunes-Suche einen **alten Feed** (der Podcast
ist zu einem neuen Hoster umgezogen) → im Log steht „0 episodes". Das ist nicht
kaputt, nur stale. Fix = den **aktuellen RSS-Link pinnen**:

```jsonc
{ "name": "FatBoysRun", "type": "podcast", "rss": "https://aktueller-feed.xml" }
```

Den aktuellen Feed findest du auf der Podcast-Website oder via „RSS"-Link bei
fyyd.de / castfeedvalidator. Aktuell betrifft das u. a. FatBoysRun, Tri it Fit,
Triathlon Science, The Greg Bennett Show.

## Ausbaustufen

- **Stufe 1 (jetzt):** Podcasts via RSS-Shownotes. ✅
- **Stufe 2 (jetzt):** YouTube — Video-Beschreibungen über den **keyless**
  Kanal-Feed (kein API-Key, kein Secret!). ✅ Neue Quelle:
  `{ "name": "…", "type": "youtube", "youtube": "https://www.youtube.com/@handle", "athleteId": "…" }`
  (Kanal-URL, `@handle` oder `channel/UC…`). Nur-gesprochene Codes (nicht in der
  Beschreibung) bräuchten Untertitel/Whisper → späterer Ausbau.
- **Stufe 3:** Affiliate-Feeds (Awin etc.) als „Wahrheits-Schicht" mit echtem
  Ablaufdatum. `"type": "affiliate"`.
- **Instagram:** bewusst manuell (kein offener Zugang, Sperr-Risiko).
- **Bessere Extraktion:** optional Claude Haiku als KI-Extraktor (versteht
  Sprach-Varianten besser) — andockbar, sobald ein `ANTHROPIC_API_KEY`-Secret
  gesetzt ist.

## Warum so (Datenintegrität)

Der Roboter läuft **vollautomatisch** (kein Freigabe-Schritt). Drei Sicherheitsnetze
halten die Qualität: (1) das **Qualitäts-Gate** beim Veröffentlichen (nur Code mit
Rabatt-% + echter Shop-URL), (2) das **Ablaufdatum** (abgelaufene fliegen raus),
(3) im Betrieb das **👍/👎 + Auto-Cutoff** in der App. Der manuelle Hebel ist nur
das **Offline-Nehmen** über die Blockliste. Bewusste Abwägung des Owners: lieber
voll automatisch + selten mal nachsteuern als jede Woche manuell freigeben.
