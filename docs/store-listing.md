# TriZone – Store-Listing & Veröffentlichungs-Checkliste

Vorgefertigte Texte und Angaben für App Store Connect (Apple) und Google Play Console.
Frei anpassbar. `[…]` = noch ausfüllen.

---

## Eckdaten
- **Name:** TriZone
- **Kategorie:** Sport
- **Bundle ID / Package:** `com.trizone.app`
- **Altersfreigabe:** 4+ / USK 0 (keine bedenklichen Inhalte)
- **Preis:** kostenlos
- **Datenschutz-URL:** https://trizone.app/datenschutz
- **Impressum-URL:** https://trizone.app/impressum
- **Support-URL/E-Mail:** kontakt@trizone.app · https://trizone.app

## App Store (Apple)
- **Untertitel (max. 30 Z.):** Triathlon: News, Rennen, Live
- **Keywords (max. 100 Z.):** `triathlon,ironman,challenge,wtcs,70.3,t100,rennen,ergebnisse,schwimmen,rad,laufen,dtu`
- **Werbetext (optional):** Dein Triathlon-Begleiter: News, Rennkalender, Weltrangliste & Live-Ticker.

## Google Play
- **Kurzbeschreibung (max. 80 Z.):** Triathlon-News, Rennkalender, Weltrangliste & Live-Ticker – an einem Ort.

## Beschreibung (DE)
TriZone ist deine App für Triathlon – Schwimmen, Rad und Laufen an einem Ort.

• News aus den wichtigsten deutschen & internationalen Triathlon-Magazinen – smart nach deinen Interessen sortiert
• Rennkalender: alle Events deutschlandweit (DTU) plus IRONMAN, Challenge & T100 weltweit – filterbar nach Kontinent, Land und Monat
• „Meine Rennen": leg dein Zielevent fest und der Countdown läuft live runter
• Weltranglisten (WTCS) und deutsche Ligen – live
• Live-Ticker für ausgewählte Events
• Folge Lieblings-Athlet:innen, Serien und Marken
• Komplett zweisprachig (Deutsch/Englisch), hell & dunkel

Kein Account nötig, keine Werbung, kein Tracking.

## Description (EN)
TriZone is your home for triathlon – swim, bike and run in one place.

• News from the top German & international triathlon magazines – smartly sorted by your interests
• Race calendar: every event across Germany (DTU) plus IRONMAN, Challenge & T100 worldwide – filter by continent, country and month
• "My races": set your goal event and watch the countdown tick down live
• World rankings (WTCS) and German leagues – live
• Live ticker for selected events
• Follow your favorite athletes, series and brands
• Fully bilingual (German/English), light & dark

No account required, no ads, no tracking.

---

## Datenschutz-Angaben (Apple Privacy Labels / Google Data Safety)
- **Erhobene Daten an uns:** keine. Kein Konto, kein Tracking, keine Analyse, keine Werbe-IDs.
- **Standort:** „grober Standort", nur **App-Funktionalität** (Events in der Nähe), **nicht** mit Identität verknüpft, **kein** Tracking. Verarbeitung on-device; Wetter via open-meteo.
- **Auf dem Gerät gespeichert (nicht übertragen):** Favoriten, „Meine Rennen", gemerkte Artikel, Einstellungen, Erinnerungen.
- **Data Safety (Google):** „No data collected/shared" + Hinweis auf optionalen Standort für Funktionalität.

## Assets, die du brauchst
- **iOS-Screenshots:** 6,7″ (1290×2796) und 6,5″ – je 3–5 Stück (Start/Hero, Events+Filter, Meine Rennen-Countdown, News „Für dich", Tabellen).
- **Android-Screenshots:** Phone 1080×1920+, mind. 2; **Feature-Grafik 1024×500**.
- App-Icon ist bereits im Projekt (1024er wird aus `icon.png` erzeugt).
- Tipp: Screenshots aus einem echten EAS-Build oder Simulator.

---

## Befehls-Flow (EAS)
```bash
npm i -g eas-cli
eas login                      # dein Expo-Konto
eas build:configure            # eas.json ist bereits vorhanden

# 1) Erst auf echtem Gerät testen (interne Verteilung):
eas build -p ios --profile preview
eas build -p android --profile preview

# 2) Store-Builds:
eas build -p ios --profile production
eas build -p android --profile production

# 3) Hochladen:
eas submit -p ios              # → App Store Connect / TestFlight
eas submit -p android          # → Play Console (interner Test → Produktion)
```

## Pre-Submission-Checkliste
- [ ] Apple Developer Program aktiv (99 $/J) · Google Play Developer (25 $ einmalig)
- [ ] Datenschutz-URL live + in beiden Konsolen eingetragen
- [ ] App-Records angelegt (Name, Bundle ID `com.trizone.app` / Package)
- [ ] Screenshots + (Android) Feature-Grafik hochgeladen
- [ ] Privacy Labels / Data Safety ausgefüllt (siehe oben)
- [ ] Auf echtem Gerät getestet (preview-Build / TestFlight): News lädt, Standort-Abfrage, „Ich starte hier"→Countdown, Live-Ticker, Sprache DE/EN
- [ ] `production`-Builds erstellt & via `eas submit` hochgeladen
- [ ] Zur Prüfung eingereicht (Apple ~1–3 Tage, Google Stunden–Tage)

## Hinweise
- **Kein Backend nötig** für die Store-Apps: native holt Feeds direkt; WT-API/raceresult/open-meteo senden CORS `*`. Die `+api.ts`-Routen sind nur für eine optionale Web-Version (dann EAS Hosting).
- **Kein Remote-Push** in v1 (Erinnerungen sind lokal) → keine APNs/FCM-Einrichtung nötig.
- Erste echte Geräte-Prüfung am besten über TestFlight (iOS) bzw. internen Test-Track (Android).
