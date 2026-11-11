# React website

The website uses React 18, Firebase Authentication/Firestore and a trusted JavaScript Firebase API. Production API routes run in Cloudflare Workers Free; the static React build is published through Firebase Hosting. All resident, staff and administrator routes are implemented; original PHP handlers remain behavior references and local parity tools only. MySQL and legacy PHP sessions are absent from the production app runtime. See the [project setup](../README.md), [runtime contract](../docs/firebase-runtime-contract.md), [feature checklist](../docs/parity-checklist-firebase.md) and [executed results](../docs/testing-results.md).

## Install and run locally

From the project root:

```sh
npm --prefix frontend ci
npm --prefix migration ci
npm --prefix frontend run emulators:start
```

In a second terminal:

```sh
npm --prefix frontend run demo:emulators
```

Open http://127.0.0.1:8787/. Node, Java and PHP with curl/mbstring are required; intl supports Unicode aliases. This builds React with explicit emulator values and serves it with only allowlisted Firebase endpoints. It does not need XAMPP, Apache, MySQL, database credentials or legacy PHP sessions. The separate migration dependencies support emulator tests. Fresh emulators do not automatically contain the private migration snapshot.

`npm run build:demo` builds without starting the server. `BSS_RUNTIME_PORT` changes its loopback port. `npm run dev:emulators` provides the separate Vite development setup. The demo build is emulator-only; do not deploy it as production.

## Authentication and features

Residents, staff and administrators share `/login`, with the original branding and **Resident No. / Staff No. / Username** field. Four-digit `R-YYYY-NNNN` and `S-YYYY-NNNN` numbers are normalized to uppercase; other values use the staff username alias. The trusted resolver verifies aliases and credentials before Firebase SDK sign-in. First-password/profile setup, deactivation/archive refusal, session persistence, role destinations and audit records remain enforced by trusted services.

Resident routes include dashboard/stat details, all four question types, immutable survey submission, confirmation, history/response/CSV, contact/photo/password and reviewed identity/address/birthdate/family changes. Staff/admin routes include dashboard/drilldowns/charts/results/reports/CSV, survey/question management, resident/staff account lifecycle, request reviews, archives and residency records. See the feature checklist for per-route evidence and physical-device limitations.

## Verification

```sh
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend run test:survey:unit
```

Run stateful suites serially against the emulators, with no concurrent interactive phone edits. `test:rules` compiles the current rules and restores emulator data. Other commands include `test:runtime:running`, `test:auth:running`, `test:profile:running`, `test:survey:running`, `test:staff-survey:running`, `test:reports:running`, `test:accounts:running`, `test:accounts:lifecycle:running` and `test:locks:running`. Tests preserve original documents/identities and clean synthetic fixtures. Details and actual counts are in the results document.

## Real project

Use ignored `.env.local` values based on `.env.example`. Set `VITE_FIREBASE_API_BASE_URL` to the deployed HTTPS `workers.dev` origin and use the existing Firebase web config. Then run `firebase deploy --only hosting` from the project root; the configured predeploy check builds the production bundle and excludes `.php` wrappers. The Worker requires Cloudflare secrets for the external Admin SDK JSON, Firebase web API key and registration proof secret. Never expose the service account or proof secret through client variables. The real Firestore import/rules/indexes are already deployed; this Hosting release must not redeploy or re-import them. Worker and Hosting publication remain pending the Cloudflare CLI sign-in and secret setup.
