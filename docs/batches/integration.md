# Integration implementation log

## Shared security and runtime prerequisite — 11 November 2026

- Independent locked frontend/migration dependencies installed from npm cache.
- Survey SDK deletion denied: trusted API owns close/marker/paged cascade. Worker/admin SDK writes cannot reopen or mutate a survey with a deletion marker.
- Choice create/update/delete requires atomic parent version advancement, matching question mutations.
- Optional boolean users.selfRegistered supports legacy documents; client creates cannot assert it and updates must preserve its value. Only trusted API provisioning can mark public registration.
- Current-worktree rules explicitly compile/load into the emulator before state-preserving regression. Added test:rules entry point.
- Router reserves named Accounts and Reports endpoints; absent implementation returns 404 rather than requiring a missing PHP file.
- Fresh checks: lint/demo build, 25 unit tests, PHP router syntax, 24 emulator rule tests / 189 assertions PASS. Original 273 documents/seven identities restored.
- Read-only project metadata verified STANDARD Firestore Native in asia-southeast1 with freeTier=true. No project write/deploy or service account access. Requested loginHistory event/at index already exists; no duplicate added.

These are prototype Security Rules with tested role/ownership, response, version and deletion safeguards. They need review and broader integrated API/mobile validation before broad sharing; passing this focused suite is not production certification.

Reports, Accounts and Expo are running as three user-authorized agents in their own worktrees. Stateful suites use an exclusive coordinator slot. This log describes a completed prerequisite, not final package D/E completion.

## Combined implementation and final client boundary

Reports f2861e9, Accounts 6db27b9 and Expo 5763765 are merged in Integration (equivalent cherry-picked revisions). The complete local implementation now uses Firebase services; unused legacy transport/SQL proxy/photo fallbacks were removed.

Final rules route all account/survey administration, review decisions and cascades through the verified trusted API so raw SDK writes cannot bypass last-admin, Auth reset, alias, lifecycle or deletion protocols. Resident contact/proposal and immutable response transactions retain their strictly validated client paths. Current client suite: 15 tests/219 assertions PASS; API management coverage remains 89 browser/lifecycle cases. Existing raw-administration-positive prototype tests were replaced with a resident/query suite plus a matrix denying all three roles' raw administrative writes.

Combined guards cover accountLocks, transactional actor checks, password setup/reauth races, staff photo fallback and header refresh. Tests: 156 lock API/SDK, 95 auth, 130 profile, 253 survey, 177 staff-survey, 26 built-runtime, 27 provision/reset, 89 account lifecycle and 35 Expo real-service/bidirectional browser checks PASS. Original 273 documents/seven identities restored before starting the interactive iPhone session. Expo lint/nine tests/platform export and doctor20/20 PASS.

User-provided external Admin credential verified read-only access to the real existing project; zero top-level collections observed, no writes/deploy/import. Actual iPhone session is now offered via private Wi-Fi gateway/Metro; physical-device outcome pending user confirmation. No stateful suites run while that session is in use.

## Approved live cutover and delivery checks

The user approved live deployment/import with the documented source warnings preserved. Matching emulator proof and empty-target checks passed. Rules/indexes deployed; 273 documents and seven BCRYPT Auth identities verified exactly; rerun adds zero documents/counters and resets no passwords. All 29 indexes READY; final rule source matches the released source. Removed 19 unused rule helpers and the nullable proof warning; final compiler emits no rule warnings. Original PHP/config/includes/assets/uploads/database source and original staging were not changed; the authorized migration reused its original private output/checkpoints and regenerated its public counts-only report. A sanitized copy is docs/live-migration-verification.md.

Added a separate real-project local runtime with SDK-managed server token renewal outside the repository/document root and a resident-only real LAN gateway. Two runtime safety tests cover ten cases; 26 standalone checks and eight live-gateway checks pass. Twenty-eight live read checks cover all seven identities/three roles without Firestore writes; they use custom-token authentication, not guessed/reset original passwords. Real public config exists only in ignored local env files.

Clean candidate ZIP extraction installs all three locked dependency sets offline; web/migration/mobile lint/build pass, including all-platform mobile export, 25 web/nine mobile/21 migration tests and independent built-runtime/private-path smoke. Added route/action parity checklist, report, setup, deliverables/recording script, six Expo web plus three public website screenshots and safe ZIP manifest builder. Expo CLI login is verified and Metro has delivered an actual iOS bundle; rendered screen/native persistence/photo/submission and final phone/console/video evidence still await observation.
