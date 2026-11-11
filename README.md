# Barangay Health Center Survey System

React website and Expo React Native resident app sharing the existing Firebase Authentication/Firestore project. The original PHP screens remain behavior references. A narrow trusted PHP Firebase API preserves server validation, account-number aliases, password/lifecycle operations, audit records, approvals and cascades. The completed app does not use MySQL or legacy PHP sessions at runtime.

## Requirements

Node compatible with the installed Vite/Expo versions (Node 22.12+; use a currently supported LTS for the Firebase CLI), Java for the Firestore emulator, and PHP with curl/mbstring (intl for Unicode username normalization). Use the same Firebase project for both apps; Spark only. No Cloud Functions or Firebase Storage is required. PHP's built-in server is a local demo runtime; public deployment requires a suitable HTTPS PHP host.

## Install

```sh
npm --prefix frontend ci
npm --prefix migration ci
npm --prefix mobile ci
```

Migration dependencies are used by some emulator tests. The clean submission excludes private SQL exports, database credentials, dependency directories and real environment files. Original PHP references requiring config/db.php are not the final application entry point.

## Local website

In one terminal start the emulator suite once:

```sh
npm --prefix frontend run emulators:start
```

In another:

```sh
npm --prefix frontend run demo:emulators
```

Open http://127.0.0.1:8787/. This serves an actual built React bundle and only the allowlisted Firebase API endpoints; it does not need XAMPP Apache/MySQL or Vite. The emulator demo uses explicit placeholder public config and must not be uploaded as a production build. Existing local rehearsal identities are not automatically included in a fresh emulator; use synthetic registration on mobile or the separately guarded migration workflow.

## Mobile and iPhone Expo Go

See [mobile/README.md](mobile/README.md). For a local browser check, with the API/emulators running:

```sh
npm --prefix mobile run demo:emulators
```

Open http://127.0.0.1:8790/. For an actual phone, use the computer's private Wi-Fi IPv4 address, start the explicit trusted-LAN gateway and `native:emulators`, and scan Metro's QR in an Expo Go version supporting this SDK. Keep the emulators private; do not publicly tunnel them. Native device evidence is tracked separately from web export/browser tests.

## Checks

```sh
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix migration run lint
npm --prefix migration run build
npm --prefix migration test
npm --prefix mobile run lint
npm --prefix mobile test
npm --prefix mobile run build
npm --prefix mobile run doctor
```

Stateful emulator/browser suites share fixed ports and must run one at a time with no concurrent interactive edits. Build the root-base demo before Hosting smoke checks. `npm --prefix frontend run test:rules` compiles the current worktree's rules locally and preserves/restores existing emulator documents/identities. Auth, profile, survey, staff-survey, reports, accounts, account-lock and Expo integration tests document their precise commands and cleanup in [testing-results.md](docs/testing-results.md). No test command deploys to production.

## Real Firebase

Public web config belongs in ignored frontend/.env.local and mobile/.env.local, using their committed .env.example files. Do not put a service account, private key or bridge OAuth token in client config. The Admin credential stays outside the repository and is used only by explicitly authorized server/migration operations. Production bridge credentials are server-only and require renewal. The approved live cutover has completed: 273 documents and seven Auth accounts verified, original BCRYPT hashes retained, final rules deployed and 29 indexes READY. See [live migration verification](docs/live-migration-verification.md). Physical-device and known-password login checks are separate from these import results.

For the local website against real Firebase, configure frontend/.env.local, set `GOOGLE_APPLICATION_CREDENTIALS` to the authorized external credential path and run `npm --prefix frontend run demo:live`. Open http://127.0.0.1:8788/. The launcher builds to a private temporary directory and maintains a rotating server-only token outside the repository/document root. It neither deploys nor imports, never sends the Admin credential to PHP or the client, and leaves the emulator demo running independently. For a real-project iPhone session, use the resident-only port-8793 gateway described in mobile/README.md. Public hosting remains optional and needs HTTPS.

The guarded data migration and source warnings are described in [migration-report.md](docs/migration-report.md), [firebase-migration.md](docs/firebase-migration.md) and [migration-verification.md](docs/migration-verification.md). Refuse live conflicts/overwrites; do not recreate the original MySQL database. Actual production state and device/media gaps are recorded in the test/deliverable documents.

## Submission

[Deliverables checklist](docs/deliverables-checklist.md) covers runnable website/mobile source, Firebase structure/rules/indexes, screenshots and the actual video. Run `python3 docs/build-submission.py /private/tmp/barangay-firebase-submission.zip` to make a non-destructive allowlisted candidate copy with a checksum manifest. It excludes credentials/private exports/SQL rows/uploads/env files/dependencies/old bundles and archives. Missing iPhone, real-console or video evidence remains PENDING; a checklist/script is not a completed media deliverable.
