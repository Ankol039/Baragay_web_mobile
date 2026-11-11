# Resident profile — Phase 2 Prompt 7

Implemented and verified on 2026-11-11 (Asia/Manila). The resident profile uses `frontend/src/services/profileService.js`. Its reads and writes go through the existing trusted PHP host to **Firestore**, with Firebase Authentication tokens and no MySQL connection. This keeps business rules on the server and reuses the unchanged `config/functions.php` formatters, field specifications, address limits, courtesy titles, repeatable-person validation and hotline policy. No original PHP page, config helper, asset or database file was edited.

The profile page, forms, cropper, labels, original success/error text, confirmation and family modal behavior remain in place. Staff uses of the shared photo/form components retain their existing endpoints.

## Data and concurrency

| Operation | Stored result |
| --- | --- |
| Contact | Update only `residents/{verifiedUid}.contact` and server `updatedAt`. Contact email does not change the hidden Auth sign-in email. |
| Birthdate | New immutable `nameAddressRequests/{id}` with only `proposed.birthdate` populated, as a UTC-midnight calendar Timestamp. |
| Name/address | New `nameAddressRequests/{id}` with the name, permanent address, optional temporary address and previous-address snapshot. Gender stays unchanged. |
| Family/household | New `familyRequests/{id}`, reason, Household proposal and ordered `children` / `characterReferences` subcollections. Blank repeatable rows are omitted; No to married/children clears their proposed data. |
| Photo | `residents/{verifiedUid}.photoDataUrl`, a square JPEG data URL. Removal writes an explicit empty value. Both replace/delete the retired `profileImages/{uid}` document atomically. |

Birthdate, name/address and family proposals now have **one pending correction across all types per resident**, as requested. The existing `_nameAddress` and `_family` pointer paths remain compatible with imports and future staff review. A transaction reads the resident, current account and **both** pointer documents, checks both pending queues (including imported requests without pointers), and commits the proposal, pointer and every family row together. A rejected operation writes nothing. The identity/address/household on the live resident document remains unchanged until staff approval. Contact and photo remain editable during a pending correction.

The request queues retain owner/requester identity snapshots and server timestamps. No browser-supplied UID, role, owner, reviewer stamp or status controls the write. The boundary verifies the token/project and rechecks the account's resident role, active/archive and onboarding state inside each write transaction. It preserves the PHP validation order/messages and database column bounds. A malformed calendar date uses the existing birthdate prompt. Family payloads over Firestore's 500-write atomic limit fail without a partial request; there is no staged large-family fallback.

## Photo handling

The existing cropper still produces its 320 px square JPEG and retains its zoom/drag/preview behavior. The service resizes the **whole crop**, without upscaling, to at most **256 × 256 px**. It tries JPEG quality 0.86 down to 0.16 until the encoded image is at most **60 KiB (61,440 bytes)**. The base64 data URL is at most 81,943 characters including its prefix. Object URLs are revoked after processing.

The server independently checks valid JPEG metadata, square dimensions, maximum dimensions and decoded byte size. The prototype rules accept the optional bounded field on existing resident documents but require it to remain unchanged on SDK updates; photo writes pass through the trusted JPEG validator. New client-created resident documents cannot inject a photo. No Storage or Cloud Functions are used.

Imported `profileImages` photos continue displaying until replacement/removal. The profile preview and account chip use the new resident value, including after reload and first-login/password-reset gates. The existing trusted header response supplies the own photo value; it does not grant client access to the rest of a first-login resident's profile.

## Emulator verification

From `frontend`, with the existing Auth/Firestore suite running:

```sh
npm run test:profile:running
npm run test:auth:running
npm run build:hosting
npm run test:rules:running
```

`npm run test:profile:emulators` starts fresh Auth/Firestore emulators when no suite is already running. The runner starts/stops the loopback PHP/Vite servers; ports 5173 and 8787 must be free. `PHP_BINARY` and `CHROME_PATH` can override their existing defaults. Run emulator suites sequentially.

The profile Chrome/API suite checks immediate contact edits, empty/invalid contact and PHP whitespace semantics, original birthdate/name/address/family messages and validation order, required and overlong address parts, temporary address proposals, spouse/children/parents/references, custom titles, blank child omission, every browser request modal, pending live-record immutability, all correction types competing for one slot and imported pending records without pointers. It also checks imported-photo fallback, actual crop/confirm/upload, resident-document JPEG dimensions/bytes, reload/header rendering, invalid/oversized images, confirmed removal, spoofed ownership, direct rules bypasses, lifecycle gates and phone layout. It blocks production Firebase and legacy API requests and removes only its randomly named synthetic records/accounts/audit events.

The existing reset-based rules runner snapshots/restores the user's emulator documents and identities in memory. Its preservation check confirms all 273 original documents and seven original Auth identities remain after regression fixtures are removed. Final check counts are recorded in `docs/progress.md`.

## Deployment boundary

This task is emulator-only: no Firebase deployment, real-data change, MySQL write or service-account-key access. The PHP endpoint is `api/firebase/resident-profile.php`; `frontend/public/firebase-profile.php` is copied into both builds. Production needs the same trusted PHP hosting and injected short-lived OAuth token already required by the authentication bridge. Static Firebase Hosting cannot execute PHP. Live database edition, index deployment and production routing remain unverified. Rules remain a prototype requiring review before broad release.
