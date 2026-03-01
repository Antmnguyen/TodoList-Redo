# ProductivityTracker

ProductivityTracker is a local-first task management application built with **React Native (Expo)** and **SQLite**. It is designed to manage recurring workflows through reusable task templates and provide visual feedback on completion trends.

---

## Deployment (Android)
The app is available as a production-ready APK for Android devices.

| Scan to Download | Installation |
| :--- | :--- |
| ![QR Code](https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=INSERT_YOUR_GITHUB_RELEASE_URL_HERE) | 1. Scan the QR code.<br>2. Download the `.apk` file.<br>3. Install the file (Enable "Unknown Sources" if prompted). |

---

## Functional Overview

### 1. Permanent Tasks
The system centers on **Permanent Tasks**—reusable templates that eliminate the need to manually recreate standard routines.
* **Template-to-Task Generation:** You define a task once as a Daily, Weekly, or Monthly template. The app automatically creates a new active task from that template at the start of each new period.
* **Automated Status Updates:** When a new day begins, any tasks from the previous day that weren't checked off are moved to a "failed" status. This ensures the schedule stays current without manual cleanup.
* **Data Migration:** Completed tasks are periodically moved from the active table into a dedicated archive. This keeps the primary list uncluttered and ensures the app remains responsive over long-term use.

### 2. Productivity Tracking & Stats
The app uses a relational SQLite database to turn task history into visual metrics.
* **Immutable Completion Logs:** Every time a task is completed or failed, it is recorded in a permanent log. This serves as the source of truth for all historical data.
* **Data Visualization:** The app pulls from the log to generate calendar heatmaps and bar charts, showing exactly when tasks were finished and where gaps in consistency occur.
* **Visual Identification:** Task cards use a dual-strip indicator system—color-coded by category and recurrence frequency—so you can distinguish between different types of work at a glance.

---

## Technical Stack
* **Framework:** React Native / Expo (SDK 50+)
* **Language:** TypeScript
* **Database:** SQLite (`expo-sqlite`)
* **Navigation:** React Navigation (Tabs & Native Stack)

---

## Project Status

| Feature | Status |
| :--- | :--- |
| **Permanent Task Engine** | Completed |
| **SQLite Archival System** | Completed |
| **Productivity Visualization** | Completed |
| **Location Geofencing** | In Progress |
| **External Integrations** | Planned |

---

## Directory Structure
* `app/core/domain/taskActions.ts` — Logic for task instantiation and state transitions.
* `app/core/services/storage/` — SQLite configuration and data migration logic.
* `app/screens/stats/` — Components for rendering charts and heatmaps.
* `app/theme/` — Theme providers and Dark Mode styling.

---
*Snapshot generated 2026-03-01 · Sprint 5 Deployment*
