# Feature coverage and acceptance

Updated 11 November 2026 from the merged Integration source and executed suites. This covers all 28 declared website routes (two public, nine resident, seventeen staff/admin), plus their actions and the resident Expo app. Every route has an implemented screen; the only generic placeholder is the unknown-page fallback. The former family-request route intentionally redirects to the combined review screen, matching the original consolidation.

`Implemented / local PASS` means the listed automated checks ran against actual emulator/API/browser services or the original PHP reference. It does not claim a fresh pixel comparison of every route, physical iPhone success, live import or production acceptance. Original PHP/CSS/logo references were retained without redesign.

| Website route(s) | Required features preserved | Evidence / status |
| --- | --- | --- |
| `/landing`, `/login` | Branding, shared resident/staff/admin number-or-username login, password reveal, validation, role routing, generic credential failure | Auth 95 checks; built-runtime 26 checks; implemented / local PASS |
| `/resident/dashboard`, `/resident/stat-detail` | Resident counts, available/completed information, own stats and links | Reports 67 PHP parity + 139 browser/API checks; Expo overview checks; implemented / local PASS |
| `/resident/surveys`, `/resident/survey-form` | Eligibility/window/already-answered rules, four question types, required/empty/invalid answers, shared normalization, deterministic response, concurrent submission refusal | Resident survey 253 checks; rules 15 tests / 219 assertions; implemented / local PASS |
| `/resident/confirmation`, `/resident/history`, `/resident/view-response` | Confirmation, own-only history/read-only answers, closed-survey metadata, CSV and print invocation | Resident survey 253 checks; cross-platform 35 checks; implemented / local PASS; native print-dialog output not observed |
| `/resident/profile` | Full permanent/temporary and family details; contact save; reviewed name/address/birthdate/family proposals; shared pending limit; compressed photo/crop/replace/remove | Resident profile 130 checks; Accounts 89 lifecycle/browser checks; Expo 35 checks; implemented / local PASS |
| `/resident/change-password`, `/staff/change-password` | Existing policy, first-login gate, actual Auth password change, reauthentication, lifecycle locks, session refresh | Auth 95 + account-lock 156 checks; implemented / local PASS |
| `/staff/dashboard`, `/staff/stat-detail` | Staff/admin distinction, all eight drilldowns, survey/resident metrics, trends/date filters/reset, demographics, admin activity/account panels | Reports 67 PHP parity + 139 browser/API checks; implemented / local PASS |
| `/staff/survey-management`, `/staff/add-survey`, `/staff/edit-survey` | List/search/status, create/edit/status/delete, original validation, retryable leaf-first large cascade | Staff survey 177 checks including interrupted 2,415-document cascade; implemented / local PASS |
| `/staff/question-management` | All four question types, stable choices, add/edit/delete/reorder/preview, version consistency, forged-ID refusal | Staff survey 177 checks; client administrative writes denied by final rules; implemented / local PASS |
| `/staff/results-dashboard`, `/staff/reports` | Selector, exact aggregates/rounding/denominators, charts, answer search, print classes/invocation, CSV bytes, empty/deleted/closed behavior | Reports 67 original-PHP comparisons + 139 browser/API checks; implemented / local PASS; native print dialog not observed |
| `/staff/resident-management` | List/search/filters, add/edit all fields/family, issued number, password reset, activate/deactivate, deletion request/archive, promotion/reversion | Provisioning 27 + lifecycle/browser 89 checks; account-lock 156; implemented / local PASS |
| `/staff/user-management` | Admin staff creation/hand-over slip, edit, reset, toggle/archive; self/last-admin restrictions and preservation of staff session | Provisioning 27 + lifecycle/browser 89 checks; implemented / local PASS |
| `/staff/complete-profile` | First-profile gate, staff/emergency/address fields, reviewed address edits, photo and header refresh | Lifecycle/browser 89 checks plus shared auth/profile guards; implemented / local PASS |
| `/staff/address-requests`, `/staff/family-requests` | Combined resident/family/staff review, imported pending requests, approval/rejection/comments, atomic ordered people updates | Accounts lifecycle/browser 89 checks; implemented / local PASS |
| `/staff/deletion-requests` | Role-scoped queue, approval/rejection/comments, recoverable lifecycle state | Accounts lifecycle/browser 89 checks; implemented / local PASS |
| `/staff/deleted-accounts` | Admin-only archive list/restore/purge, Auth disable/delete and bounded related-document cascade | Lifecycle/browser 89 checks including 601-answer purge; implemented / local PASS |
| `/staff/residency-records` | Admin-only residency/address history and permanent/temporary transitions | Accounts lifecycle/browser 89 checks; implemented / local PASS |

Compatibility redirects are retained. Logout, submission, stats and CSV are service actions rather than missing pages. Current browser components call per-app Firebase services; unused legacy API transport, SQL proxy and upload fallbacks were removed. The trusted Firebase API deliberately remains to enforce server business rules.

## Expo resident coverage

| Flow | Actual verification |
| --- | --- |
| Registration, issued Resident Number, number login, resident-only access, token refresh/persistence, setup/password and lifecycle refusal | Implemented; 35 real-service Expo web checks; native persistence after actual iPhone restart PENDING |
| Overview and resident stat details | Implemented; real-service browser checks PASS |
| Full profile/contact, identity/address/birthdate/family requests and bounded photo replacement/removal | Implemented; browser/API checks PASS; actual iPhone photo permission/picker PENDING |
| Four-type form, shared validator, online immutable submission/races, confirmation/history/read-only response | Implemented; browser/API and nine unit/contract checks PASS; actual iPhone submission PENDING |
| CSV, sharing and print adapters | Implemented/exported; physical share-sheet/print verification PENDING |
| Website ↔ Expo contact changes and submissions/history | Four actual bidirectional built-website/Expo-web cases PASS inside the 35-check suite; actual iPhone equivalence PENDING |
| Android/iOS/web compatibility | All three bundles export; doctor 20/20; this is not an observed device run |

Mobile staff/admin screens, offline submission, notifications and paid Firebase services are outside the agreed scope. No original required website feature was removed.

## Remaining acceptance gates

1. Observe iPhone Expo Go launch, session restart, photo permissions, submission and website visibility using synthetic records.
2. Confirm original known-password logins and actual-phone live flows. The approved real cutover is complete: 273 documents/seven BCRYPT accounts, final deployed rules source matches, 29 indexes READY and 28 role/API/rule read checks pass. Custom-token verification does not establish original password knowledge.
3. Capture the missing actual-phone and sanitized real-console screenshots and the final five-to-eight-minute demonstration video.
4. Verify the clean submission copy and record its actual checksum/path. The report, setup guide, screenshot list and video script already exist; missing recordings remain PENDING.

See [executed results](testing-results.md), [submission checklist](deliverables-checklist.md), [migration report](migration-report.md) and the package logs for reproducible detail.
