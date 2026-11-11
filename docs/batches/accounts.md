# Accounts package B

## Provisioning checkpoint

Canonical endpoint `POST /api/firebase/accounts.php`; build alias `/firebase-accounts.php` (Integration owns router mapping). JSON actions `registerResident`, `createResident`, `createStaff`, `resetResident`, `resetStaff` follow the runtime contract. Public `registrationFields` returns `{ok:true,data:{today,fields}}`, including original person/address metadata, `genders`, `residence_types`, `category_references`, `min_months`.

Example public registration:

```json
{"action":"registerResident","operationId":"e0a734f9-2d9c-4e0e-b5d1-0b7fc364df56","values":{"first_name":"Registration","middle_name":"Synthetic","last_name":"Resident","birthdate":"2000-01-01","gender":"woman","birthplace":"Test town","residency_status":"permanent","residency_start_date":"2020-01-01","household_number":"11","barangay":"Test Barangay","municipality":"Test City","province":"Test Province","postal_code":"1234","references":[{"first_name":"Reference","last_name":"Person","gender":"man"}],"password":"FixturePass8","confirm_password":"FixturePass8"}}
```

Use optional original fields: courtesy_title/courtesy_title_other/name_extension, email/contact_number; seven address parts (purok/street_highway optional). Temporary requires seven temp_* address fields using the same required subset plus a residence_type key from metadata. Family fields use original flat spouse_/father_/mother_ person names, is_married/has_children string flags, children/references person arrays; one character reference required. Occupation/hotline and special_category/category_reference retain original validation. No caller role/UID/identifier/alias is accepted.

Public registration chooses the actual password and finishes first-login setup. Staff-created residents use issued Resident Number/default password and first-login gate; staff retain Staff Number hand-over slip and profile onboarding. Responses contain UID/issued number only, never Auth token or hidden email. Apps use existing resolver/sign-in afterward; staff sessions stay intact.

Private accountOperations bind public recovery to matching submitted profile and password proof (one-way hash only). Counter reservation never reuses numbers; Auth starts disabled, Firestore stays inactive until final activation; retries recover unfinished operations. Trusted resets close activity before changing the actual Auth password, revoke existing tokens and finish with first-login state. Completed reset retries return saved outcome without resetting a later password. Lifecycle mutations must honor accountLocks.

Validation: `node frontend/tests/accounts-firestore.mjs` passed 27 local emulator checks with no rules upload; public metadata/original validation, roles, actual chosen/default passwords, number resolution, allocation uniqueness, retry binding, interrupted activation, real reset and non-reapplication, staff onboarding/self-reset/session preservation. Current runner restores counters in finally. An earlier failed test left synthetic fixtures after transaction exit; exceptions/rollback fixed and identified fixtures removed. Integration independently compared both counters against the saved original migration plan and verified exact restoration of all 273 documents and seven Auth identities. Full lifecycle/review implementation follows this checkpoint; not claimed complete.

## Lifecycle and review implementation

The same endpoint now supplies `residents`, `users`, `resident`, `requests`, `deletions`, `archives`, `residencyRecords`, and `staffProfile`. Read envelopes retain the old fields and Manila date presentation. Existing React pages/components retain the original markup; their reads, nested forms and actions use `src/services/accountsService.js`, never MySQL or PHP sessions.

| Flow | JSON action and main fields |
| --- | --- |
| Full resident edit | `updateResident`, `resident_id`, `values` (same original add/edit flat fields) |
| Resident activation/archive | `toggle` / `archive`, `targetUid`, `kind: 'resident'` |
| Staff activation/archive | `toggle` / `archive`, `targetUid`, `kind: 'staff'` |
| Deletion proposal | `requestDeletion`, `resident_id`, `reason` |
| Address/family/staff/deletion review | `review`, `kind: 'resident'|'family'|'staff'|'deletion'`, `request_id`, `decision: 'approve'|'reject'`, `review_comment` |
| Archive recovery/permanent deletion | `restore` / `purge`, `id`, `kind: 'residents'|'staff'` |
| Residency transition | `promote` / `revert`, `resident_id`, `reason` |
| Staff onboarding/contact/emergency/address | `staffSave`, original flat form fields |
| Staff photo | `staffPhoto`, bounded `photo` JPEG data URL; `staffRemovePhoto` |

Management mutations carry the same UUID `operationId` on retry. Their private operation is bound to actor/action/target/values; atomic edits and reviews save their result in the same transaction. The web service retains only opaque UUIDs under SHA-256 request keys in session storage so refreshing after an interrupted request can retry its original intent. No personal field values, passwords or Auth tokens are stored there.

Activation, archive, restore and approved deletion use an Auth/Firestore saga: reserve `accountLocks/{uid} {operationPath}`, close Firestore activity, change Auth state/revoke tokens, then finalize the saved intended activity/archive fields and remove the lock. Resets follow the same lock protocol and cannot be confused with another operation type. Both actor and target lock checks prevent trusted mutations racing a lifecycle operation. Shared authentication/rules guards and staff header photo support are Integration-owned changes, requested separately.

Resident edits cannot silently change saved residency status. Promotion archives both addresses and requires the original stay duration; reversion restores the prior permanent address and current living address, marks the promotion reverted and preserves the source warnings. Name-only imported requests preserve gender; birthdate-only requests preserve identity/addresses. Family approval replaces ordered people, including clearing absent children. Staff proposals use the existing migrated flat `proposed` address shape. Review decisions serialize target/proposal reads, clear only their matching pending pointer, preserve comments and retain source rejection permissions/messages. Staff/admin/self and last-administrator protections remain server-side.

Purge is intentionally resumable rather than a single unbounded transaction: each transaction deletes at most 350 leaves, revalidates the active administrator and target lock, removes response answers before parents and family-request people before their parents, then removes aliases/Auth/profile/user/slots last. Original historical deletion/name-address/staff/residency logs survive as the SQL schema specifies; family requests cascade. A timeout may require retry with the same operation UUID. Locks remain closed until completion; existing archive and survey data can never be restored after a purge has started. Oversized atomic edits/reviews are rejected without partial writes, and oversized review resolution is checked before a lifecycle reservation.

Verification runners are `node frontend/tests/accounts-firestore.mjs` (provision/reset) and `node frontend/tests/accounts-lifecycle-firestore.mjs` (all other actions and browser integration), run only with the coordinator's exclusive emulator slot. Both write a mode-0600 complete raw Firestore/Auth before-image under `/tmp` before test writes; `finally` restores exact fields/counters, removes only test identities and verifies originals before deleting that backup. If a test process is killed, retain the printed backup path and restore from it; never invent counter values.

## Final package verification

Coordinator completed the interrupted validation: 27 provisioning/reset checks and 89 lifecycle/browser checks PASS against local emulators; all 273 original documents, exact counters and seven Auth identities restored. Fixed the purge transaction helper return type so bounded completion can return a boolean, and normalized optional SDK metadata fields across durable JSON snapshots. Lint/build, 25 existing unit tests and PHP syntax checks pass. Native device and production evidence are not claimed.
