# Survey answering — Phase 2 Prompt 6

Implemented and checked locally on 2026-11-10. Authentication, survey definitions, submissions and owned response exports use the existing Firebase project. No production operation or MySQL write is part of this task.

## Application changes

`frontend/src/services/surveyService.js` exposes:

- `getSurvey(surveyId)`: loads an open, unanswered survey plus ordered questions/choices. It preserves the form's existing snake_case fields, radio values and result/redirect envelope.
- `submitResponse(surveyId, input)`: accepts the original `q{questionId}` fields, for example `{ qmc: 'choice_a', qrating: '5', qyesno: 'Yes', qtext: 'Comment' }`. It rechecks the account, open window and deterministic response ID, prepares trusted required-question metadata, then uses the Firebase Web SDK `runTransaction` to create the response and all answer documents together. The transaction rereads the survey, response, schema, questions and choices; concurrent edits conflict or fail closed. There is no queued/offline write or separate answer-saving phase.
- `getSurveyConfirmation(surveyId)`: preserves the standalone confirmation page through the existing Firestore title bridge.
- `getResponseCsv(responseId)`: reuses the existing owner-authorized response loader and client CSV encoder. No server CSV endpoint is called. Filenames, quoting, embedded newlines, rating formatting and imported numeric response links remain supported.

Survey Form and Confirmation now use `useServiceData`. View Response uses the survey service's CSV export. Shared session/metadata transport lives in `services/resident/context.js`; all data access stays inside services. The existing components, CSS, labels and success modal remain in use.

## Shared validation

`frontend/src/shared/validateResponse.js` has no React, browser or Firebase dependency. Mobile can import it directly. `validateResponse(questions, input)` returns `{ valid, code, message, missing, invalid, answers }`; it does not mutate its inputs. Canonical questions contain `id`, `type`, `text`, `order`, optional `required`, and a `choices` array of `{ id, text }`.

The original form requires multiple choice, Yes/No and ratings; short text is optional. Those defaults remain authoritative when `required` is absent. An explicit Boolean overrides the default, including required short text. Each provided value must be valid even for an optional question:

- Choice: exact `choice_{id}` for a choice belonging to this question.
- Yes/No: exactly `Yes` or `No`.
- Rating: an integer from 1 through 5, or exactly one of the form strings `'1'` through `'5'`; partial numeric strings, decimals and Boolean/object values are refused.
- Text: PHP-compatible trim and a maximum of 20,000 UTF-16 units, matching the emulator's Rules `size()` behavior. For example, 10,000 supplementary emoji fit; 10,001 do not. The limit is the existing Firestore prototype bound, now applied by the client too.

An entirely empty response is rejected before writing any response/answer. Unknown input question keys do not become answers.

## Required-answer enforcement in Rules

The earlier per-answer validators could reject bad values but could not detect an omitted required question in an arbitrary subcollection. This task adds **trusted derived metadata** at `surveys/{surveyId}/validation/response`:

| Field | Value |
| --- | --- |
| `surveyVersion` | Survey `updatedAt` Timestamp |
| `firstRequiredId` | First required question ID, or empty string |
| `requiredNext` | Map from each required ID to the next required ID; the last points to empty string |

`api/firebase/survey-schema.php`, exposed in built PHP deployments through `frontend/public/firebase-survey.php`, verifies the Firebase ID token and active/onboarded resident account. It reads the open survey and **all** its questions in one Firestore REST transaction, derives the metadata itself, and writes only that metadata. It accepts no client-provided required list, answers, owner, role or survey version. Missing/closed surveys produce the original quiet refusal. A POST body cannot grant extra permissions.

This is a narrow addition to the existing trusted PHP host; it does not submit responses or duplicate answer validation. Credentials follow the existing bridge configuration: owner token only in explicitly configured loopback emulator mode, injected short-lived OAuth in production, no service account file. The transaction uses POST `batchGet` because the installed emulator cannot parse a transaction byte-string in a GET query parameter.

All client writes to validation metadata are denied. Question create/update/delete now requires a simultaneous server-timestamp advance of the parent survey's `updatedAt`. Therefore an added, removed, retyped or newly required question invalidates old metadata. Future staff/mobile question services must include that parent timestamp update. Trusted import/maintenance tools must also invalidate/rebuild metadata after changing question requirements; bypassing Rules carries that responsibility.

The response rule requires current-version metadata and the first required answer in the same commit. Every required answer rule requires the next linked answer. The last terminates the proof. Every new answer also has `submittedAt: serverTimestamp()`; proofs require the server request time, so pre-existing orphan answers cannot satisfy a fresh submission. All answer values, actual question type/text/order and the selected choice's parent/text are independently validated by Rules. Parent plus answers remain immutable after creation.

This avoids a fixed, manually unrolled question-count limit. Firestore still imposes [transaction/Rules access budgets](https://firebase.google.com/docs/firestore/manage-data/transactions): larger surveys can exceed platform limits and will fail closed with the existing safe retry message. Four mixed answer types and six required rating answers are exercised here; this is not a claim that arbitrary-size submissions fit. A trusted large-submission path is outside this task. Imported historical answer documents need not have the new timestamp because historical reads remain compatible; only fresh client creates use the new schema.

These remain prototype rules. They validate ownership, lifecycle, server Manila dates, required-answer completeness, allowed choices, rating bounds, text length and immutable submission state. Review them before broad deployment. No rules/indexes/Hosting deployment was performed.

## Original messages and intentional hardening

| Case | Preserved outcome |
| --- | --- |
| Already answered, missing or closed survey | Quiet redirect to `/resident/surveys`; PHP previously displayed no error message. |
| Entirely empty service submission | Form `error=empty`: “Nothing was submitted, so your answers were not saved and this survey is still open to you. Please answer at least one question before submitting.” |
| Missing required question | Existing alert: “Please answer all required questions before submitting.” Existing group highlights remain. |
| Invalid choice/rating/Yes-No | Refused using that same existing required-question message; no response is stored. |
| Saving/preparation failure | Form `error=failed`: “Something went wrong while saving your answers. Nothing was recorded, so you can safely try again.” |
| Success | Existing `/resident/surveys?submitted={id}` success modal; concurrent losing submission quietly returns to the list. |

PHP did not previously check choice ownership or enforce required questions on the server, and did not impose a text-length limit. This prompt explicitly hardens those cases. There is no previous invalid-choice-specific message to preserve. The new length message is “Text answers must be 20,000 characters or fewer.” The browser still gives the original required-question alert when a fresh form's required groups are empty, while the service independently handles an all-empty direct submission with the original empty message.

## Local verification

From `frontend`, with the existing local suite running:

```sh
npm run test:survey:unit
npm run test:survey:running
npm run build:hosting
npm run test:rules:running
npm run test:auth:running
npm run lint
npm run build
```

For a fresh isolated suite, stop the running suite first and use `npm run test:survey:emulators` or the existing `npm run test:emulators`. Browser checks need installed Chrome (or `CHROME_PATH`), PHP with curl/mbstring, and the existing frontend dependencies. `test:rules:running` additionally uses the existing `migration/node_modules/firebase-admin` dependency. It snapshots emulator documents in memory, runs the original reset-based suite, restores exact document contents and removes only newly created emulator Auth identities. It never accesses a real Firebase project or credential file. Run these stateful suites sequentially.

The survey runner uses unique synthetic IDs, refuses non-loopback targets, loads/compiles Rules only in the emulator, blocks production/legacy API requests, and cleans its documents, Auth identity and login events. It checks real browser submission, stored deterministic response and answer documents, duplicate/concurrent refusal, empty and whitespace-only input, invalid choice ownership/rating/Yes-No/text, required links including required text, missing/stale/forged schema, date/status closure, closure after form loading, failed preparation, success/confirmation messages, existing history/CSV download and phone layout. Counts-only results are recorded in `docs/progress.md`.

The production bridge host/configuration, Firebase edition/index availability and deployment remain unverified, as in the earlier authentication/read tasks. Static Firebase Hosting cannot execute the PHP bridge. Profile and staff/admin data service migrations remain pending.
