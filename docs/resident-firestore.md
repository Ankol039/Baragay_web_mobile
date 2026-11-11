# Resident Firestore reads — Phase 2 Prompt 5

Dashboard, Surveys list, all three Stat Detail views, History and View Response now use `frontend/src/services/residentService.js`. The components retain their existing markup and consume the same `{ok,data,redirect?}` envelope and snake_case fields. Existing numeric response links and CSV filenames remain valid; new responses can use their opaque Firestore document IDs. `useServiceData` preserves the previous loading/error/redirect contract and discards results after route or account changes.

## Reads and calculations

- Open surveys are queried with `status == active`, `startDate <= Manila day` and `endDate >= Manila day`, with the existing endDate/startDate index. These are inclusive calendar dates, rather than local browser timezone dates. The service retries if the business day changes while an open query fails. The server rules independently enforce their own Manila day. Lists are ordered in the service to match the PHP source.
- Every response query constrains `residentUid` to the authenticated Firebase UID. The service excludes those survey IDs from available surveys and keeps answered open surveys in the existing second list. History includes only the owner's records. Invalid or foreign response links return the existing History redirect, and CSV export returns the existing not-found error.
- Dashboard figures are computed in the service: available and all historical completed counts, assigned total/completion percent, six-month zero-filled activity, five earliest unanswered deadlines, days left, household/spouse/child/reference counts, address and residency progress. As in PHP, the Assigned headline includes historical completions while Assigned detail lists only currently open surveys. SQL's partial first-month activity cutoff and PHP's overflowing month-label calculation are preserved, including month-end behavior.
- Typed Firestore event instants are formatted in Asia/Manila; date-only fields remain UTC-midnight calendar values. PHP-compatible date labels, residence-type names, Unicode description widths, missing-answer display and CSV escaping are retained. Household counts come from this resident's two people subcollections and marriage flag, including stored children regardless of the `hasChildren` flag, as in PHP.

## Current text for historical responses

The original PHP joins use **current** survey title/description, current ordered questions and current choice text. They include new unanswered questions, omit removed questions and show `No answer` for removed choices. Imported answer snapshots alone cannot reproduce that behavior or supply the survey description.

The existing rules intentionally deny resident reads of closed survey definitions. The new `api/firebase/resident-read.php` performs the narrow historical metadata join against **Firestore**, reusing the existing verified-token transport. It never loads `config/db.php`, opens MySQL, changes rules or writes data. It verifies the account's active/archive/setup/role state and derives ownership from the verified Firebase UID. `history` returns title/description only for surveys attached to that owner's responses; `response` verifies the owner before returning the current survey/questions/choices. Missing surveys retain PHP INNER JOIN visibility. There is no caller-selected owner or unrestricted definition endpoint. The separate `submitted` operation preserves the source's optional title-only lookup for its confirmation modal; it exposes no responses or answers.

The service reads response answers through the normal SDK and existing owner-enforcing rules. Print and CSV both use the same authorized service loader. CSV uses a browser Blob download, preserving the original rows, content, filename and PHP quoting behavior. `frontend/public/firebase-resident.php` is copied into builds, just like the existing auth bridge wrapper. This bridge shares the existing server-only emulator/short-lived OAuth configuration documented in [firebase-auth.md](firebase-auth.md); no key file is required or accessed.

## Verification and reruns

With the same local Auth/Firestore suite running and the existing guarded migration import completed, run from `frontend`:

```sh
node --test tests/resident-format.test.mjs tests/detectAccountType.test.js
node tests/resident-firestore-browser.mjs
npm run lint
npm run build
```

The browser runner also needs the installed `migration` dependencies and XAMPP MySQL for its read-only PHP oracle. It starts/stops only its own PHP/Vite children and uses Chrome at its standard macOS path (or `CHROME_PATH`). It parses the existing literal MySQL settings in memory without executing the mutating database bootstrap. The PHP reference runs existing handlers in a repeatable-read, read-only transaction. Source values stay in process memory; reports contain counts only. Tests temporarily complete the migrated accounts' emulator-only first-login gates, restore the original documents, remove only new test audits, and collision-refuse/clean synthetic Firestore fixtures. They preserve the running emulator suite and production data. The existing security-rule suite clears its local fixture database, so run that suite in a fresh emulator before importing the migration dataset.

See [resident-firestore-verification.md](resident-firestore-verification.md) for the final screen comparison. The formatter suite compares 288 residency date pairs and Unicode/CSV/date/month-end cases directly with XAMPP PHP. Browser cases additionally exercise inclusive open dates, past/future/inactive exclusion, own/foreign answered partition, the closing-soon limit, all answer types, added/removed questions and choices, closed-survey history, manual/automatic print, print CSS, exact PHP CSV bytes, invalid links, whitelist redirects and mobile rendering. The existing 21 security-rule tests/148 assertions also pass.

## Remaining scope

Survey Form/submission, Confirmation, Profile and all staff/admin data screens remain on their previous services and are later migration work. This task changes resident read screens only. Production web config, PHP bridge hosting/OAuth injection and index deployment remain unverified; the emulator does not verify production composite-index availability. Static Firebase Hosting cannot execute the PHP bridges without separate routing to the trusted PHP host. No production import or deployment occurred.
