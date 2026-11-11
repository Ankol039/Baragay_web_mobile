# Verification results — 11 November 2026

Only executed checks are marked PASS. Expo web uses the actual React Native web target and real local Firebase/API services; it is not a physical iPhone test. All automated data is synthetic. Stateful tests run serially and clean their fixtures.

| ID | Feature / platform | Evidence / actual result | Status |
| --- | --- | --- | --- |
| A01 | Shared validator, identifiers, Manila formatters — web | 25 Node tests including PHP formatter comparison | PASS |
| A02 | SQL-to-Firestore transformation, safeguards, idempotency — migration | 21 synthetic migration tests; lint and syntax build | PASS |
| S01 | Ownership, roles, required immutable answers, lifecycle and typed metadata — Firebase | Final server-only administrative boundary: 15 client-rule tests / 219 assertions; current Integration rules explicitly compiled; trusted management validation covered by 89 API/browser cases | PASS |
| S02 | Account reset/archive actor-lock boundary — web/API/SDK | 156 checks; locked reads/writes/password/audits refused, own lifecycle doc readable, unlock recovery and original data preservation | PASS |
| W01 | Login/logout, all roles, identifier aliases, onboarding/password, persistence/refusals — web | 95 browser/API assertions against real local Auth/Firestore/bridge | PASS |
| W02 | Staff survey/question CRUD/status/reorder/stable choices/cascade — web | 177 checks pass in merged Integration | PASS |
| W03 | Resident survey validation/transaction/history/export — web | 253 checks pass in merged Integration | PASS |
| W04 | Resident profile/contact/correction/family/photo — web | 130 checks pass in merged Integration | PASS |
| R01 | Dashboard/stat/results/trends/demographics/print/CSV — web | 67 PHP original-source parity checks and 139 actual browser/API assertions | PASS |
| B01 | Public/staff provisioning, number allocation, retries and real password resets — API | 27 emulator checks, durable before-image restoration | PASS |
| B02 | Resident/staff edits, approvals, archive/restore, residency, onboarding/photo, purge — web/API | 89 lifecycle/browser checks, including 601-answer cascade; exact 273 documents/seven identities restored | PASS |
| M01 | Expo lint, shared validator/family/gateway contracts | Nine meaningful tests; no undefined Admin routes, project-pinned gateway | PASS |
| M02 | Expo Android/iOS/web export | All three platform bundles exported | PASS (bundle check) |
| M03 | Expo compatibility diagnostics | Merged Integration Expo doctor 20/20 | PASS |
| M04 | Registration/number login/persistence/refresh/overview/stat/profile/photo/password/surveys/history — Expo web | 35 real-service browser checks with actual UI and transactions, no mocked success responses | PASS |
| X01 | Expo submission appears in React history; contact changes in both directions; React submission appears in Expo history | 35-check Expo browser suite includes all four actual bidirectional website/app cases | PASS |
| P01 | Real Firebase Admin SDK | External credential verified; target was empty before approved cutover; no credential copied or displayed | PASS |
| P02 | Real Firebase rules/index deployment and migration | Approved cutover: 273 exact documents/seven Auth accounts; seven BCRYPT hashes retained; idempotent rerun adds zero documents/resets; final rules released and source read-back matches; 29/29 indexes READY | PASS |
| P03 | Real role/API/rule reads | 28 checks across four resident, two staff and one admin identity; locally signed custom-token authentication, own-user rule reads and role profile/dashboard requests; zero Firestore writes | PASS (not password-login proof) |
| P04 | Original known-password login and physical-device live flows | Import acceptance preserves hashes but does not test unknown original plaintext passwords; actual device acceptance still required | PENDING |
| T01 | Local real-project runtime | Real build/rotating external token-file API works; two runtime safety tests cover ten conditions; 26 standalone regression and eight real resident-gateway allow/refuse checks | PASS |
| D01 | iPhone Expo Go launch/LAN connectivity | Expo CLI sign-in confirmed; iOS bundle delivered; user confirms app opens successfully in Expo Go | PASS (launch) |
| D02 | iPhone persisted session after app restart, photo permissions, survey submit and web consistency | Must execute on physical device | PENDING |
| E01 | Screenshots/video/clean submission | Six synthetic Expo web screenshots and three anonymous website captures present; source ZIP clean install/build/lint and independent runtime smoke pass; final phone/console/video pending | PENDING |

## Reproducible local commands

Install frontend and migration dependencies with npm ci in each directory. Start emulators once. From frontend, build the emulator demo before Hosting checks. Run stateful tests one at a time: test:rules, test:auth:running, test:reports:running, test:accounts:running, the accounts lifecycle runner, account-lock runner and resident/profile/survey runners. From mobile, run lint/test/build/doctor; use build:demo before test:emulators. Use the current merged Integration worktree as the trusted API root.

## Failures resolved during implementation

- Purge completion returned a boolean through an array-only PHP transaction helper: changed the helper return contract to mixed; the 601-answer purge passes.
- Durable Auth snapshot serialized away undefined SDK fields: normalize before and after through JSON, then compare exact identity metadata; originals are retained.
- Password change could trigger session refresh before SDK reauthentication: web/mobile credential barriers and token-change observation retain the session while rechecking lifecycle afterward.
- Explicit native initializer imports bypassed Expo web platform selection: imports now allow .web resolution.
- Filtered gateway needed credentialed SDK CORS for its exact permitted web origin: corrected exact-origin headers and stripped cookies; no permissive wildcard CORS added to PHP.
- A gateway unit test still targeted a deliberately removed Write channel: security checks now target the allowed Listen path; unused Write remains refused.
- The first bidirectional run had an ambiguous success-modal/toast test selector: the operation succeeded; the selector was scoped to the actual modal before rerun.

A passing build does not establish feature parity, physical-device behavior, production indexes or the usability of imported real passwords. Pending rows remain open until evidence exists.

## Approved live cutover

See live-migration-verification.md for counts-only import evidence, live-firebase-state.json for the exact deployed rule hash and READY index count, and live-api-verification.json for the 28 live read checks. The user explicitly approved preserving the documented source warnings before import. The original saved private snapshot/checkpoints were used without copying them into the submission or re-exporting MySQL. All seven original BCRYPT hashes were retained; no fallback/reset was needed. Custom-token verification establishes role/API access, not a known-password login. No public host was deployed.

After importing, unused administrative rule validators were removed; local rule compilation and the existing 15-test/219-assertion boundary suite pass. The final CLI deployment compiles without rule warnings. The live source is read back and compared byte-for-byte.
