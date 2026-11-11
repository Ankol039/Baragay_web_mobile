# Staff survey management — Phase 2 Prompt 8

Implemented 2026-11-11 (Asia/Manila). Survey Management, Create/Edit Survey and Question Management now call `frontend/src/services/staffSurveyService.js`. The existing forms, table, preview, modals, labels and redirects are retained. Results, reports, dashboard and other staff data screens remain separate migration work.

## Service and server boundary

The service exports `listSurveys`, `getSurvey`, `createSurvey`, `updateSurvey`, `toggleSurvey`, `deleteSurvey`, `getQuestions`, `createQuestion`, `updateQuestion`, `deleteQuestion` and `moveQuestion`. It returns the existing `{ok, data, message?, redirect?}` envelopes and snake_case UI fields; IDs are strings, including imported numeric document IDs.

All operations go through `api/firebase/staff-surveys.php` (the production build copies the `firebase-staff-surveys.php` wrapper). This uses the existing verified Firebase token/REST transport and the same single project's Firestore database. It neither loads `config/db.php` nor executes any SQL handler. It includes only the unchanged management validator declarations and `config/functions.php` helpers, so PHP's `valid_written_text` and exact metadata/type/choice validation messages remain authoritative.

The verified `users/{uid}` must be active, unarchived, staff/admin, past first login and profile-complete. Body-supplied role, UID, creator, timestamp and legacy ID fields cannot grant access or change protected fields. Any eligible staff/admin can manage a survey regardless of its creator. Each mutation transaction rereads the worker account and parent survey; contention retries up to five times, including aborted reads/queries/commits.

Metadata uses UTC-midnight timestamps representing Philippine dates, with defaults computed in Manila. Survey listing sorts by creation time descending and counts Firestore responses using a surveyId-only projection. Creation uses fresh IDs and server creation/update timestamps; edits preserve original creator, creation timestamp and legacy IDs.

## PHP parity and stable IDs

- Survey metadata retains required fields, real-title minimum eight characters, optional meaningful description minimum ten characters, and start-before-end checks. SQL title/question/choice column bounds and valid calendar dates remain enforced by the trusted writer. Description retains the SQL TEXT byte bound; the existing creation form still limits input to 500 characters.
- Initial survey creation drops blank question/choice boxes and requires at least one nonblank question. As in PHP, this builder does **not** apply the stricter five-character question/minimum-two-choice checks used by Question Management.
- Question Management requires meaningful question text of at least five characters and at least two submitted nonblank choices for multiple choice. Existing choice IDs must belong to that question. Clearing a submitted existing choice deletes it; omitted existing IDs are retained, matching the PHP API. Added choices receive fresh IDs after existing choices. Changing to another type removes the choices.
- Text edits update choices in place. Questions retain their IDs during moves; moves swap the nearest strict order neighbor. Deleting a question removes its choice subcollection and resequences the remaining questions 1..n.
- Single-question/choice deletion retains historical answer documents, matching the actual SQL foreign keys documented in the migration inventory. The unchanged UI copy is not a new instruction to erase historical answers. Whole-survey deletion removes all responses and answers.
- Every question/choice operation advances parent `survey.updatedAt` in the same commit. This invalidates the resident required-answer schema; the existing trusted submission-preparation endpoint rebuilds it before another response.

Survey creation and question edits are atomic and refuse operations exceeding 500 writes without partial changes. A survey with an unusually large question/choice set may require smaller edits. No multi-step partial-creation fallback is introduced.

## Batched survey deletion

Deletion first transactionally writes inactive status, advances `updatedAt`, and records `surveys/{sid}/management/deletion` with the title and server start time. This trusted marker is client-denied by the existing default rules. Resident submissions fail against inactive status, and all other management mutations check the marker before writing, preventing reopening or new questions through this service during deletion.

The cascade queries at most 400 documents per page, deletes answers before response parents, and choices before question parents. Both root response queries and each nested collection are paged. Each deletion batch rereads the worker, inactive survey and marker in its transaction. It then removes validation metadata and atomically deletes the marker and survey last. No new index or rules change is needed.

A failed/interrupted cascade leaves the inactive survey and marker in place. Retrying the existing Delete action resumes cleanup; any eligible worker can finish it. Completed batches remain deleted. The operation spans several commits, so it cannot provide SQL-style rollback of an entire large cascade. PHP host timeouts may require a retry for very large surveys. This covers the existing model's questions/choices, responses/answers and validation documents; unrelated collections are untouched.

Prototype rules still allow eligible workers to perform some direct SDK management operations. This service serializes its own operations; arbitrary trusted/import/direct maintenance must follow the same parent/version/deletion protocol. Broader rule hardening remains a production-review item. No root rules or Firebase deployment was changed here.

## Emulator verification

With the existing suite running, from `frontend`:

```sh
npm run test:staff-survey:running
npm run test:survey:running
npm run lint
npm run build
node --test tests/detectAccountType.test.js tests/resident-format.test.mjs tests/validateResponse.test.js
npm run build:hosting
npm run test:rules:running
```

Run stateful suites sequentially. Hosting smoke tests require the root-base Hosting build, rather than the normal XAMPP build. With emulator ports free, `npm run test:staff-survey:emulators` starts an isolated Auth/Firestore suite. Browser tests require Chrome (or `CHROME_PATH`), PHP with curl/mbstring, frontend dependencies and the already-installed migration firebase-admin dependency. The test guards pin loopback hosts and the existing project; no service account credential is needed or read.

The staff runner verifies browser creation of all four types, metadata/choice edits, stable IDs, reorder/toggle/delete, PHP validation differences and messages, cross-question choice refusal, question CRUD/type changes/resequencing, concurrent requests, safe oversized-operation refusal, resident submission compatibility and stale metadata, lifecycle/role gates, phone rendering, and retrying a simulated interrupted **2,415-document** cascade. It blocks legacy/production HTTP requests and checks the complete document tree for orphaned descendants. Fixtures are cleaned and all **273 pre-existing emulator documents** are compared for exact equality afterward. Counts-only final results are in `progress.md`.

Production still requires the existing trusted PHP host and short-lived OAuth injection described in `firebase-auth.md`. Static Firebase Hosting cannot execute PHP. No live Firebase or MySQL write, service account access, Storage, Cloud Functions, rule/index deployment or protected original-source edit was performed.
