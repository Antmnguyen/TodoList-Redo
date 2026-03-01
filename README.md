# ProductivityTracker 🚀

A high-performance, local-first task management application built with **React Native (Expo)** and **SQLite**. This app is designed for users who need a robust, offline-capable tool for managing recurring workflows and visualizing deep productivity insights.

---

## 📲 Try the App (Android)
Experience the app directly on your physical device. Scan the QR code below to download the production-ready APK.

| Scan to Download | Installation Steps |
| :--- | :--- |
| ![QR Code](https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=INSERT_YOUR_GITHUB_RELEASE_URL_HERE) | 1. Scan with your Android camera.<br>2. Download the `.apk` file.<br>3. Tap **Install** (Allow "Unknown Sources" if prompted). |

---

## 🛠️ Key Engineering Features

### 1. Intelligent Automation (The Midnight Job)
The app features a sophisticated background maintenance pipeline that triggers on the first cold start of each calendar day.
* **Auto-Scheduling:** Dynamically generates the next instance of recurring templates (Daily, Weekly, or Monthly) based on completion triggers.
* **Auto-Fail Logic:** Incomplete tasks are automatically logged as "failed" in the stats engine at midnight to maintain data integrity.
* **Automated Archival:** Offloads completed data from the active `tasks` table to a `task_archive` table to ensure the UI remains performant regardless of database size.

### 2. Relational Persistence (SQLite)
Built on a full **SQLite** relational database via `expo-sqlite` rather than standard key-value storage.
* **Data Integrity:** Implements foreign key relationships between Tasks, Templates, and Categories.
* **Performance:** Synchronous data access for zero-lag transitions and full offline persistence.
* **Append-Only Logging:** Uses a `completion_log` as the immutable source of truth for all productivity analytics.

### 3. Data Visualization & Visual Identity
A custom-built analytics engine provides deep insights into user habits:
* **Visual Signals:** Every task card uses a dual-strip system ($5\text{px}$ for category color, $4\text{px}$ for recurring type) for instant recognition.
* **Productivity Heatmaps:** Visualizes completion trends via calendar grids and bar graphs.
* **Theme Engine:** Full manual and system-level Dark Mode support using a custom `ThemeContext`.

---

## 🏗️ Technical Stack
* **Framework:** React Native / Expo (SDK 50+)
* **Language:** TypeScript
* **Database:** SQLite (`expo-sqlite`)
* **Navigation:** React Navigation (Tabs & Native Stack)

---

## 🗺️ Project Roadmap

| Feature | Status |
| :--- | :--- |
| **Recurring Task Engine** | ✅ Shipped |
| **SQLite Schema & Archival** | ✅ Shipped |
| **Productivity Stats & Graphs** | ✅ Shipped |
| **Location Geofencing** | 🏗️ In Progress |
| **Google Calendar Sync** | 📅 Planned |
| **Health Connect Integration** | 📅 Planned |
| **Cross-Device Transfer** | 📅 Planned |

---

## 📂 Project Structure
* `app/core/domain/taskActions.ts` — Core business logic and Midnight Job pipeline.
* `app/core/services/storage/` — SQLite schema definitions and archival services.
* `app/screens/stats/` — Custom data visualization and graphing components.
* `app/theme/` — Design tokens and Dark Mode implementation.

---
*Snapshot generated 2026-03-01 · Sprint 5 Deployment*