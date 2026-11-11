# Migration verification

Run: 10 Nov 2026, 20:43:30 Asia/Manila (UTC+08:00). Target: **local Emulator Suite only**.

Result: **PASS — all source-table and collection counts match; required relations intact**.

This report contains counts only. Exported rows, identifiers, emails, names, IPs, file paths, credentials, hashes and per-user outcomes remain in ignored migration/out/.

## MySQL snapshot → primary Firestore collection counts

| MySQL table | Expected rows | Imported documents | Match |
| --- | ---: | ---: | --- |
| residents | 4 | 4 | PASS |
| staff | 3 | 3 | PASS |
| surveys | 5 | 5 | PASS |
| survey_questions | 16 | 16 | PASS |
| survey_choices | 12 | 12 | PASS |
| responses | 5 | 5 | PASS |
| survey_results | 16 | 16 | PASS |
| resident_children | 1 | 1 | PASS |
| resident_character_references | 4 | 4 | PASS |
| resident_update_requests | 100 | 100 | PASS |
| resident_family_requests | 0 | 0 | PASS |
| resident_delete_requests | 0 | 0 | PASS |
| staff_update_requests | 0 | 0 | PASS |
| resident_residency_changes | 0 | 0 | PASS |
| login_history | 69 | 69 | PASS |

## Every collection and subcollection

| Collection group / parent | Expected | Actual |
| --- | ---: | ---: |
| residents | 4 | 4 |
| staff | 3 | 3 |
| surveys | 5 | 5 |
| surveys/questions | 16 | 16 |
| surveys/questions/choices | 12 | 12 |
| responses | 5 | 5 |
| responses/answers | 16 | 16 |
| residents/children | 1 | 1 |
| residents/characterReferences | 4 | 4 |
| nameAddressRequests | 100 | 100 |
| familyRequests | 0 | 0 |
| deletionRequests | 0 | 0 |
| staffRequests | 0 | 0 |
| residencyRecords | 0 | 0 |
| loginHistory | 69 | 69 |
| users | 7 | 7 |
| identifierAliases | 8 | 8 |
| profileImages | 0 | 0 |
| pendingRequests | 21 | 21 |
| counters | 2 | 2 |
| familyRequests/children | 0 | 0 |
| familyRequests/characterReferences | 0 | 0 |

## Required relationships and exact content

Checked every migrated document: **273**. Values and Timestamp types match the transformed plan (counter values may safely be higher).

| Relation | Checked | Broken |
| --- | ---: | ---: |
| Response → survey + resident + resident user | 5 | 0 |
| Question → survey | 16 | 0 |
| Choice → question | 12 | 0 |
| Answer → response + owned question/choice | 16 | 0 |
| Family person → resident | 5 | 0 |

## Authentication method

Auth users expected/imported: **7/7**.

| Method/result | Accounts |
| --- | ---: |
| BCRYPT import attempted (original PHP hash bytes) | 7 |
| BCRYPT payload accepted by importUsers | 7 |
| BCRYPT retained as the final credential | 0 |
| Identifier temporary-password fallback | 0 |
| Emulator-only temporary password after accepted BCRYPT payload | 7 |
| Existing matching migration accounts reused without password reset | 0 |

Temporary credential/disabled-state checks against local Auth: **7**. Every temporary credential has isFirstLogin=true in its matching user document.

The local Auth emulator accepts imported hash payloads but does not perform BCRYPT password verification. Accepted BCRYPT payloads were therefore replaced **only in the emulator** with the identifier temporary password and isFirstLogin=true. This is not evidence that production rejects PHP bcrypt. Production will first try BCRYPT and fall back only on a hash-related rejection/unsupported source hash. No production Auth account was touched.

## Number sequences

Resident maximum suffix: **4**; staff maximum suffix: **3**. Counters retain at least these values, so the next allocation continues the global sequence without annual reset.

## Source-data issues preserved

| Issue | Count |
| --- | ---: |
| Source photo references with missing local file (not fabricated) | 1 |
| Historical requests whose owner was already removed in MySQL (preserved) | 99 |
| Pending requests for removed owners (review required before production) | 20 |
| Historical audit actors already removed in MySQL (preserved) | 9 |
| Non-ASCII usernames requiring MySQL collation review | 0 |
| Legacy family proposals without a reference (review required) | 0 |

Missing image bytes are not invented: image document count equals readable, successfully compressed files, not stale photo_path references. Orphan request/audit rows retain deterministic historical UIDs; no fake resident/staff accounts are created. Source data is unchanged. These issues require review before a real migration; the production gate rejects unacknowledged warnings.

## Rerun and scope

Idempotency check: **PASS** — second import wrote 0 new documents, advanced 0 counters, and reused 7 Auth users without changing passwords.

MySQL was read in a repeatable-read, read-only consistent snapshot without executing config/db.php. Admin SDK imports bypass client Security Rules; the separate rule regression suite tests client authorization. A dry run writes only to local emulators. No real Firebase import, deployment, production credential read, MySQL write or destructive cleanup was performed for the emulator run.
