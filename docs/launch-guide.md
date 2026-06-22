# TriZone – Schritt-für-Schritt in die App Stores (für Einsteiger)

Reihenfolge von oben nach unten abarbeiten. ⏱️ = Wartezeit, 💶 = Kosten, ⚠️ = Stolperfalle.
Du brauchst **keinen Mac und kein Xcode** – EAS baut die Apps in der Cloud.

---

## Überblick / realistischer Zeitplan
1. Konten anlegen (Expo, Apple, Google) — **⏱️ 1–3 Tage** wegen Identitätsprüfung → **früh starten!**
2. Datenschutz-Seite online stellen — 30 Min
3. Auf eigenem Handy testen — 1 h
4. Store-Einträge + Texte/Screenshots — 2–3 h
5. Builds bauen & hochladen — 1 h (+ Build-Wartezeit)
6. Einreichen → Review (Apple ⏱️ 1–3 Tage, Google ⏱️ Stunden–Tage)

> ⚠️ **Google-Sonderregel (wichtig!):** Neue *private* Google-Play-Konten müssen vor der Produktiv-Freigabe einen **geschlossenen Test mit 12 Testern über 14 Tage** laufen lassen. Plane diese 2 Wochen ein. (Apple hat das nicht.)

---

## Phase 1 — Konten & Werkzeuge

### 1.1 Expo-Konto (kostenlos)
- Registrieren: https://expo.dev/signup
- Im Terminal (im Projektordner):
  ```bash
  npm install -g eas-cli
  eas login
  ```

### 1.2 Apple Developer Program — 💶 99 €/Jahr
- https://developer.apple.com/programs/enroll/
- Mit deiner Apple-ID (2-Faktor aktiv). Wähle **„Individual / Einzelperson"** (einfachster Weg, keine Firmennummer nötig; als Verkäufer erscheint dein Name).
- ⏱️ Freischaltung dauert oft 24–48 h.

### 1.3 Google Play Developer — 💶 25 $ einmalig
- https://play.google.com/console/signup
- Konto-Typ „Privat", Identität verifizieren (Ausweis). ⏱️ kann 1–2 Tage dauern.

---

## Phase 2 — Datenschutz-Seite online stellen (Pflicht!)
Beide Stores verlangen eine **öffentliche URL** zur Datenschutzerklärung.
- Inhalt liegt fertig in [`docs/privacy-policy.md`](privacy-policy.md) — nur die `[…]`-Platzhalter (Name, E-Mail, Datum) ausfüllen.
- Einfachste kostenlose Hostings: **GitHub Pages**, **Notion** (Seite veröffentlichen) oder **Google Sites**.
- Ergebnis: eine URL wie `https://deinname.github.io/trizone-datenschutz` → notieren.

---

## Phase 3 — Build-Config (schon erledigt ✅)
Bereits im Projekt gesetzt:
- `app.json`: `ios.bundleIdentifier` + `android.package` = `app.trizone.mobile`
- `eas.json`: Profile `preview` (Test) und `production` (Store)

Beim allerersten Build verknüpft EAS das Projekt automatisch (legt eine `projectId` an) — einfach den Anweisungen im Terminal folgen.

---

## Phase 4 — Erst auf dem EIGENEN Handy testen
Niemals ungetestet einreichen.

### Android (am einfachsten)
```bash
eas build --platform android --profile preview
```
→ Am Ende gibt EAS einen Link / QR-Code. Auf dem Android-Handy öffnen → APK installieren → testen.

### iPhone (über TestFlight)
```bash
eas build --platform ios --profile production
eas submit --platform ios --latest
```
→ Landet in **TestFlight** (Apples Test-App). TestFlight-App aufs iPhone laden, dich als Tester einladen, App testen.

**Testen:** Start-Kachel/Countdown, „Ich starte hier", Events + Filter, ein Rennen öffnen (News + Lokalpresse), Standort-Abfrage, Sprache DE/EN, Live-Ticker.

---

## Phase 5 — Store-Einträge anlegen
Texte/Keywords/Angaben liegen fertig in [`docs/store-listing.md`](store-listing.md).

### Apple — App Store Connect (https://appstoreconnect.apple.com)
1. „Meine Apps" → **+** → Neue App.
2. Plattform iOS, Name **TriZone**, Sprache Deutsch, Bundle-ID **app.trizone.mobile**, SKU z. B. `trizone-001`.
3. Datenschutz-URL eintragen, Kategorie **Sport**, Alter **4+**.
4. **App-Datenschutz** (Privacy Labels): „Standort – App-Funktionalität, nicht mit Identität verknüpft, kein Tracking"; sonst nichts.

### Google — Play Console (https://play.google.com/console)
1. **App erstellen**, Name TriZone, Sprache Deutsch, „App", „Kostenlos".
2. **Data safety**: „Keine Daten gesammelt/geteilt" + optional Standort für Funktionalität.
3. **Inhaltseinstufung** (Fragebogen → Alle ausführen), Datenschutz-URL, Kategorie Sport.

---

## Phase 6 — Store-Builds erstellen & hochladen
```bash
# iOS (EAS legt Zertifikate automatisch an – einfach Apple-Login bestätigen)
eas build --platform ios --profile production
eas submit --platform ios --latest

# Android (EAS verwaltet den Keystore automatisch)
eas build --platform android --profile production
eas submit --platform android --latest
```
⚠️ Beim ersten `eas submit --platform android` ist ein Google-Service-Account nötig — falls das zu fummelig ist: die fertige `.aab` einfach **manuell** in der Play Console hochladen (Interner Test → Release).

---

## Phase 7 — Screenshots
Stores brauchen echte Screenshots (Größen in `store-listing.md`).
- Am einfachsten: App auf dem eigenen Handy (aus Phase 4) → Screenshots der schönsten Screens (Start/Countdown, Events+Filter, Meine Rennen, News „Für dich", Tabellen).
- iPhone-Größen: 6,7″ + 6,5″ · Android: Phone + **Feature-Grafik 1024×500**.

---

## Phase 8 — Einreichen & Review
- **Apple:** Build in App Store Connect der Version zuweisen → „Zur Prüfung einreichen". ⏱️ 1–3 Tage. Bei Ablehnung: Grund lesen, beheben, neu einreichen (normal beim ersten Mal).
- **Google:** Erst **internen/geschlossenen Test** (12 Tester, 14 Tage – siehe Sonderregel) → dann **Produktion** beantragen → Rollout.

---

## Wenn etwas klemmt
- EAS-Fehler/Logs: der Build-Link zeigt vollständige Logs.
- Häufige Apple-Ablehnungsgründe: fehlende Datenschutz-URL, Berechtigungstexte (haben wir gesetzt), „Mindestfunktionalität" (bei uns kein Problem – echte native Features).
- Frag mich jederzeit bei einem konkreten Schritt/Fehler – ich helfe gezielt.
