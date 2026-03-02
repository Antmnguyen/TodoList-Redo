# Web Export Feasibility — Vercel / iOS Browser

**Date:** 2026-03-01
**Scope:** Can this app be exported as a web app, deployed to Vercel, and used on iOS?

---

## Verdict

> **FEASIBLE — but not without meaningful work.**
> The idea is technically sound. The app's UI, navigation, theme system,
> and business logic are all web-compatible. One thing blocks it:
> the entire data layer uses `expo-sqlite`, which has **no web support**.
> Until that is replaced, the app cannot run in a browser at all.

---

## What "iOS via Vercel" Actually Means

There is no way to publish a React Native app on the iOS App Store via Vercel — that still requires Xcode + Apple Developer Program. What this path delivers instead is a **Progressive Web App (PWA)**: a website the user opens in Safari on iPhone, optionally adds to their home screen, and uses like an app. No App Store, no review process.

iOS PWA support has improved significantly since iOS 16.4 (2023). Full-screen mode, offline caching, and home screen icons all work. It is a legitimate, production-worthy delivery channel for a productivity app.

---

## What Is Web-Compatible Right Now

| Area | Status | Notes |
|---|---|---|
| All UI components (FlatList, ScrollView, etc.) | ✅ Ready | Standard RN primitives render on web |
| Theme system (tokens, dark mode) | ✅ Ready | Pure TypeScript/React |
| Custom navigation (MainNavigator, TabBar) | ✅ Ready | Plain `useState` — no React Navigation to swap out |
| Stats engine + aggregations | ✅ Ready | Pure JS logic, no native dependencies |
| `react-native-safe-area-context` | ✅ Ready | Has official web support |
| `@expo/vector-icons` | ✅ Ready | Loads as web fonts |
| `expo-status-bar` | ✅ Ready | No-op on web, harmless |
| Permanent task system | ✅ Ready | All logic is JS |
| Category system | ✅ Ready | All logic is JS |

That is roughly **95 of 105 source files** that require zero changes to run on web.

---

## What Blocks It

### Blocker 1 — `expo-sqlite` (Critical)

**Affects: ~30 files — the entire storage layer.**

The app uses `expo-sqlite` v16 with the synchronous API (`openDatabaseSync`, `execSync`, `getAllSync`). This package requires native SQLite bindings. It has no web build target at all — calling it in a browser throws immediately.

Every read and write in the app goes through this layer:
- Tasks, categories, settings, completion log, archive, templates — all SQLite.
- `database.ts` is the single point of entry; all 6 active schema modules and all storage services depend on it.

**What fixes it:**

The most practical replacement for web is **`sql.js`** — a WebAssembly build of SQLite that runs in the browser with an API almost identical to `expo-sqlite`. This means the existing schema and query logic can be kept nearly intact. The main cost is that `sql.js` is asynchronous (returns Promises), so every storage function needs to be converted from sync to async — a real but mechanical change.

Alternatively, **WatermelonDB** supports both React Native (using `expo-sqlite` under the hood) and web (using IndexedDB), but it requires adopting its ORM query style, which is a larger rewrite.

**Estimated effort:** 4–7 days.

---

### Blocker 2 — `@react-native-community/datetimepicker` (Minor)

**Affects: 3 files** — `CreateTaskScreen`, `UsePermanentTaskScreen`, `EditTaskModal`.

The native date picker does not exist on web. These three files already have `Platform.OS === 'ios'` / `Platform.OS === 'android'` branches for the picker; adding a `Platform.OS === 'web'` branch that renders a standard HTML `<input type="date">` (or a library like `react-day-picker`) is a small, isolated change.

**Estimated effort:** 2–4 hours.

---

## What Needs Attention (Not Blocking)

**`Alert.alert()`** is used in 5 files for confirmations and errors. On web it falls back to the browser's built-in `window.alert()` / `window.confirm()`, which works but looks out of place. Replacing with a simple modal component is optional polish, not a blocker.

**URL routing** — the custom `MainNavigator` uses `useState` to track which screen is active. On web, this means the browser back button and deep links do not work as expected. For a home-screen PWA this is mostly fine; for a general web URL users share around, it would feel broken. Adding `react-router-dom` or similar is optional depending on target use case.

**Storage quota on iOS Safari** — IndexedDB (or a sql.js WASM database stored via `localforage`) on iOS Safari is limited to approximately 50 MB per origin before the OS prompts the user to allow more. For a task tracker this is comfortably within budget.

---

## Effort Summary

| Task | Effort |
|---|---|
| Replace `expo-sqlite` with `sql.js` or WatermelonDB | **4–7 days** |
| Replace `DateTimePicker` in 3 files | **2–4 hours** |
| Remove native plugins from `app.json` for web build | **30 min** |
| Set up Expo Web build + Vercel deployment | **1–2 days** |
| Browser/PWA QA + responsive tweaks | **2–3 days** |
| **Total** | **~2 weeks** |

---

## Recommendation

If the goal is to use the app on an iPhone **without going through the App Store**, a Vercel-deployed PWA is the right approach and it is achievable. The app's architecture is genuinely well-suited for it — there is no Redux, no complex native bridge, no camera or Bluetooth. The custom navigation system actually makes a web port easier, not harder.

The one real investment is migrating the storage layer. That work is self-contained (`database.ts` + the 6 active schema files + the 7 storage service files), and doing it properly with an abstraction layer (a `StorageDriver` interface with a native implementation and a web implementation) would also make the codebase cleaner going forward.

**Short answer: do it, but plan for the database migration as a dedicated sprint item.**

---

## Files That Would Change

| File | Change |
|---|---|
| `app/core/services/storage/database.ts` | Replace `expo-sqlite` with `sql.js` / WatermelonDB |
| `app/core/services/storage/schema/*.ts` (6 active) | Adapt schema init to new driver |
| `app/core/services/storage/*.ts` (7 service files) | Convert sync → async, update queries |
| `app/screens/tasks/CreateTaskScreen.tsx` | Add web date input branch |
| `app/screens/tasks/UsePermanentTaskScreen.tsx` | Add web date input branch |
| `app/components/tasks/EditTaskModal.tsx` | Add web date input branch |
| `app.json` | Remove native-only plugins for web target |
| `App.tsx` | Conditional schema init (native vs web) |

## Files That Would Not Change

Everything else — all 34 component files, the theme system, the stats engine, the navigation, all screen layouts, the midnight job logic, the permanent task system, the category system. That is ~90 files untouched.
