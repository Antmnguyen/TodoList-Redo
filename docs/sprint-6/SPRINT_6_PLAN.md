# Sprint 6 — Geofencing Auto-Complete

**Goal:** Automatically complete (or prompt to complete) a permanent task instance
when the user arrives at or leaves the location associated with that template.

**Platform:** Android + iOS native only. Not available on web.

---

## How It Works (User Perspective)

1. User creates a permanent task template with a location set (e.g. "Gym Session" → "Gym")
2. User stamps out an instance for today
3. User physically arrives at the gym
4. App detects the arrival and either:
   - **Auto-completes** the task silently, or
   - **Shows a notification**: "You arrived at Gym — mark Gym Session as done?"

---

## Key Technical Decisions

| Question | Options |
|----------|---------|
| Trigger | Arrive (enter geofence), leave (exit geofence), or both |
| Action on trigger | Auto-complete silently vs. push notification prompt |
| Location storage | Currently `location` is a plain text string ("Gym") — needs lat/lng coordinates added |
| Library | `expo-location` + `expo-task-manager` for background geofencing |
| Background mode | Required — geofence must fire when app is closed |

---

## Biggest Design Issue: Location Is Currently a Text String

Templates store `location` as a plain string (e.g. `"Home"`, `"Gym"`). Geofencing
requires real coordinates (lat/lng + radius). The location model needs to be extended.

**Current:** `location: string` on `PermanentTask`
**Needed:** `location: { name: string, lat: number, lng: number, radius: number }`

### Schema change required

```sql
-- Add coordinate columns to templates table
ALTER TABLE templates ADD COLUMN location_lat  REAL;
ALTER TABLE templates ADD COLUMN location_lng  REAL;
ALTER TABLE templates ADD COLUMN location_radius INTEGER DEFAULT 100; -- metres
```

Migration: existing templates keep their text name, coordinates start as NULL (geofencing
disabled for them until user re-sets the location with coordinates via a map picker).

---

## New Components Needed

| Component | Purpose |
|-----------|---------|
| `LocationPickerScreen` | Map view (Google Maps or Apple Maps) — user taps to drop a pin, sets radius |
| `GeofenceService` | Background task that registers geofences and handles enter/exit events |
| `GeofenceStorage` | Stores active geofences (templateId → coordinates) |
| Notification on arrival | `expo-notifications` — "You're at Gym — complete Gym Session?" |

---

## Libraries

| Library | Purpose |
|---------|---------|
| `expo-location` | Request location permission, get current coords |
| `expo-task-manager` | Register background geofence task |
| `react-native-maps` | Map view for the location picker |
| `expo-notifications` | Show arrival notification |

All are available in Expo managed workflow.

---

## Permissions Required

- `ACCESS_FINE_LOCATION` (Android) — foreground location
- `ACCESS_BACKGROUND_LOCATION` (Android 10+) — required for geofence to fire when app is closed
- `POST_NOTIFICATIONS` (Android 13+) — for arrival notification

These must be declared in `app.json` and requested at runtime before registering any geofence.

---

## Data Flow

```
User opens CreatePermanentTaskScreen / EditPermanentTaskScreen
    → taps "Set Location on Map"
    → LocationPickerScreen opens
    → user drops pin, adjusts radius slider
    → coordinates saved to templates table (lat, lng, radius)

Background (app closed or in background):
    GeofenceService (expo-task-manager BACKGROUND task)
        → monitors registered geofences
        → on ENTER event for geofenceId = templateId:
            → find pending instance for today
            → if found: auto-complete OR fire notification
            → logCompletion() written to completion_log
```

---

## Task List

- [ ] Research `expo-location` geofencing API limits (max geofences per app on Android/iOS)
- [ ] Extend `PermanentTask` type — add `lat`, `lng`, `radius` fields
- [ ] DB migration — add coordinate columns to `templates` table
- [ ] Build `LocationPickerScreen` with map + pin + radius slider
- [ ] Wire location picker into `CreatePermanentTaskScreen` and `EditPermanentTaskScreen`
- [ ] Build `GeofenceService` — register/unregister geofences for templates that have coordinates
- [ ] Handle ENTER event — find today's pending instance → complete or notify
- [ ] Handle app startup — re-register all geofences (they clear on reboot)
- [ ] Add permission request flow (foreground → background location)
- [ ] Add geofence on/off toggle per template (user opt-in)
- [ ] Test on physical Android device (geofencing does not work in emulator)

---

## Known Limitations

- iOS limits to 20 simultaneous geofences per app — need eviction strategy if user has many templates with locations
- Android requires background location permission — users may deny it; handle gracefully
- Geofences are cleared on device reboot — must re-register on app open
- Accuracy depends on GPS/WiFi/cell signal — indoor accuracy may be poor
