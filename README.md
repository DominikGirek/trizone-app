# TriZone

Eine Mobile-App (iOS + Android) für Triathlon im Stil der Kicker-App: News, Rennkalender,
Ergebnisse und Weltranglisten für Schwimmen, Rad und Laufen – mehrsprachig (Deutsch/Englisch).

Tabs: **Start** (Dashboard) · **Events** (Pro + Lokal in einem Feed) · **Tabellen** (Ranglisten) · **Favoriten** · **Mehr**.

## Features
- **Start-Dashboard**: personalisierte Startseite — „Jetzt live", nächstes Rennen (Countdown), Events in der Nähe, deine Favoriten, Top-News
- **Events**: ein vereinheitlichter Feed aus Pro- (World Triathlon) und Lokal-Events (DTU), Filter Alle/In der Nähe/Pro — kein Pro/Lokal-Split
- **News** aus echten RSS-Feeds, mit Merken (Lesezeichen) & Teilen
- **Rennkalender (Pro)** mit echten World-Triathlon-Daten + live tickendem Countdown
- **Lokal-Events (Breitensport)**: echte Events aus dem **DTU-Veranstaltungskalender** (server-seitig ingestiert, per open-meteo geocodet), Suche + „in der Nähe", Event-Page mit Wetter
- **Nativer Live-Ticker** für raceresult-Events: echte Ergebnisse/Live-Daten (Platz, Zeit, Splits, AK, Verein) direkt in der App gerendert (Adapter über das öffentliche my.raceresult.com-Portal); Nicht-raceresult-Events fallen auf Deep-Link zurück
- **Ligen** (Tabellen-Tab → „Ligen"): echte 1./2. Triathlon-Bundesliga (M/F, Nord/Süd) aus der offiziellen DTU-API (IT4SPORT) — Filter nach Liga, aktuelle Tabelle, Wettkämpfe/Termine
- **Ergebnisse & Weltranglisten** (WTCS echt, PTO Sample; Männer/Frauen)
- **Renn-Detail** mit Live-Wetter (open-meteo), Teilen & „Zum Kalender hinzufügen"
- **Favoriten** für Athlet:innen & Serien (persistiert)
- **Onboarding** beim ersten Start zur Auswahl der Lieblinge
- **Globale Suche** über Athlet:innen & Rennen
- **Light/Dark-Mode**, Sprachumschaltung live, haptisches Feedback, Skeleton-Ladeansichten

## Stack
- **Expo (React Native) + TypeScript**, Expo Router (dateibasierte Navigation + API-Routen)
- **TanStack Query** für Datenabruf & Caching
- **i18next / react-i18next / expo-localization** für DE/EN
- **AsyncStorage** für Favoriten & Einstellungen

## Starten
```bash
npm install
npx expo start          # dann i (iOS), a (Android) oder w (Web)
```

## Struktur
```
src/
├── app/                 # Routen (Expo Router)
│   ├── (tabs)/          # News · Kalender · Ergebnisse · Favoriten · Mehr
│   ├── event/[id].tsx   # Renn-Detail
│   ├── athlete/[id].tsx # Athleten-Profil
│   └── api/news+api.ts  # Server-Route: RSS-Aggregation (Web)
├── components/          # NewsCard, RaceCard, ResultsList, RankingList, …
├── services/            # news (RSS), races, rankings, athletes
├── mocks/               # Beispieldaten (Events, Results, Athletes, Rankings)
├── store/               # settings (Sprache/Theme), favorites
├── i18n/                # Übersetzungen de/en
└── constants/theme.ts   # Farben (Disziplinen, Light/Dark), Spacing, Fonts
```

## Daten
- **News**: echt aus öffentlichen Triathlon-RSS-Feeds.
  - Web → über die same-origin API-Route `/api/news` (server-seitige Aggregation, kein CORS).
  - Nativ → direkter Fetch der Feeds (auf iOS/Android gibt es kein CORS).
- **Ergebnisse, Ranglisten, Rennkalender**: aktuell Beispieldaten (`src/mocks`) hinter
  denselben Service-Interfaces – später austauschbar gegen einen echten Backend-/Scraping-Dienst,
  ohne die UI zu ändern.
