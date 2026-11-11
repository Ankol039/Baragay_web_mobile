# Migration verification

Run: 11 Nov 2026, 08:51:08 Asia/Manila (UTC+08:00). Target: **explicitly approved production project**.

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
| BCRYPT retained as the final credential | 7 |
| Identifier temporary-password fallback | 0 |
| Emulator-only temporary password after accepted BCRYPT payload | 0 |
| Existing matching migration accounts reused without password reset | 0 |

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

Missing image bytes are not invented: image document count equals readable, successfully compressed files, not stale photo_path references. Orphan request/audit rows retain deterministic historical UIDs; no fake resident/staff accounts are created. Source data is unchanged. The user explicitly approved preserving these source warnings before this production import; no missing owner, image or actor was fabricated.

## Rerun and scope

Idempotency check: **PASS** — second import wrote 0 new documents, advanced 0 counters, and reused 7 Auth users without changing passwords.

This production invocation used the saved, emulator-verified snapshot; it did not re-export or write MySQL. The external user-provided Admin credential was used only server-side. Tested rules/indexes were deployed separately. Admin SDK imports bypass client rules; the client/API suites establish their separate authorization evidence. No source data or unrelated live data was deleted or overwritten. BCRYPT acceptance preserves the original hash; an actual password login still requires a known current credential and is not implied by import success.
