# Firebase runtime and hosting contract

## Production architecture

- The React website is a static Vite build published to the existing Firebase Hosting site, `barangay-survey-1cc7d.web.app`.
- The resident Expo app and website use the existing `barangay-survey-1cc7d` Firebase Authentication and `(default)` Firestore project.
- Trusted operations run in the JavaScript Worker at `api/firebase-js/worker.mjs`, deployed to Cloudflare Workers Free on `workers.dev`. The Worker uses Firebase Auth and Firestore REST APIs with server-only secrets. It does not use MySQL, PHP execution, Firebase Cloud Functions, Cloud Storage or client Admin credentials.
- PHP Firebase handlers and their original helpers remain reference sources for behavior and local parity checks. The deployed React build excludes `.php` files; `.php` endpoint suffixes accepted by the Worker are URL compatibility aliases and execute JavaScript.

## Routes and client configuration

The Worker accepts seven logical routes, plus their existing `.php` aliases:

| Logical route | Existing client endpoint | Coverage |
| --- | --- | --- |
| `auth` | `index.php?action=…` | Identifier resolution, profile header, login/logout audit and password change |
| `resident-read` | `resident-read.php` | Resident history, response and submission metadata |
| `survey-schema` | `survey-schema.php` | Trusted required-question preparation |
| `resident-profile` | `resident-profile.php` | Resident profile, contact, photo and protected correction requests |
| `accounts` | `accounts.php` | Resident/staff accounts, registration, lifecycle, approvals, archives and residency |
| `staff-reports` | `staff-reports.php` | Dashboard, stat details, trends, results, reports and CSV |
| `staff-surveys` | `staff-surveys.php` | Survey and question management, including bounded transactional cascades |

Website services use `frontend/src/api/firebaseBackend.js`; native mobile services use `mobile/src/services/transport.js`.

- Website build/deploy uses `VITE_FIREBASE_API_BASE_URL=https://<worker-name>.<account-subdomain>.workers.dev` in ignored `frontend/.env.local`, with the existing Firebase public web config.
- Expo production config uses the same HTTPS Worker origin in ignored `mobile/.env.local` as `EXPO_PUBLIC_API_BASE_URL`, with the same Firebase public config and `EXPO_PUBLIC_USE_EMULATORS=false`.
- The Worker CORS allowlist is pinned in `api/firebase-js/wrangler.jsonc` to the existing Firebase Hosting origins. Native requests use the same Worker URL.

## Server secrets

Configure these as Cloudflare Worker secrets before deployment: `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_WEB_API_KEY`, and `OPERATION_SECRET` (at least 32 characters). The service-account JSON file remains outside the repository; never print it, copy it into the project, or put it in a `VITE_`/`EXPO_PUBLIC_` variable. `BSS_USE_EMULATORS` remains false in the deployed Worker. The Worker pins the Firebase project ID in its configuration and validates the service-account project before requesting OAuth tokens.

## Verification and operational limits

The JavaScript backend source is `api/firebase-js/`. `npm --prefix api/firebase-js run typecheck` checks all ESM files, and `npm --prefix api/firebase-js run test:emulator` exercises the local Worker against Auth/Firestore emulators. Start the Firebase emulators before `npm --prefix api/firebase-js run dev`; do not run the stateful API suite while another emulator suite is using the same ports.

The current local verification covers CORS allow/deny, public registration and identifier login, protected route refusal, resident profile/contact/history, required-question preparation, staff reports/survey creation, and login/logout audit writes. The test cleans its synthetic Auth/Firestore fixtures and restores the emulator resident-number counter. It does not write to production.

Cloudflare's current Workers Free limits include 100,000 requests/day, 10 ms CPU time per request and 50 external subrequests per request. Network wait does not count as CPU time, but per-document serialization, large report processing and large cascades can still exceed the free execution limits. Monitor deployed traces and test high-volume cases before relying on unusually large operations. [Official Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

Deploy the Worker first, configure the site/mobile API origin, then deploy only Firebase Hosting with `firebase deploy --only hosting`. `firebase.json` runs the HTTPS Worker-origin check and the Hosting build, and excludes PHP wrappers from the public upload. Do not redeploy Firestore rules/indexes or re-import data as part of a website release; the approved live cutover is recorded in `docs/live-migration-verification.md`.

Production deployment still requires an authenticated Cloudflare CLI session and the three Worker secrets. A Hosting release must not be published without a reachable deployed Worker URL. After deployment, verify the static site and public, read-only API metadata endpoints; do not create synthetic production records as a smoke test.
