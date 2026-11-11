# Completion packages and remaining gates

Revised 11 November 2026. The baseline/runtime blockers have a concrete resolution in [baseline notes](firebase-baseline-resolution.md) and [runtime contract](firebase-runtime-contract.md). This plan supersedes the attached Prompts 9–19 and the earlier six-batch plan. Do not rerun a separate foundation prompt.

## Current execution status

Packages A (Reports), B (Accounts) and C (Expo) are implemented and merged. Package D local integration/security/feature checks pass; the user confirmed Expo Go opens the app. Package E live import/rules/indexes pass and the iPhone launch was confirmed. The user later authorized a PHP-free JavaScript Worker plus Firebase Hosting; the Worker implementation and emulator route smoke now pass. Cloudflare login/secrets, Worker and Hosting deployment, then read-only public smoke checks remain. Do not rerun completed packages or the attached prompts. This plan is retained as implementation history; see the current runtime contract for release steps.

## Run order

Create clean worktrees from **`codex/firebase-baseline`**, not the dirty `main` checkout. Keep one coordinator/integration worktree. Three feature owners can code concurrently; reserve shared emulator/browser tests sequentially because their current helpers use fixed ports and some suites reset data.

| Package | Branch | Work | Depends on |
| --- | --- | --- | --- |
| A | `codex/firebase-reports` | Staff/admin dashboard, stats, results, print/CSV | Baseline |
| B | `codex/firebase-accounts` | Residents, staff, reviews, archives, residency, profiles, registration backend | Baseline |
| C | `codex/expo-resident` | Complete Expo resident app | Baseline; use contract fixtures until B's endpoints land |
| D | `codex/firebase-integration` | Merge, security hardening, complete feature parity and cross-platform tests | A + B + C |
| E | Continue D | Approved live checks, final report, screenshots/video and clean submission | D passes |

**A + B + C in parallel → D → E.** B should deliver provisioning/registration first so C can integrate early. A is independent. All original website features remain required; mobile is resident-only, with staff/admin work retained on web.

## Shared rules: paste once at the start of each worktree task

```text
Read AGENTS.md, the relevant recent Phase 2 progress entries, and the needed
sections of docs/firebase-runtime-contract.md. Follow the package below.
Read the actual original PHP for your screens and current React/API/service code
before editing. Original PHP references exist in this baseline; do not alter them,
config/, includes/, assets/, uploads/ or database/. Preserve web labels, appearance,
flows and business rules. Use the existing Firebase project, Spark and per-app
services. Keep components small. No live writes/deploys, service account access,
redesign, unrelated cleanup or new features. Do not rerun completed Prompts 0–8.
Run lint/build and relevant synthetic emulator tests; coordinate exclusive access
to fixed-port suites. Record commands/results/blockers in docs/batches/<package>.md
and append one progress row. Do not claim unperformed device or production checks.
```

Read only the PHP/screens/services relevant to the package. The full historical audit and 11 original prompts are reference material, not mandatory repeated context. Use the audit's feature table as a final coverage cross-check.

## Ownership

| Owner | Exclusive scope |
| --- | --- |
| A | Staff Dashboard/StatDetail/Results (including Reports export); results/chart/TrendPanel components; new statsService modules, report endpoints/wrappers/tests; `docs/batches/reports.md` |
| B | ResidentManagement/UserManagement/CompleteProfile and request/archive/residency screens; resident/user/request/staff-profile components; shared profile form/photo and resident-action/request-queue hooks; account/request/staff-profile services; new accounts/review endpoints/wrappers/tests; `docs/batches/accounts.md` |
| C | Entire `mobile/` including manifest/lockfile, navigation/theme/screens/services/tests; `docs/batches/mobile.md`; web validator read-only |
| Coordinator/D | Web manifest/lockfile, shared auth/transport/router, rules/indexes/root configuration, validator, launchers, final documentation and merge conflicts |

A/B can create uniquely named wrappers in `frontend/public/`; route/manifest/rules changes go to the coordinator as focused requested diffs. Avoid shared generic-component edits unless coordinated. B preserves existing resident service contracts. Only each owner appends its own progress row; coordinator preserves all rows at merge. No extra package workspace, duplicate provisioning backend, full security-suite rewrite or four-emulator configuration project is needed. If a new endpoint needs a shared route, coordinator adds it promptly.

## A — Reports

```text
Complete Firebase integration for staff/admin dashboard and all stat drilldowns,
results/demographics/answer search, charts/date trends, report print and CSV.
Use statsService modules; migrate nested TrendPanel/export requests too.
Keep original figures, ordering, rounding, Manila dates, labels, filters and empty
states. Login/logout activity is admin-only. Fetch only authorized needed data;
use counts/page-local caching where appropriate. Compare synthetic output and CSV
with the original PHP, including empty/deleted/closed cases and all three roles.
Stay within A ownership; report needed index/rule changes to the coordinator.
Done means every read/action in these screens uses Firebase and parity checks pass.
```

## B — Accounts and reviews

```text
Deliver the runtime contract's resident registration/provisioning and real password
reset endpoints first, then finish all resident/staff lifecycle and review screens.
Include residents list/search/filter/add/edit/permanent-temporary/family, activation,
reset, deletion request/archive; resident/family/staff/deletion approve/reject/comments;
restore/purge; residency promotion/reversion/address history; staff create/hand-over
slip/toggle/archive/reset; staff onboarding/profile/address requests/emergency/photo.
Keep every original field/message/eligibility rule and admin/self/last-admin restriction.
One provisioning core creates correct Auth + users/profile/private aliases/counters;
public callers can create residents only. Preserve staff sessions. Real reset changes
Auth password and first-login state; hidden-email reset or a flag alone is insufficient.
Test concurrent allocation/reviews, imported pending requests, partial failures,
retry/compensation, lifecycle refusal, photo bounds and interrupted cascade cleanup.
Publish concrete registration field examples early for C; coordinate schema/rules
and router changes. Done means all original actions work and registered mobile
residents appear in the web list and subsequently log in by Resident Number.
```

## C — Complete Expo app

```text
Create mobile/ as an Expo React Native JavaScript resident app; this package
explicitly authorizes that new app directory. Use Expo-compatible Firebase JS SDK
and native dependencies, the same project, .env.example and per-app services.
Build Login/Register, protected Surveys/History/Profile navigation and resident
overview/stat access. Include number login, persisted SDK auth, logout, lifecycle
refusal/sign-out, forced password change and clear staff/admin mobile refusal.
Profile covers all resident sections, contact edits, name/address/birthdate AND
family requests, photo pick/resize/compress/replace/remove and password change.
Surveys cover multiple_choice, yesno, rating and short_answer, existing shared
validation/required/empty rules, trusted prepare and deterministic response
transaction, duplicate/closed/concurrent-edit refusal, confirmation, history/read-only
response and resident export/share equivalents; include refresh/loading/error states.
Reuse existing labels/palette, schemas and service contracts; no staff/admin app,
notifications, offline submission or redesign. B owns registration implementation.
Configure safe phone LAN/API/emulator reachability and persistent native auth.
Run lint, Expo export, expo-doctor and relevant tests; perform actual Expo Go device
checks when possible, clearly marking missing evidence. Done requires working
resident flows against the real agreed services, not successful mocked requests.
```

## D — Integration and acceptance

```text
Merge A/B/C, preserving their evidence/progress. Add only needed shared router,
auth/config/schema/index changes. Harden rules AND the privileged API; extend the
existing emulator suites and expose a documented test:rules command. Close the
source-audit findings: registration support, direct survey delete/cascade bypass,
and choice versioning. Cover cross-user/role/lifecycle/admin/setup protections,
last-admin safety, account/reset recovery, pending requests, immutable required
answers, concurrency and representative large operations.
Remove every legacy DB/session call, including modal fallbacks, trends, exports,
images and proxies, while retaining the trusted Firebase API. Verify every original
web route/action/visual as resident/staff/admin with the standalone built runtime.
Prove actual phone/web registration visibility, profile/photo updates both ways,
request review, website survey edits on phone, phone responses in staff results/web
history, web responses in phone history and one winner for simultaneous submissions.
Run appropriate web/mobile lint/build/export, migration and emulator/browser checks.
Fill docs/parity-checklist-firebase.md and docs/testing-results.md with actual evidence;
fix failures and mark unperformed phone checks PENDING. No blanket data resets or
unapproved live operations. Done requires full feature coverage, not only passing builds.
```

## E — Evidence and submission

```text
Create one final migration report, reproducible setup guide, deliverables checklist
and timestamped 5–8 minute video script using actual merged behavior/results and
existing schema/mapping docs. Show the trusted API honestly in the architecture.
Capture synthetic-data web/mobile/console/test screenshots and the actual video;
a script/shot list is not a media deliverable. Obtain any user-only phone/console/
recording evidence explicitly and leave missing artifacts PENDING.
After explicit production authorization and a current passing emulator rehearsal,
perform guarded real migration/rules/index checks and all role/device login tests.
Do not read/print/copy the service account key, overwrite live data or acknowledge
source warnings for the user. A public host is optional; verify its PHP runtime,
HTTPS and token renewal if used. Never upload the emulator demo build as production.
Stage a clean allowlisted submission copy with source/lockfiles/env examples/rules/
indexes/docs and verified media; exclude secrets, private exports/uploads, caches,
old ZIPs and dependencies. Never clean by deleting the user's working files.
Test fresh-copy setup and the actual staged artifact. Done requires five real items:
runnable React website, runnable Expo app, Firebase data structure/rules/indexes,
screenshots and video, with a manifest of paths and honest PASS/PENDING status.
```

## Removed or consolidated work

- Old foundation prompt: replaced by the concrete baseline, standalone runner and runtime contract already supplied.
- Prompts 10/11: one Accounts owner; no duplicate auth/alias/lifecycle implementations.
- Prompts 14/15/16: one complete Expo owner; no placeholder-only scaffold handoff.
- Prompts 12/13/17: one merged security/parity/consistency gate; tests are also written within features.
- Prompts 18/19: one final evidence package, reusing design/mapping material.
- PHP-free rewrite, forced rules-test library migration, parallel emulator infrastructure, optional public Hosting/APK builds: removed from the critical path.
- No required existing feature, meaningful test, real-phone demonstration, screenshot or video was removed. Real Firebase migration remains an explicitly authorized gate.
