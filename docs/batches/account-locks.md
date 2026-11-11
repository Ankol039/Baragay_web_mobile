# Integration actor-lock regression

Run from the Integration worktree, with the shared Auth/Firestore emulators already running:

```sh
node frontend/tests/account-locks-firestore.mjs
```

Reserve an exclusive emulator/API slot first. The test uses fixed PHP/Vite ports through `startAuthDev`; it does not start emulators, upload rules, reset data, change counters, read private credentials or contact production. Current Integration actor-lock rules, Reports and Accounts `FirebaseBoundaryError` response handling must be present.

The synthetic resident/staff/admin fixtures cover verified header/profile, alias resolution, login/logout audits, password changes, resident profile/history/schema and staff surveys/reports/account reset refusals. Direct Firebase SDK tests check protected reads, otherwise-valid writes, self-unlock denial and continued access to the actor's own lifecycle document. Exact snapshot comparisons show blocked requests changed no profile, lifecycle flags, survey, audit, request or metadata; actual Auth sign-in confirms rejected passwords/resets were never applied. Removing locks restores API/SDK reads and mutations, including real password changes on the synthetic accounts.

Random fixture UIDs and private aliases are created with create-only semantics. `finally` removes those Auth identities, profiles, locks, aliases, survey descendants, response and audit fixtures. Original Firestore documents/counters and Auth identity lists are compared without printing data values. The script emits PASS only after all checks and cleanup finish.

Validation: syntax/lint PASS and 156 actual API/SDK checks PASS, preserving all 273 original documents and seven Auth identities. Administrative SDK writes are now denied even after unlock; their valid mutations use the trusted API. The parent coordinator owns source fixes, progress logging and the final commit.
