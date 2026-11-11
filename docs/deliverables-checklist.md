# Submission deliverables and final gates

## Five required items

| Deliverable | Actual artifact / run route | Current status |
| --- | --- | --- |
| Migrated React website | frontend/ + trusted api/firebase/ + same Firebase project; npm --prefix frontend run demo:emulators | Implemented; integrated local regressions pass |
| Expo resident mobile app | mobile/; Expo Go via documented private-LAN gateway and Metro launcher | Implemented; 35 real-service Expo web checks and platform exports pass; physical iPhone pending |
| Firebase data structure | firestore.rules, firestore.indexes.json, docs/firebase-migration.md and migration-report.md | Deployed to the existing real project; 273 documents/seven Auth accounts verified; 29 indexes READY |
| Screenshots | docs/evidence/expo-web/*.png use synthetic data; docs/evidence/web-public/*.png show anonymous public pages | Six Expo web-target captures plus three anonymous website captures present; actual phone and authorized real console screenshots pending |
| Video presentation | Script below; final exported recording path must be added | Script prepared; actual final video pending |

A source ZIP candidate can be generated with `python3 docs/build-submission.py /private/tmp/barangay-firebase-submission.zip`. It makes an allowlisted copy and manifest, never deletes working files, excludes credentials/private exports/SQL data/uploads/env files/dependencies/bundles and verifies ZIP integrity. A candidate ZIP is not a completed submission while required evidence is pending.

## Numbered screenshot list

1. Shared website sign-in with no tabs and original branding.
2. Resident website dashboard, available surveys and stat detail.
3. All four question types and a successful website submission.
4. Website resident profile/contact/photo and a protected-field correction request.
5. Website staff survey/question management, results, report/chart and CSV evidence.
6. Website registered resident and request-review/archives flow, filtered to synthetic records only.
7. Actual iPhone Expo Go registration/login and issued Resident Number.
8. Actual iPhone profile/photo and a correction/family request.
9. Actual iPhone survey submission, confirmation and history.
10. Same synthetic response visible in both the website and actual iPhone history/results.
11. Real Firebase console collections/document schema after approved migration; hide personal fields.
12. Real Firebase deployed rules/index state and test results with counts-only summaries.

Existing Expo web screenshots are useful automated UI evidence but cannot be relabeled as iPhone captures. Never capture personal resident data, passwords, tokens or service-account contents.

## Video script (approximately six minutes)

| Time | Demonstration / narration |
| --- | --- |
| 0:00–0:35 | Name the system and original PHP/MySQL workflow; show the React/Expo/shared-Firebase architecture, including the trusted API. |
| 0:35–1:10 | Show Firebase collection relationships, sanitized documents and deployed authorization rules; distinguish emulator evidence if real cutover is not complete. |
| 1:10–2:00 | Website resident sign-in, profile/contact and survey submission; show original labels and all question types. |
| 2:00–2:50 | Website staff survey editing, results/chart/report, registered resident and request approval; use synthetic filtered rows. |
| 2:50–4:10 | iPhone Expo Go registration, number sign-in, persisted session, profile/photo and survey completion/history. |
| 4:10–5:05 | Prove bidirectional consistency: phone response on website and website response on phone, plus profile edit in both directions. |
| 5:05–5:40 | Show passing tests and a refused unauthorized action; explain immutable response and protected lifecycle operations. |
| 5:40–6:00 | State actual verification status, known limits and reproducible setup. Do not claim unperformed phone/live checks. |

Record the real demonstration and export a usable .mp4/.webm file; add its absolute artifact path and duration to the final manifest. The table alone is not the video deliverable.

## iPhone check to perform

On the same trusted Wi-Fi, open the provided Metro QR in Expo Go. Confirm app launch, register with synthetic values, save the issued Resident Number, sign out/in, restart Expo Go and confirm persistence, pick/change/remove a photo, submit a four-type survey and verify website visibility. Report exact errors if Expo Go SDK compatibility or network permission blocks opening. Never enter real health data in the local demo.

## Completed live cutover and remaining acceptance

The user explicitly approved deploying rules/indexes and importing the saved snapshot, preserving the 99 ownerless historical requests, nine removed audit actors and one missing-photo reference. The guarded real import passes: 273 exact documents, seven Auth accounts, seven original BCRYPT hashes retained, zero fallback resets, no unrelated data overwritten. The repeat import adds zero documents, advances zero counters and reuses seven accounts. Final deployed rule source matches locally; 29 indexes are READY. See live-migration-verification.md, live-firebase-state.json and live-api-verification.json.

The local real-project runtime now builds separately on port 8788 with server access renewed in a private external token file; eight resident-only real gateway checks pass on port 8793. Twenty-eight actual identity-token/API/rule read checks cover all three roles without Firestore changes. This does not verify unknown original plaintext passwords, a physical phone run or a public HTTPS deployment. Keep the external credential external; public hosting remains optional and must protect and refresh its server credentials.

## Final fresh-copy check

From extracted source, run npm ci in frontend/mobile (and migration for test-only tooling where included), build/lint both apps and follow the run guide. Verify the actual candidate archive contains .env.example files and lockfiles but no real env file, config/db.php, Admin key, database dump, migration/out, personal uploads or old ZIPs. Preserve the original repository untouched. Record missing media or live/device evidence as PENDING rather than final PASS.
