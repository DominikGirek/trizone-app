# TriZone – Projektplan / Roadmap

Lebendes Dokument. Phasen sind nach **Abhängigkeit & Aufwand** geordnet, nicht nach starren Daten.
Aufwand: S (Stunden) · M (Tage) · L (1–2 Wochen) · XL (mehrere Wochen / laufend).

---

## Wo wir stehen (Fundament ✅ – store-ready)
- **Dashboard:** Smart-Hero (Meine Rennen / Hauptrennen-Countdown, Live/Renn-Woche/Athleten-Moment), „In der Nähe", Favoriten, personalisierte News.
- **Events:** kompletter DTU-Kalender (Deutschland) + IRONMAN/Challenge/T100 (verifiziert, inkl. Kona-WM & 70.3 Málaga) + Filter Kontinent/Land/Monat.
- **News:** 10 verifizierte Feeds (DE+EN), „Für dich"-Personalisierung, Themen/Sprach-Filter; **News zum Rennen** auf Detailseiten **inkl. Lokalpresse** (Google News pro Rennen).
- **Tabellen:** WTCS-Weltrangliste + deutsche Ligen (live).
- **Live-Ticker** (raceresult), **Following-Hub** (Athleten/Serien/Marken), **100 echte Athlet:innen**, i18n DE/EN, Branding, **EAS-Konfig + Launch-Doku**.

---

## Phase 0 — Launch (JETZT) · Aufwand M
**Ziel:** echte Nutzer + Feedback. Blockiert nichts, schaltet alles frei.
- Konten: Apple Developer (99 €/J), Google Play (25 $), Expo.
- Datenschutz-Seite hosten · Screenshots · Builds (`eas build`) · `eas submit` · Review.
- ⚠️ Google: 14-Tage-Test mit 12 Testern (neue Privatkonten).
- Anleitung: [`launch-guide.md`](launch-guide.md), Texte: [`store-listing.md`](store-listing.md).
- **Entscheidung:** jetzt mit aktuellem MVP raus, oder erst Phase 1 dazu? → Empfehlung: **jetzt raus**, parallel Phase 1.

## Phase 1 — Quick Wins (Client / fast backend-frei) · Aufwand S–M
**Ziel:** mehr Mehrwert + erste Monetarisierung, ohne großen Bau.
- **🎟️ Rabattcode-Reiter** (kuratierte DB wie `seriesEvents`; Affiliate; Werbe-Kennzeichnung; Codes verfallen → Pflege). *Niedrigst hängende Frucht.*
- **📓 Renn-Tagebuch** (private Bewertung + Notiz an „Meine Rennen", lokal) → Datenmodell-Vorstufe für Reviews.
- **📋 Race Briefing** pro Rennen (kuratierte Tipps: Parken, Wassertemp, Cutoffs + Sponsor-Link).
- Optional: Dashboard-Inhalts-Tabs, mehr verifizierte Serien-Rennen, Athleten-Fotos.

## Phase 2 — Backend-Fundament · Aufwand L–XL
**Ziel:** der eine Infra-Schritt, der mehrere Features freischaltet (Hosting z. B. Supabase/Cloudflare).
- Backend (DB + Cron + Hosting) + **Push-Service** (Expo Push, APNs/FCM, EAS-Dev-Build).
- **Push-Benachrichtigungen** für gefolgte **Athleten + Marken** (Titel-Match, Anti-Spam/Digest/Caps).
- **Accounts**: anonym-first, **Login nur beim Schreiben** (Sign in with Apple/Google), lokale Daten migrieren.

## Phase 3 — Community + Plattform · Aufwand XL
**Ziel:** Reviews als Discovery-Motor + Reichweite über Vereine.
- **Renn-Reviews** (Google-Style, strukturierte Tri-Dimensionen, **Verified Finisher**, ★ auf Cards, Sortierung „Top-bewertet").
- **Moderation** (Pflicht: Melden/Block/Filter/Admin-Ban) + Recht/DSGVO.
- **Veranstalter-Onboarding**: „claim your race", **QR-Plakate** (Deep-Link auf Review-Screen), Antwort auf Reviews.
- **Aktive Vereins-Akquise** (vom User gewünscht).

## Phase 4 — Monetarisierung skalieren · Aufwand L (laufend)
**Ziel:** Umsatzkanäle ausbauen („je mehr Kanäle, desto besser" – mit Maß).
- **Bezahlte Marken-Pushes / „Shop"** (z. B. 200 € pro Push; klar als Werbung, Caps/Opt-in).
- **Affiliate skalieren** (Rabattcodes, Race-Briefing-Sponsorlinks), Veranstalter-Partnerschaften.

---

## Abhängigkeits-Logik
- Reviews → braucht **Accounts + Backend + Moderation**.
- Push (Athleten/Marken) **und** bezahlte Pushes → brauchen **Backend**.
- Veranstalter-Tools/QR → brauchen **Backend + Accounts**.
- Rabattcodes, Renn-Tagebuch, Race Briefing → **jetzt machbar** (kuratiert/lokal), Affiliate später.

## Querschnitt / laufend
Daten-Frische (Kalender, Codes), echte WT-Ergebnisse, Robustheit (Error-Boundary, Crash-Reporting), privacy-freundliche Analytics, Performance, Recht (Impressum, AGB, Werbe-Kennzeichnung, ggf. Gewerbe).

## Offene Strategie-Entscheidungen (Brainstorm)
1. **Launch-Timing:** sofort mit MVP, oder erst Phase 1?
2. **Backend-Stack:** Supabase vs Cloudflare vs Railway?
3. **Kapazität:** alles solo, oder punktuell Hilfe (v. a. Backend/Moderation)?
4. **Recht/Business:** ab wann Gewerbe/Impressum (spätestens bei Werbung/Affiliate)?
5. **Reihenfolge der Monetarisierung:** Affiliate (früh, leicht) vs bezahlte Pushes (später, braucht Backend).

## Top-Risiken
Pflege-Aufwand kuratierter Daten · Backend = laufende Kosten + erste Ops · UGC-Moderation (Recht/Zeit) · Store-Review (Google 14-Tage-Test) · Single-Founder-Bandbreite.
