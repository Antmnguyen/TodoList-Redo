# ProductivityTracker

<img src="./assets/hero.png" width="600">

ProductivityTracker is a local-first task management application built with **React Native (Expo)** and **SQLite**. It is designed to manage recurring workflows through reusable task templates and provide visual feedback on completion trends.

---

## Deployment (Android)
The app is available as a production-ready APK for Android devices.

| Scan to Download | Installation |
| :--- | :--- |
| ![QR Code](https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://github.com/Antmnguyen/TodoList-Redo/releases/latest/download/Productivity_Tracker1.1.0.apk) | 1. Scan with your Android camera.<br>2. Download the `.apk` file.<br>3. Tap **Install** (Allow "Unknown Sources" if prompted). |

---
### Direct Download
If you are viewing this on your mobile device, you can download the application directly using the link below:
[**Download ProductivityTracker APK**](https://github.com/Antmnguyen/TodoList-Redo/releases/latest/download/Productivity_Tracker1.1.0.apk)

## Functional Overview

### 1. Permanent Tasks
![Tasks and Automation Screenshot](./assets/tasks.png)
The system centers on **Permanent Tasks**—reusable templates that eliminate the need to manually recreate standard routines.
* **Template-to-Task Generation:** You define a task once as a Daily, Weekly, or Monthly template. The app automatically creates a new active task from that template at the start of each new period.
* **Automated Status Updates:** When a new day begins, any tasks from the previous day that weren't checked off are moved to a "failed" status. This ensures the schedule stays current without manual cleanup.
* **Data Migration:** Completed tasks are periodically moved from the active table into a dedicated archive. This keeps the primary list uncluttered and ensures the app remains responsive over long-term use.

### 2. Productivity Tracking & Stats
![Data Visualization and Charts Screenshot](./assets/stats.png)
The app uses a relational SQLite database to turn task history into visual metrics.
* **Immutable Completion Logs:** Every time a task is completed or failed, it is recorded in a permanent log. This serves as the source of truth for all historical data.
* **Data Visualization:** The app pulls from the log to generate calendar heatmaps and bar charts, showing exactly when tasks were finished and where gaps in consistency occur.
* **Visual Identification:** Task cards use a dual-strip indicator system—color-coded by category and recurrence frequency—so you can distinguish between different types of work at a glance.

### 3. Health Connect Integration (v1.1.0)
![Health Connect Integration Screenshot](./assets/health.png)
Seamlessly bridge the gap between physical health and productivity by mapping biometric data to automated task completion.
* **Biometric Syncing:** Reads Steps, Sleep, and Workouts directly from Android's Health Connect API.
* **Threshold Mappings:** Automatically complete tasks (e.g., "Walk 10k steps") when Health Connect data hits a user-defined threshold.
* **Health connect Data:** Easily view your past step sleep and workout data in the health connect section in browse.

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
| **Health Connect Integration** | Completed (v1.1.0) |
| **Location Geofencing** | In Progress |
| **Google Calendar Sync** | Planned |

---

## Directory Structure
* `app/core/domain/taskActions.ts` — Logic for task instantiation and state transitions.
* `app/core/services/storage/` — SQLite configuration and data migration logic.
* `app/screens/stats/` — Components for rendering charts and heatmaps.
* `app/theme/` — Theme providers and Dark Mode styling.

---
