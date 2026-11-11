# JavaScript Firebase API

This is the implementation contract for the PHP-free production API selected by the user on 11 November 2026. The original PHP Firebase handlers remain the behavior reference; they are not deployed. The API uses the same existing Firebase project, Firestore schema, Auth accounts, security rules and client payloads. It adds no Firebase project or paid Firebase service.

## Runtime

- Source entry: `api/firebase-js/worker.mjs` (`fetch(request, env)`).
- Deployment: Cloudflare Workers Free with `workers_dev: true` in `wrangler.jsonc`.
- Google services: Firebase Auth and Firestore REST, with a project-pinned Admin service account OAuth token generated in the Worker runtime.
- Client authentication: the app sends its current Firebase ID token; the Worker verifies it with Firebase Auth and checks the user record/role/lifecycle before protected work.
- Request transport: JSON, bounded body size, no cookies, exact configured browser-origin allowlist, known route/action allowlists. PHP-looking route names are compatibility URLs only.
- Local route verification: Wrangler Worker against the existing Auth/Firestore emulators. No Node HTTP adapter is part of this runtime.

## Route ownership

| Route module | Handler | Source parity reference |
| --- | --- | --- |
| `auth.mjs` | `handleAuth` | `api/firebase/index.php` and its included helpers |
| `resident-read.mjs` | `handleResidentRead` | `api/firebase/resident-read.php` |
| `survey-schema.mjs` | `handleSurveySchema` | `api/firebase/survey-schema.php` |
| `resident-profile.mjs` | `handleResidentProfile` | `api/firebase/resident-profile.php`, `profile-policy.php`, `profile-data.php` |
| `accounts*.mjs` | `handleAccounts` | `api/firebase/accounts*.php` |
| `reports.mjs` | `handleReports` | `api/firebase/report-*.php` and `staff-reports.php` |
| `staff.mjs` | `handleStaffSurveys` | `api/firebase/staff-surveys.php` and question helpers |
| `core/*.mjs` | OAuth, REST store, context and shared errors | Existing Firebase bridge/transport and Firestore schema |

The central Worker routes preserve existing request/response envelopes. Client services are in `frontend/src/services/` and `mobile/src/services/`; components do not issue privileged requests directly.

## Environment and secrets

Public project configuration stays in ignored `.env.local` files, using committed `.env.example` templates. Worker secrets are configured only in the Cloudflare environment:

- `FIREBASE_SERVICE_ACCOUNT`: JSON content of the provided external Admin SDK key, never stored in this repository.
- `FIREBASE_WEB_API_KEY`: existing Firebase web API key used for Auth client endpoints.
- `OPERATION_SECRET`: random value of at least 32 characters for public registration continuation proofs.

The deployed Worker must keep `FIREBASE_PROJECT_ID=barangay-survey-1cc7d` and `BSS_USE_EMULATORS=false`. Emulator address variables are local-only. Do not put Admin SDK material in the React or Expo app.

## Local verification already performed

`npm --prefix api/firebase-js run typecheck` passes for all 26 JavaScript modules. The Worker emulator smoke test passes for CORS policy, resident registration/resolution/profile/history/schema, staff report/survey creation and auth audits. It runs only against the local Auth/Firestore emulators and removes its fixtures. Web lint/build and Expo lint also pass. See `docs/progress.md` for the remaining deployment gate and `docs/firebase-runtime-contract.md` for the release sequence.

The test is not a production load test. Cloudflare Workers Free currently allows 50 external subrequests and 10 ms CPU per invocation; very large reports and cascade operations need deployed-limit checks before the system is relied on at unusually high data volume. Do not claim deployment or live API verification until Cloudflare authentication, secrets, Worker deployment and read-only production smoke checks succeed.
