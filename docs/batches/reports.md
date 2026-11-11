# Package A — Firebase reports

Completed 11 November 2026 on `codex/firebase-reports`, based on `codex/firebase-baseline`.

## Delivered

- Staff/admin dashboard, all eight original stat drilldowns, demographics, chart data, date trends, results, text-answer search, printable reports and CSV use `src/services/statsService.js` and the read-only `api/firebase/staff-reports.php` boundary. Nested TrendPanel and SurveySelector requests are migrated too.
- Existing JSX, labels, layout, messages, report controls and original unsupported-view redirects are retained. The original PHP pages and pure business helpers were read before changes. No original PHP, configuration, assets, uploads, database files, shared router, manifests, rules or indexes were changed.
- The endpoint verifies Firebase identity and current lifecycle/role/setup state, then rechecks the worker in a read-only Firestore transaction shared by all report queries. Staff receives no administrator activity block; administrator-only drilldowns redirect staff to the dashboard. Residents and unprovisioned, inactive, archived or setup-incomplete workers are refused.
- Projected source reads and request-local snapshot reuse exclude password/alias/photo fields. Dashboard data and charts share one response and snapshot; each drilldown reads its relevant collections. Results fetch the selected survey's responses/answers and current question/choice metadata. Removed questions/choices retain the original counting policy.
- Arithmetic preserves PHP rounding, distinct-resident participation with active/nonarchived denominator, historical response counts, inclusive Manila open windows, latest-response dates, trend validation/swap/zero fill/year clamp, age bands and case/accent-insensitive demographic grouping. CSV retains the original bytes, order, filename escaping and zero-row differences from print/results. Text results retain the original newest-first 200-answer cap; print and CSV remain uncapped.

## Actual validation

| Check | Result |
| --- | --- |
| `npm --prefix frontend run lint` | PASS; no warnings/errors |
| `npm --prefix frontend run build` | PASS; existing bundle-size advisory only |
| `php docs/tests/firebase-reports-parity.php` | PASS: 67 database-free source-parity checks |
| `node frontend/tests/reports-firestore-browser.mjs` | PASS: 139 emulator/browser checks |
| PHP syntax for seven new API modules and public wrapper | PASS: eight files |
| `git diff --check` | PASS |

The PHP oracle executes the unchanged original results/report/CSV loaders with synthetic row adapters, compares exact CSV bytes and result rows, and checks the original drilldown metadata. Additional checks cover empty/deleted values, answer caps/order, ties, ratings, demographics, Manila midnight and trend bounds.

The Chrome suite exercises actual Firebase/API/React behavior as staff, admin and resident, plus lifecycle refusal accounts. It checks all eight drilldowns, dashboard arithmetic/demographics against the preserved emulator snapshot, administrator login/logout isolation and historical-role behavior, open/closed/future surveys, empty/deleted states, nested trend Apply/reset, answer search, print action/CSS, downloaded CSV bytes and filename, and a phone-sized web viewport. It rejects legacy data requests, production Firebase requests and browser exceptions. Evidence contains labels and counts only.

Stateful tests ran in the coordinator's exclusive slot using its hardened Integration rules. They did not upload baseline rules, clear the emulator database, use a private key or contact production. Cleanup removed only synthetic fixtures/audits and verified exact preservation of all **273 original Firestore documents (including counters) and seven Auth accounts**. Before-image restoration is available in `finally` if a shared helper unexpectedly changes an existing document. The test slot was released and the suite's PHP/Vite processes stopped.

## Integration handoff

- Allowlist canonical `/api/firebase/staff-reports.php` and public `/firebase-staff-reports.php` in the coordinator-owned standalone router. The coordinator has already prepared these routes; they are intentionally absent from this package's diff.
- Optional manifest command: `"test:reports:running": "node tests/reports-firestore-browser.mjs"`.
- No new rule or index changes are needed. Administrator panels use the existing `loginHistory(event ASC, at DESC)` index.
- Runtime still needs the documented trusted PHP API and maintained production OAuth configuration. The suite validates local emulator behavior, not production deployment, actual mobile hardware, production indexes or final screenshots/video. Those remain Integration/Delivery responsibilities.
