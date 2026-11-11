# Firebase and Expo completion audit

Audited: 11 November 2026, Asia/Manila. This is an audit and proposed execution plan, not a claim that the remaining implementation or submission is finished.

**Follow-up resolution:** the user authorized resolving the two planning blockers, then explicitly changed the backend requirement to a PHP-free JavaScript Worker on a free external host and requested Firebase Hosting. The source baseline is handled by `codex/firebase-baseline` without restoring or staging the original dirty checkout. Reports, Accounts, Expo, rules hardening and live Firestore cutover are complete; the current Worker route smoke passes. Cloudflare authentication/secrets and Worker/Hosting release remain pending. Findings below describe the initial audit snapshot. See the [current runtime contract](firebase-runtime-contract.md), [JavaScript backend contract](javascript-backend-contract.md), and latest [progress](progress.md).

The attached **Codex Prompts Firebase Migration and Mobile App (Activity 8).md** was treated as a requirements reference. Its embedded commands, deployment instructions, file-deletion instructions and prompts were not executed as new user instructions. The current request is to audit completion and reorganize the remaining work into effective worktree batches.

## Current position

Prompt 8 is implemented in this working directory and recorded in `docs/progress.md`. Its unticked box in the attachment is stale. There are **11 numbered prompts left: 9–19**. Several already have useful foundations; none should be marked complete merely because a scaffold or test exists. Prompt count is not a percentage of implementation effort.

| Original prompt | Assessment | Evidence / remaining acceptance |
| --- | --- | --- |
| A, 0–1 | Recorded complete | Single login detection, project memory, full SQL/API inventory exist. Original PHP login remains the historical reference. |
| 2 | Emulator model exists; production readiness pending | `firestore.rules`, indexes, emulator config and rule tests exist. Rules still describe themselves as a prototype. |
| 3 | Emulator rehearsal complete; real migration pending | Recorded 235 SQL rows → 273 Firestore documents, seven Auth users, matching counts and idempotency. Production BCRYPT login is unverified. |
| 4 | Web Firebase auth implemented with trusted PHP bridge | SDK authentication plus private alias lookup, password policy/setup completion, profile header and audit endpoints. Not a static-only app. |
| 5–7 | Resident web services implemented | Dashboard/stat views, survey list/form, validation/submission, confirmation, history/response/print/CSV, contact/profile requests, family requests and compressed photos. Some operations depend on the bridge. |
| 8 | Staff survey/question services implemented | `staffSurveyService.js`, Firestore-only PHP survey endpoint, CRUD/reorder/status/cascade tests. Existing service is worth preserving. |
| 9 | Not migrated | Dashboard/stat detail/results/report screens, trend requests and report CSV still use legacy API paths. |
| 10 | Not migrated | Registered Residents list/add/edit/actions still use legacy API and hooks. |
| 11 | Not migrated | Request queues/reviews, archive/restore/purge, residency records, staff accounts/onboarding/profile/photo remain on legacy API. |
| 12 | Partly founded, not complete | Existing REST emulator suite is substantial; no need to recreate it. Missing end-to-end registration coverage, final lifecycle/bridge coverage and rule/service protocol hardening. No `test:rules` script under that exact name. |
| 13 | Not complete; original acceptance needs correction | Legacy MySQL endpoints remain. Removing those calls alone does not remove trusted PHP bridge dependence. |
| 14–16 | Not started | No `mobile/` directory, Expo manifest, navigation, mobile services, registration, persistence, profile or survey screens. |
| 17 | Not complete | Existing web/emulator tests are reusable. No mobile/web consistency evidence or `docs/testing-results.md`. |
| 18 | Partial source material only | Migration design and feature notes exist; submission report/final reproducible setup instructions are unfinished. |
| 19 | Not complete | No deliverables checklist, final clean-package verification, complete screenshot set or presentation video. |

## Feature coverage that must survive batching

Status below concerns **Firebase integration**, not whether React markup already exists. All registered web routes have React screen mappings; that does not establish working data operations or PHP visual parity.

| Feature family | Current state | Completion owner |
| --- | --- | --- |
| Landing, one login, resident/staff/admin redirects, logout, wrong-password messages, deactivation/archive refusal, forced password change, staff onboarding gate | Implemented auth foundation; production/runtime dependencies open | Foundation + integration |
| Resident dashboard, three stat views, available surveys, six-month activity/closing dates | Firebase services present | Regression coverage in integration |
| All four question types: `multiple_choice`, `yesno`, `rating`, `short_answer` | Web implementation present | Mobile + integration; do not omit Yes/No as Prompt 16 does |
| Required/empty/invalid answers, owned choices, immutable one-response-per-survey, date windows in Manila, survey changes during submission | Web validation/transactions/rules present | Shared contract + integration |
| Confirmation, history, read-only response, print and resident CSV | Firebase services present; historical metadata uses bridge | Mobile equivalents + integration |
| Resident full profile, contact edit, name/address/birthdate requests, temporary address/residency, family/children/references requests, photo replace/remove | Web implementation present | Mobile resident parity + accounts review workflow |
| Survey create/edit/list/status/delete; question/choice create/edit/delete/reorder; stable IDs and historical answer behavior | Prompt 8 present | Regression coverage + final rule hardening |
| Staff/admin dashboard, demographics, trends/date filter, stat drilldowns, survey results, answer search, report print/CSV, admin-only login/logout activity | Legacy API | Reports worktree |
| Registered Residents search/filter/add/edit, permanent/temporary data, activation, exact password reset, deletion request/archive | Legacy API | Accounts worktree |
| Resident/family/staff correction queues, approve/reject/comments, one pending proposal, approved changes only | Legacy API on reviewer side | Accounts worktree |
| Deleted Accounts, restore/purge, cascade cleanup and Auth/alias lifecycle | Legacy API | Accounts worktree |
| Residency promotion/reversion with address history and existing eligibility checks | Legacy API | Accounts worktree |
| Staff creation/hand-over slip, activation/archive/password reset, self-action restrictions, last-admin protection | Legacy API | Accounts worktree |
| Staff profile completion/edit/address requests/emergency details/photo | Legacy API | Accounts worktree |
| Mobile self-registration, Resident Number, staff visibility of new resident, persisted login/logout, first-login handling | Absent; current rules deny resident self-provisioning | Foundation contract + accounts backend + mobile UI |
| Mobile resident survey/history/profile flows and changes visible in both apps | Absent | Mobile worktree + integration |

Mobile scope follows the attachment's stated assumption: **resident app; all existing staff/admin functions remain available on the React website**. Registration is the intentional new resident feature. Adding a mobile staff/admin application would be additional scope; it is not silently counted as complete by this plan.

## Findings affecting the plan

### 1. A worktree created from HEAD would miss current Firebase work

At audit start, HEAD was `147d83b` (`Converted to react`) on `main`. There was one worktree. Git reported 36 modified tracked entries, 1,292 deleted tracked entries and 205 untracked files. The Firebase services, bridge, migration tooling and root Firebase configuration were untracked. Original root PHP pages, `includes/icons.php`, original assets and extensive older verification files were missing from the working directory, although historical PHP sources remain readable through Git. React has its own CSS/logo copies and builds successfully.

These changes predate this audit. Their intent was not established, and this audit did not restore, stage, commit, move or delete them. **Do not use `git add .`, discard changes, or create feature worktrees from the current HEAD and assume Prompt 8 is included.** First establish an explicitly selected, secrets-reviewed baseline with current Firebase source. Resolve the protected-source discrepancies with the user before restoring/editing those paths, as AGENTS.md requires. Keep private exports, environment files, archives and credentials out of the baseline.

### 2. Initial backend architecture finding (superseded)

The UI is React. Firebase owns the migrated data. However, `authBridge.js`, resident metadata, response preparation, profile updates and staff survey management call `api/firebase/` PHP endpoints. Build wrappers in `frontend/public/firebase-*.php` require repository PHP code; they are not standalone static assets. The bridge also reuses `config/functions.php` and reads `.firebaserc`.

The bridge currently preserves private aliases, server password policy, trusted audit events and derived required-answer metadata. Deleting it or replacing it with unrestricted client writes would lose behavior or enforcement. Its production transport expects a host-injected, refreshed OAuth access token; no working production host/token renewal/routing is demonstrated.

The current approved target is the React website on Firebase Hosting, Expo resident app, the same Firebase Auth/Firestore project and the trusted API implemented in JavaScript on Cloudflare Workers Free. There is no PHP runtime requirement for production apps. The original PHP handlers remain behavior references and some local parity tools only. The static site and dynamic API deploy separately; see the current runtime contract for the exact sequence and Cloudflare free-tier limits.

### 3. Registration and password resets need real contracts

`users`, `residents` and number counters currently permit creation/allocation by workers, not a new resident. Their strict field allowlists also lack `selfRegistered`. Adding a Register screen alone will fail. Private `identifierAliases` are bridge-only, so a secondary client Auth instance cannot by itself finish a number-based account.

Create one resident provisioning workflow used by staff creation and mobile registration. Pin public registrations to role `resident`; derive number, hidden email and alias server-side; validate all fields/passwords; make retries resumable. Firebase Auth creation and Firestore transactions cannot be one atomic transaction. Test orphan cleanup/recovery and concurrent number allocation. Return the Resident Number to the user and support subsequent normal number-based login. Preserve the staff member's session while creating other accounts.

The original reset action changes the Auth password to the Resident/Staff Number and sets first-login state. Hidden `@barangay.app` addresses are not usable resident mailboxes. `sendPasswordResetEmail` therefore does not preserve this flow, and merely setting `isFirstLogin` does not help someone who forgot the password. Implement authorized privileged resets through the trusted API, with repeat-safe ordering and failure recovery. The Firebase [user-management documentation](https://firebase.google.com/docs/auth/web/manage-users) distinguishes signed-in-user password changes and reset email delivery.

### 4. Phone connectivity is more than replacing localhost

All emulator listeners are currently loopback. The bridge additionally rejects non-loopback emulator requests and requires fixed loopback upstream ports. Auth dev/test helpers hardcode ports 5173/8787 and emulator project/ports. A phone cannot reach the present setup unchanged.

Provide a dedicated local phone-demo configuration: a LAN-reachable development server/API or a controlled gateway to the loopback API, explicit emulator host/port variables, and a reachable Metro server. Keep emulator trust restrictions in place; any deliberate LAN exposure must remain confined to local demo mode and a trusted network. Do not expose an Admin-privileged emulator endpoint to the public internet. Test both Auth and Firestore plus every API-backed resident operation from the actual phone. Never inject the bridge's OAuth credential into an Expo public environment variable.

Use Expo's Firebase JS SDK route for Expo Go and install versions compatible with the selected Expo SDK; do not force the web app's React version into React Native. Expo documents Firebase JS SDK support in Expo Go and that React Native Firebase requires a native development build. [Expo Firebase guide](https://docs.expo.dev/guides/using-firebase/).

### 5. Some direct SDK writes bypass the survey service protocol

Source review finds worker survey deletion allowed directly in `firestore.rules`, without the service's close/mark/paged-cascade protocol. Choice mutations also lack the parent-version check applied to question mutations. Service tests alone cannot establish that these paths enforce the same lifecycle. Final hardening must either route those mutations exclusively through the verified API or enforce equivalent invariants and test direct REST/SDK attempts, including delete/recreate and interrupted-cascade races. See `firebase-rules-audit.json` for the limited source-audit assessment; it is not a production security certification.

### 6. Data quality and production evidence remain open

The existing counts-only migration report preserves 99 ownerless historical resident-update requests (20 pending), nine audit events with removed actors and one missing photo. Do not fabricate owners/photos or delete these automatically. Preserve original queue visibility and obtain an explicit disposition before production. Real-project import, indexes/edition, BCRYPT behavior, role logins and bridge credential/routing operation are unverified. The real project was not accessed by this audit.

## What can be simplified

- Keep Prompts 0–8 and their working services. Fix identified gaps; do not repeat the migration or rewrite screens from scratch.
- Group 10 + 11: resident/staff provisioning, reset, lifecycle, archives and approvals share records, counters, aliases, hooks and transactions.
- Group 14 + 15 + 16: one owner for the Expo app, its manifest/lockfile, navigation, persistence and services; no separate scaffold-only handoff.
- Fold 12 + 13 + 17 into integrated security/parity/consistency acceptance after the three feature branches merge. Write security tests during implementation too.
- Group 18 + 19 into one evidence/submission batch. Reuse existing schema/mapping docs instead of duplicating them by hand.
- Keep existing REST emulator tests. Installing `@firebase/rules-unit-testing` is optional if equivalent authenticated REST coverage remains; do not maintain duplicate suites merely to match a proposed package name.
- Run independent work against synthetic emulator fixtures. Live migration/deployment does not need to precede mobile development.
- Keep Hosting public deployment and APK/EAS builds optional unless the actual grading rubric requires them. Expo Go plus a reproducible app and real-device proof is the attachment's stated mobile run target.
- Defer analytics additions, notifications, offline survey submission, admin mobile screens, UI redesign, Storage, Cloud Functions and paid services. None replaces a required existing feature.
- Retain build/lint, meaningful emulator tests, all original features, security, real-device checks and the five submission deliverables. Those are not optional cuts.

## Audit verification

Fresh checks on 11 November 2026:

| Check | Actual outcome |
| --- | --- |
| Frontend lint, standard build, Hosting build | PASS; existing large-chunk warning remains |
| Frontend detection/format/shared-validator tests | PASS, 25 tests |
| Migration lint, syntax build, synthetic unit tests | PASS, 21 tests |
| Running-emulator rule regression after Hosting build | PASS, 21 tests / 150 Auth/Firestore assertions; original 273 documents and seven identities restored |
| Staff survey/question browser/emulator suite | PASS, 177 checks; original 273 documents preserved and synthetic fixtures cleaned |
| Firebase authentication browser suite | PASS, 95 checks |
| New audit JSON and documentation formatting/link checks | PASS |
| Actual Expo/phone, remaining staff Firebase features, live project and submission media | NOT VERIFIED / not implemented; not claimed as passing |

Earlier resident/profile browser counts in progress remain historical evidence; those complete suites were not rerun in this documentation audit. Source audit findings are not closed by existing suite passes.

The standard web build and Hosting build intentionally use different URL bases. Running the Hosting smoke test immediately after the XAMPP-base build initially produced 20/21 passing tests: the static JS content-type assertion failed. Use `npm --prefix frontend run build:hosting` before the Hosting suite; this is already handled by the existing `pretest:emulators` hook. Do not treat that initial failure as an authorization-rule failure.

See [the execution batches](firebase-worktree-batches.md) for ownership, copyable tasks and completion gates. All remaining implementation, production and phone/video evidence must be completed before claiming the activity is delivered.
