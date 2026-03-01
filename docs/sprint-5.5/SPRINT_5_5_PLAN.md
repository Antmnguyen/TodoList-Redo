# Sprint 5.5 — Web Deployment (iPhone Access via Browser)

**Goal:** Deploy the app as a web app so iPhone users can use it in Safari.
Android users get the native app. iPhone users get a web version with full
core functionality. Geofencing (Sprint 6) and Health Connect (Sprint 7) are
Android native features only — they simply won't appear on the web version.

---

## Context

The app is built with Expo + React Native. Expo has built-in web support
(React Native Web). This means most of the UI already works in a browser
with minimal changes. The main blockers are a few native-only libraries.

Deploy to **Vercel** — simplest pipeline with Expo, free tier is sufficient.
iPhone users open the URL in Safari and optionally add it to their home screen
as a PWA (no App Store required).

---

## Biggest Blocker: expo-sqlite Does Not Work in Browser

The entire storage layer uses `expo-sqlite` which is native-only (no browser).

**Solution — Dual storage adapter:**

Create a thin `StorageAdapter` interface. Swap implementations at runtime based
on `Platform.OS`.

```
app/core/services/storage/
  adapter.ts          ← interface + platform selector
  adapters/
    sqliteAdapter.ts  ← wraps current expo-sqlite (mobile)
    indexedDBAdapter.ts ← browser storage using 'idb' or 'dexie.js'
```

All storage files (`taskStorage`, `permanentTaskStorage`, etc.) import from
`adapter.ts` instead of calling `expo-sqlite` directly. No changes to the
storage query logic — only the DB driver swaps.

```ts
// adapter.ts
import { Platform } from 'react-native';
export const db = Platform.OS === 'web'
  ? new IndexedDBAdapter()
  : new SQLiteAdapter();
```

Data is stored locally in the browser (IndexedDB) — no server/cloud needed.
Each device has its own data. This is the same model as the native app.

---

## Other Compatibility Issues

| Issue | Fix |
|-------|-----|
| `@react-native-community/datetimepicker` — no web support | Wrap in `Platform.OS !== 'web'` guard, show a plain `<input type="date">` on web |
| Geofencing (Sprint 6) | `Platform.OS !== 'web'` guard — feature hidden on web |
| Health Connect (Sprint 7) | `Platform.OS !== 'web'` guard — feature hidden on web |
| `expo-haptics` | Auto no-ops on web, no change needed |
| `SafeAreaView` | Works on web as a plain view |
| Navigation (MainNavigator overlay pattern) | Works on web unchanged |

---

## PWA Setup (Add to iPhone Home Screen)

Add a `public/manifest.json` and meta tags so Safari treats it as a PWA:
- App name, icon, theme colour
- `display: standalone` — hides browser chrome when opened from home screen
- Splash screen

This makes the web version feel like a native app on iPhone — no browser bar,
full screen, app icon on the home screen.

---

## Deployment Pipeline (Vercel)

1. `npx expo export --platform web` → generates `dist/` folder
2. Connect GitHub repo to Vercel
3. Build command: `npx expo export --platform web`
4. Output directory: `dist`
5. Every push to `main` auto-deploys

---

## Task List

- [ ] Run `npx expo export --platform web` — document all errors
- [ ] Build `StorageAdapter` interface + `IndexedDBAdapter` (using `dexie.js`)
- [ ] Refactor all storage files to use `db` from `adapter.ts` not expo-sqlite directly
- [ ] Fix `datetimepicker` — web fallback to native `<input type="date">`
- [ ] Add `Platform.OS !== 'web'` guards for geofencing + Health Connect entry points in BrowseScreen
- [ ] Test all screens in browser (`npx expo start --web`)
- [ ] Add PWA manifest + icons
- [ ] Set up Vercel project, connect GitHub
- [ ] Test on iPhone Safari — verify "Add to Home Screen" works

---

## What the Web Version Does NOT Have

| Feature | Reason |
|---------|--------|
| Geofencing auto-complete | Android/iOS native APIs only |
| Health Connect sync | Android only |
| Push notifications | Out of scope |
| Cross-device data sync | Data is local (IndexedDB) per browser |

These are not bugs — they are Android native features. The web version covers
all core task tracking, stats, browse, and permanent task management.
