# Project memory

## Project and local environment

- Project: Barangay Health Center Survey System.
- Goal: migrate the existing PHP/HTML/CSS application to React while preserving its appearance and functionality.
- Project folder name: `barangay_survey_system`.
- Project root: `/Applications/XAMPP/xamppfiles/htdocs/barangay_survey_system`.
- Configured PHP site URL: `http://localhost/barangay_survey_system/`.
- URL verification on 2026-11-04: XAMPP Apache configuration specifies `ServerName localhost`, `Listen 80`, and `DocumentRoot "/Applications/XAMPP/xamppfiles/htdocs"`. An HTTP request could not connect to localhost port 80, so live serving is not yet verified. Recheck when XAMPP Apache is available.

## Rules for the whole project

1. Before changing anything, read the existing PHP file(s) the task refers to. Do not guess behaviour from filenames.
2. The original PHP pages are the source of truth for UI and behaviour. Do not redesign, rename labels, reword messages or change flows.
3. Never edit, move or delete the existing PHP pages, `config/`, `includes/`, `assets/`, `uploads/` or `database/` files. Only add new files in `/frontend`, `/api` and `/docs` (paths relative to this project root). The one exception is an `/api` bootstrap that includes `config/db.php` and `config/functions.php`; if a change to an existing file is ever unavoidable, stop and ask the user first. The user explicitly authorized creating this root `AGENTS.md` for initial project memory.
4. Reuse `assets/css/style.css`, the logo and the icon set as-is (see `includes/icons.php` for the SVG icon names).
5. Stack: React 18 + Vite + React Router + Chart.js 4.4.4 (`react-chartjs-2`). Plain CSS, no UI framework. Function components and hooks only.
6. Keep the MySQL schema and `config/functions.php` logic. Business rules stay on the server. Use the existing XAMPP MySQL database; do not recreate or reset it.
7. Break every screen into small reusable components. No component over approximately 200 lines. No duplicated markup.
8. Never print or commit secrets. Do not touch the DB credentials in `config/db.php`.
9. After each task: run the build and lint, fix errors, update `docs/progress.md`, and give the user a short summary of files created or changed and how the result was verified. If a build or lint toolchain does not exist yet, record that limitation; do not scaffold extra files outside the authorized task.

## Progress tracking and current scope

- Read `docs/progress.md` at the beginning of each task and update its log table at the end of every task with the prompt number, what was done, and open issues.
- Initial setup authorizes creating only `AGENTS.md` and `docs/progress.md` (and the containing `docs/` directory). Do not create or delete anything else until Prompt 1.
- Initial setup is Prompt 0. Wait for Prompt 1 before starting migration work.

## Phase 2: Firebase

Phase 1 (the React web app in `/frontend` and PHP/MySQL API in `/api`) is finished. Phase 2 migrates the web app from MySQL to Firebase and builds a mobile app on the same Firebase project. Keep the existing rules above; the rules below govern Phase 2.

1. Both the web app and the mobile app use the same Firebase project (Authentication + Firestore). Never create a second project.
2. Keep the same appearance and behaviour as the current React app. Do not redesign.
3. The Firebase service account key lives OUTSIDE the project folder. Never read, print, copy or commit it. Never put it in any file in the project. Firebase web config values go in `.env` files that are listed in `.gitignore`, with a committed `.env.example`.
4. Free Spark plan only: no Cloud Functions, no paid services. Do not use Firebase Storage unless the user confirms it is available; otherwise store small compressed images in Firestore.
5. All data access goes through one service layer per app (`src/services/`), not directly inside components.
6. Test with the Firebase Emulator Suite before touching the real project. Never run destructive operations against real data without asking the user.
7. Every task ends by running lint and build (and emulator tests when they exist), and updating `docs/progress.md`.

Phase 2 setup is documentation only. Wait for Phase 2 Prompt 1 before changing application code or starting the Firebase migration/mobile implementation.
