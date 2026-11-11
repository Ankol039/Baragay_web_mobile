# One-time MySQL → Firebase migration

The runnable entry is `src/cli.mjs`. It uses the existing **barangay-survey-1cc7d** project ID from `.firebaserc`, Firebase Admin SDK, mysql2 and sharp. It creates no Firebase project, Cloud Function, Storage bucket or paid service. Existing React/PHP/MySQL code is unchanged.

## Local rehearsal

From the project root, with XAMPP MySQL available:

```sh
npm --prefix frontend ci
npm --prefix migration ci
npm --prefix migration run emulator:dry-run
```

Stop an already running emulator suite before using that last command. It starts local Auth and Firestore, exports MySQL, transforms every row, creates emulator Auth users, imports the Firestore documents, repeats the import to prove idempotency, writes `docs/migration-verification.md`, and shuts the suite down. It does not clear existing emulator data: use a fresh emulator process without an imported fixture dataset. Unknown/conflicting target data causes a failure, not deletion.

Here **--dry-run means a complete write/verify rehearsal in local emulators**, not a no-write simulation. Both emulator environment variables must match the loopback endpoints in firebase.json. Missing, partial, remote or mixed-mode endpoints are rejected. The command needs no service account, ignores `MIGRATION_SERVICE_ACCOUNT` in dry-run mode, and never loads a production credential.

For an already running local suite, set these non-secret endpoint values and run:

```sh
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
node migration/src/cli.mjs all --dry-run --check-idempotency
```

Individual steps are also available, with the same mode guard:

```sh
node migration/src/cli.mjs export --dry-run
node migration/src/cli.mjs transform --dry-run
node migration/src/cli.mjs auth --dry-run
node migration/src/cli.mjs import --dry-run
node migration/src/cli.mjs verify --dry-run --check-idempotency
```

`import` ensures the Auth step is complete before writing Firestore. A separate `verify` invocation reads only, unless `--check-idempotency` explicitly requests a rerun of the write stages. Transform/import/verify re-derive documents from the integrity-checked export, rather than trusting edited plan contents.

## Private output and MySQL access

`migration/out/` is ignored by Git. Its directory is mode 0700; exports, plans, checkpoints and proof files are mode 0600. **mysql-export.json contains actual rows and password hashes**. firestore-plan.json also contains private profiles and Auth-import inputs. Do not attach, upload, paste, commit or put this directory in a submission archive. The public verification report contains only fixed labels, totals and validation outcomes.

MySQL credentials are read from literal DB_HOST/DB_USER/DB_PASS/DB_NAME/DB_PORT definitions in config/db.php. The file is parsed as text; it is never executed, imported through PHP or printed. This avoids all self-healing schema/data writes. Alternatively supply **all five** MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE and MYSQL_PORT environment variables. Partial overrides fail. No dotenv file is loaded automatically; the environment example contains no actual values.

Export uses a repeatable-read, read-only consistent snapshot over all 15 allowlisted tables. It includes archived/inactive accounts and all request/audit history. SQL DATE becomes a midnight UTC Timestamp representing the Philippine calendar date; SQL TIMESTAMP/DATETIME strings are interpreted at +08:00. Original SQL IDs remain in legacyId. Readable referenced images are compressed to bounded JPEG/base64 for profileImages; missing files are reported, not invented. No uploads file is written or deleted.

## Deterministic mapping and reruns

- Account UIDs are resident-<resident_id> and staff-<staff_id>; admin is a staff UID with role=admin. One Auth user per source account; username aliases point to that same canonical account.
- Survey/question/choice/request/audit IDs preserve the SQL key as a string. Response ID is <survey_id>_resident-<resident_id>; answer ID is the original question_id. SQL answer_id remains legacyId. Repeating the same snapshot creates no duplicates.
- Person subcollections retain SQL child/reference IDs; family-proposal people use stable 1-based array positions. All relationships are reconstructed before any Firestore write.
- Duplicate account emails/normalized aliases, duplicate response/answer paths, duplicate pending slots and broken required survey/response/question/choice/family links stop transformation instead of discarding rows.
- The full Firestore preflight refuses any existing unequal document. Equal documents are skipped. New records use batch.create() (up to 100 documents / approximately 4 MiB), which also refuses a concurrent overwrite. Counters advance transactionally to at least the exported maximum and never go backward. There are no delete operations.
- Auth checkpoints are separate for emulator/production. Existing matching accounts with the recorded source credential fingerprint are reused, **without resetting their password**. Existing unrelated identities/emails or changed source credentials require review. A crash between an Auth write and its durable checkpoint can require manual review; it never authorizes an automatic password reset.
- Auth and Firestore do not share a global transaction. A failed run can leave a partial, checkpointed import. Keep the source snapshot, resume unchanged records safely, and do not open the new application for writes during cutover.

The counters continue the global numeric suffix across years. They do not reset annually or reuse a lower value after purge. The exact four-digit login scheme must be reviewed before suffix exhaustion.

## Bcrypt and first login

The script attempts `importUsers(..., {hash: {algorithm: 'BCRYPT'}})` using the original PHP bcrypt bytes, without extracting a new salt or changing `$2y$` prefixes. If the hash is unsupported or receives a hash-related rejection, it creates the account with its identifier as temporary password and forces users.isFirstLogin=true. Unrelated API/network/identity failures are not treated as permission to reset credentials.

The Auth emulator accepts imported hash payloads but uses its own fake password verifier, not BCRYPT. In **emulator mode only**, accepted imports are therefore given the identifier temporary password and the first-login flag. The rehearsal verifies actual local password sign-in (or the expected disabled-account rejection) for every migrated Auth user. This is recorded separately from BCRYPT payload acceptance. Production bcrypt password verification is not claimed by this rehearsal.

The existing app's eventual Firebase auth service/bridge must enforce its forced-change/onboarding flow before clearing these flags; this migration does not implement the web/mobile auth bridge.

## Production is deliberately gated

**No real-project run is authorized by this task.** Do not set production approval variables or run production mode until the user explicitly authorizes it.

For a later approved run the code requires, in order:

1. `--production`, without either emulator host variable.
2. `MIGRATION_APPROVE_REAL_PROJECT` exactly equal to the existing configured project ID.
3. A successful local proof for the same snapshot fingerprint and migration source code fingerprint.
4. Review of every source warning; the code blocks unless `--acknowledge-source-warnings` explicitly acknowledges them. This is not a substitute for deciding how to handle missing owners/images.
5. `MIGRATION_SERVICE_ACCOUNT` pointing to an existing file **outside** the canonical project root. Symlinks into the project and project-ID mismatches are rejected before using the credential. The file/path/key are never printed or copied into the project. Only the approved production runtime loads it; the agent did not read it during this task.

The production branch never creates a project, deletes existing data, overwrites a conflicting document or resets a previously matched account's password. Rehearsal proof does not establish live edition/index readiness, IAM permission or compatibility of all bcrypt implementations. Those require the approved production plan and review.

## Verification and checks

The report compares all source table counts to primary destination counts, all 22 collection/subcollection groups (including zeros), every planned document's exact values/Timestamp types, all Auth UID/email/disabled-state mappings, required relationships, and counter continuity. It also reports known source orphans and missing images without identifiers or filenames. The separate frontend emulator suite tests client Security Rules; Admin SDK migration writes intentionally bypass those rules.

```sh
npm --prefix migration test
npm --prefix migration run lint
npm --prefix migration run build
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend run test:emulators
```

The migration's build script checks Node syntax; it produces no application bundle. Do not run the rule-test suite and migration rehearsal against the same already running emulator state: the frontend rule suite uses synthetic fixtures and clears its local documents.
