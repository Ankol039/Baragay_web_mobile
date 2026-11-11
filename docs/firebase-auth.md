# Firebase web authentication — Phase 2 Prompt 4

The shared login form now authenticates with the Firebase Web SDK. `useAuth` retains `user`, `passwordRules`, `loading`, `error`, `refresh`, `login`, `logout` and `changePassword`, including the existing result envelope and snake_case user fields. Login, Change Password and LogoutLink retain their markup, labels, error handling and destinations. The account chip additionally accepts the Firestore JPEG data URI.

## Local development

From `frontend`, with the existing Auth/Firestore emulators running:

```sh
npm ci
npm run dev:emulators
```

Open [the local login](http://127.0.0.1:5173/barangay_survey_system/app/login). This command starts Vite on 5173 and a standalone PHP bridge on 8787, both on loopback. It supplies emulator-only web configuration in the child processes; it creates no environment file. `PHP_BINARY` may select a PHP binary. PHP requires curl, mbstring and JSON; intl is needed for non-ASCII username normalization. The installed Homebrew PHP includes intl; XAMPP PHP supports ASCII identifiers without it. Ports must be free. Start the suite separately with `npm run emulators:start` if needed.

Alternatively copy `frontend/.env.example` to ignored `.env.local`, fill the existing project's public web config, and use `VITE_USE_EMULATORS=true`. The bridge must also run in explicitly configured emulator mode; setting a browser flag never changes server trust. The helper command supplies `BSS_USE_EMULATORS=true`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` and `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`. No service account file is used.

Tests create their own synthetic accounts. To use migrated accounts interactively, follow the separately authorized emulator migration workflow in `migration/README.md`; this auth task does not import MySQL data or retain demo accounts. The earlier migration rehearsal's emulator-only identifier passwords are distinct from production BCRYPT verification.

## Authentication and server authority

`src/services/firebase.js` lazily initializes the one Firebase app from `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` and `VITE_FIREBASE_APP_ID`. It connects Auth and Firestore to the configured emulators before their first operation when `VITE_USE_EMULATORS` is exactly `true`. Missing configuration becomes a recoverable auth status error instead of crashing module loading.

`authService.js`, `authProfile.js` and `authBridge.js` contain all Firebase/auth data access. The AuthProvider subscribes to Firebase auth and the signed-in user's lifecycle document, revalidates on navigation/focus, and rejects stale reads during mutations. It preserves the existing context API. No component imports a Firebase SDK or calls the legacy `/session`, `/login`, `/logout` or `/change-password` endpoints.

The new `api/firebase/` bridge implements the trusted boundary required by migration plan §7.5. It does not include `config/db.php`, query MySQL, check PHP password hashes or authenticate a PHP session. It reuses only the unchanged password/presentation helpers in `config/functions.php`. The helper file starts an empty PHP session, which the bridge immediately closes; browser bridge requests omit cookies.

- Detection preserves Prompt A: trim; exact case-insensitive `R-YYYY-NNNN` selects resident-number aliases; exact `S-YYYY-NNNN` selects staff-number aliases; all other values select staff-table username aliases. The server repeats detection, normalizes identifiers as the migration tool does, and resolves the private hash-keyed `identifierAliases` map. Staff Number and username resolve to one UID/email, including admin aliases.
- `resolve` verifies the submitted password with Firebase Auth before returning the canonical hidden email. The browser then calls `signInWithEmailAndPassword`. Missing/mismatched aliases, unknown accounts, wrong passwords and archives retain the generic error. Disabled identities are refused with the existing role-specific deactivation message when Firebase reports `USER_DISABLED`; Firebase can report that state before checking the password, so the original PHP distinction between a wrong password and a deactivated identity cannot be guaranteed for disabled Auth users.
- Every session loads `users/{uid}` with the client SDK. That document alone supplies role, activation, archive and setup flags. A verified-token `profile` bridge operation exposes only the original public header fields, including for first-login residents whose full profile is intentionally denied by rules. Original name/title/initial/residence-type helpers preserve presentation. Images come from `profileImages`; admin header counts use authorized Firestore counts.
- Password change first calls `reauthenticateWithCredential`. The bridge independently verifies the current password and reuses the existing server password policy/order/messages, including the Staff Number restriction. It changes the Firebase Auth password before clearing `users.isFirstLogin`; clients remain forbidden from clearing the flag. The SDK reauthenticates with the new password afterward. A failure between the Auth update and Firestore update leaves the gate closed: retry using the new current password. These two Firebase services do not share a transaction.
- Successful login and explicit logout append `loginHistory` through the bridge. The server derives UID, type, role, IP and Firestore request time. Per-operation document IDs prevent sequential retries from duplicating an event. Profile deactivation/archive signs the app out and attempts the same trusted logout record; an already revoked/disabled token cannot authorize a new audit record. Reload/focus/profile reads do not create login events. Raw client writes to aliases, lifecycle flags and audit history remain denied.
- The existing redirect/guard functions keep resident/staff separation, admin-only routes, first-password redirects and the staff profile gate. Staff cannot bypass the profile gate after password completion. The unchanged source exemption for visiting the staff password/profile pages remains.

## Remaining data migration and deployment

The authentication step does not create a legacy PHP session or update MySQL flags. Phase 2 Prompt 5 additionally migrated the resident Dashboard, Surveys list, Stat Detail, History and View Response/print/CSV to Firestore; see [resident-firestore.md](resident-firestore.md). Survey Form/submission, Confirmation, profile editing/onboarding completion and management data still call the previous PHP/MySQL endpoints and require later service work. The auth browser suite checks their auth shell and guards; the separate resident suite compares the migrated read screens against PHP. Completing the staff profile in Firestore remains a later task.

The new `frontend/public/firebase-auth.php` wrapper is copied into builds. With the existing XAMPP `app/` layout (or directly served `frontend/dist/`), it reaches the new bridge without changing the legacy API rewrite rules. For real Firebase, the host must inject `FIREBASE_WEB_API_KEY` and a valid, short-lived `FIREBASE_BRIDGE_ACCESS_TOKEN` authorized for Firestore in the existing project; see `api/firebase/.env.example`. The host is responsible for refreshing that token. No credential file is loaded. Emulator mode is server opt-in and accepts only loopback requests and the fixed local ports. Verified token claims are pinned to `.firebaserc`'s existing project.

Production hosting/auth/bridge credentials have not been configured or exercised. Firebase Hosting is static and cannot execute this PHP bridge; a deployed static frontend needs a separately hosted trusted bridge and routing before cutover. The existing Hosting emulator/build remains a static asset smoke check. No real Firebase deployment, provider update, data write, project creation or service account access occurred.

## Verification

```sh
# Against the already-running suite; preserves existing emulator data:
npm run test:auth:running
# Or start an isolated suite when the configured emulator ports are free:
npm run test:auth:emulators
npm run lint
npm run build
```

The browser runner requires Chrome at the default macOS path or `CHROME_PATH`. It refuses non-loopback emulator access, uses the project in `.firebaserc`, starts and stops only its PHP/Vite children, collision-refuses fixture document creation, and deletes only its synthetic accounts/documents/history. It leaves the existing emulator processes running. Firebase Auth, Firestore and the bridge are real local services; remaining legacy data requests are intercepted with the expected unauthenticated response so the final auth run cannot execute the legacy database bootstrap. No production Firebase endpoints or real credentials are used.

Verified on 2026-11-10: **95 browser/API assertions** passed for resident/staff/admin number and username aliases, case/whitespace, one form/no tabs, persistence, cross-portal/admin guards, logout, first-login password changes for all three roles, original server password policy/order, wrong-current/confirmation errors, retained first-login flags on failure, old-password rejection/new-password login, staff onboarding gate, trusted audit fields, forbidden direct flag/history writes, deactivated/archive refusal, malformed/empty credentials, compressed avatar rendering, mobile shell width and lifecycle sign-out. All synthetic fixtures were cleaned. The 15 detection/redirect unit tests pass. Lint, normal build, Hosting build and PHP syntax checks pass. The existing chunk-size warning remains nonblocking.

References: [Firebase password authentication](https://firebase.google.com/docs/auth/web/password-auth), [reauthentication and password updates](https://firebase.google.com/docs/auth/web/manage-users), [Firebase Auth REST operations](https://firebase.google.com/docs/reference/rest/auth), [Auth emulator connection](https://firebase.google.com/docs/emulator-suite/connect_auth).
