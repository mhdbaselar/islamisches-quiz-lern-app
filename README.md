# Islamisches Quiz – Lern-App

Eine interaktive Single-Page-Anwendung für Moscheen, Lernkreise und Unterrichtsgruppen. Besucher:innen können islamisches Basiswissen spielerisch trainieren, Lernfortschritte speichern und Statistiken auswerten – vollständig clientseitig, mobilfreundlich und mehrsprachig.

## Highlights

- **Zwei Modi:** "Spielen" (Quizlauf mit Ergebnisauswertung) und "Lernen" (Antwortprüfung Schritt für Schritt).
- **Mehrsprachig:** Deutsch, Englisch und Arabisch (inkl. RTL-Unterstützung und persistenter Sprachauswahl).
- **Fragenmanagement:** Kategorien, Stapel und Fragen direkt im Browser anlegen, bearbeiten oder löschen.
- **Admin-Modus:** PIN-geschützter Zugriff auf das Fragenmanagement, inklusive konfigurierbarer Admin-PIN in den Einstellungen.
- **Auswertungen:** Gestapelte Balken, Linien- und Gauge-Charts mit Filtermöglichkeiten, erstellt mit Vue-ECharts/ECharts.
- **Fortschritt speichern:** Quizläufe, Einstellungen, Thema (Hell/Dunkel) und angefangene Sessions werden automatisch im `localStorage` abgelegt.
- **Themes & Accessibility:** Standardmäßig helles Layout, Umschaltung auf Dark Mode möglich, responsive Gestaltung für Smartphone bis Desktop.

## Technologiestack

- [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- [Vite](https://vite.dev/) als Dev-Server & Bundler
- [Pinia](https://pinia.vuejs.org/) für globalen Zustand
- [Vue Router](https://router.vuejs.org/) für Routing (SPA)
- [Vue I18n](https://vue-i18n.intlify.dev/) für Lokalisierung
- [@vueuse/core](https://vueuse.org/) (u. a. Theme-Handling)
- [ECharts / Vue-ECharts](https://echarts.apache.org/) für Diagramme
- Zusätzlich: `vite-plugin-pwa`, `@types/*` für TS, ESLint-Konfiguration, Vitest für Unit-Tests

## 🚀 Schnellstart

### Voraussetzungen

- Node.js ≥ 18 (empfohlen 20)
- Yarn (Classic 1.x) installiert

### Installation

```sh
yarn install
```

### Entwicklung

```sh
yarn dev
```

Der Befehl startet Vite im Hot-Reload-Modus unter `http://localhost:5173`.

### Qualitätssicherung

```sh
yarn type-check
yarn lint
yarn test:unit
```

### Produktionsbuild & Vorschau

```sh
yarn build
yarn preview
```

Der Build erzeugt ein minimiertes Bundle in `dist/`, `yarn preview` dient als lokaler Test-Server.

## Navigationsstruktur

| Route             | Ansicht                | Kurzbeschreibung                                                    |
| ----------------- | ---------------------- | ------------------------------------------------------------------- |
| `/`               | `HomeView.vue`         | Einstieg, App-Überblick                                             |
| `/quiz`           | `QuizHomeView.vue`     | Kategorien & Quiz-Modi auswählen                                    |
| `/quiz/spielen`   | `QuizPracticeView.vue` | Spielen- / Lernmodus inkl. Sitzungsfortsetzung                      |
| `/quiz/verwalten` | `QuizManageView.vue`   | Fragenverwaltung (CRUD) · Admin-Zugriff (PIN, Standard: 1234) nötig |
| `/quiz/statistik` | `QuizStatsView.vue`    | Diagramme und Auswertungen                                          |
| `/einstellungen`  | `SettingsView.vue`     | Sprache, Theme, Admin-Modus                                         |
| `/gebetszeiten`   | `GebetszeitenView.vue` | Aktuelle Gebetszeiten                                               |
| `/quran`          | `QuranView.vue`        | Quran-Ansicht (Lesemodus)                                           |
| `/about`          | `AboutView.vue`        | Projektinformationen                                                |

## Projektstruktur

```
src/
 ├─ assets/            Globale Styles, Logos, Favicons
 ├─ components/        Wiederverwendbare UI & Quiz-Komponenten
 ├─ i18n/              Vue-I18n Setup & Sprachdateien (de/en/ar)
 ├─ quiz/              Seed-Daten, Flow- & Scoring-Logik
 ├─ stores/            Pinia Stores (Theme, Locale)
 ├─ views/             Seitenansichten für das Routing
 ├─ router/            Vue-Router-Konfiguration
 ├─ services/          Hilfsfunktionen (z. B. Gebetszeiten)
 └─ plugins/           Lazy-loaded Plugins (ECharts)
```

Wichtige Komponenten:

- `StackModeSelector.vue` – Auswahl von Stapel & Modus
- `QuizChoiceList.vue` – Mehrfachauswahl mit Zustand für Spiel/Lernen
- `QuizStatsView.vue` – Diagramme & Filter (ECharts)
- `GlobalNavigation.vue`, `BaseModal.vue`, `PageHeading.vue`, u. v. m.

## Daten & Persistenz

| Key                   | Inhalt                                              |
| --------------------- | --------------------------------------------------- |
| `app.quiz.v2`         | Kategorien, Stapel, Fragen, Ergebnisse              |
| `app.quiz.session.v1` | Fortlaufende Quiz-Session (Frage, Antworten, Modus) |
| `app.locale`          | Ausgewählte Sprache                                 |
| `theme`               | Hell- oder Dunkelmodus                              |

Das Quiz nutzt zusätzlich zufällig generierte IDs bei neuen Fragen/Stacks und speichert Backups als JSON.

## Internationalisierung

- Standard-Sprache Deutsch, Umschaltbar auf Englisch/Arabisch
- RTL-Unterstützung für arabische Inhalte
- Übersetzungen zentral in `src/locales/` verwaltet

## UX & Animationen

- Sanfte Fade/Slide-Transitions für Seiten & Modals
- Responsive Layouts, optimiert für 320 px bis Desktop
- Quiz-Feedback mit Farbstatus (richtig/falsch)
- ECharts-Animationen (Gauge-Füllung, Tooltip-Transitions)

## Weiterentwicklung

- Zusätzliche Kategorien/Fragen oder Import per CSV/JSON
- Multiplayer- oder Wettbewerbsmode
- Serverseitige Synchronisation (API) oder Authentifizierung
- Offline-Optimierung als PWA (Service Worker ist vorbereitet)
