# Baseline and backend resolution

11 November 2026. Requested scope: resolve the dirty-baseline and PHP-runtime decisions, then revise the remaining work plan. This is not an instruction to execute all feature packages.

## Safe source baseline

Use branch **`codex/firebase-baseline`** for new feature/integration worktrees. Its parent is `147d83b`, the original React conversion commit. The branch is created using a separate temporary Git index. The original checkout stays on `main`; its real index, existing deletions, locally modified protected files, private exports and environment files are not reset, restored or staged.

The baseline combines current React/Firebase/API/migration source, relevant current docs, dependency lockfiles and environment examples with the original PHP/reference assets from the parent commit. Those reference files are present in a clean checkout of the branch even though they remain missing in the user's original dirty checkout. It is not a claim that the local 1,292 pre-existing deletions were accidental or that they were reversed in place.

Original `config/functions.php` is retained from the parent in the baseline, rather than committing the locally reduced version. The local file has only deletions (218 lines, 13 functions); no new helper functions. The retained original is the PHP reference and supplies the unchanged functions used by Firebase. The current protected file is not modified. Verify behavior in the baseline's clean copy, not by silently replacing the user's file.

`config/db.php` is intentionally omitted from the new branch tree to avoid including local database credentials. It remains untouched in the original checkout and historical parent. Firebase runtime does not include it. Historical PHP is reference material, not a runnable legacy deployment in this baseline. A future authorized MySQL export from a clean worktree can use the migration tool's already-supported `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_PORT` process environment, or the existing original checkout; never copy credentials into committed files. This does not rewrite or sanitize Git history.

Old generated `app/` bundles, obsolete evidence directories, local ZIPs, `.DS_Store`, dependencies, environment files and `migration/out` are excluded from the baseline. No existing local files are deleted to achieve that. `.gitignore` prevents these from being accidentally added later. Installed project skills/local plugin metadata are not runtime source and are not swept into the branch.

The safe baseline can be inspected with `git show --stat codex/firebase-baseline` and its exact revision with `git rev-parse codex/firebase-baseline`. Create future worktrees from that branch; do not create them from the old dirty `main` and assume current Firebase work is included. Do not merge the baseline's source/evidence selection back into the original checkout as a blanket cleanup.

## Backend decision implemented (later superseded)

The original baseline resolution retained a PHP API for local completion. After the user explicitly requested a PHP-free React/Firebase deployment, they superseded that choice on 11 November 2026: **React web + Expo resident app + existing Firebase Auth/Firestore + trusted JavaScript API on Cloudflare Workers Free + React site on Firebase Hosting**. Original PHP screens/handlers remain behavior references and local parity tools; they are not the production server runtime.

Reports, Accounts and Expo are implemented and integrated. The approved live Firestore import and rules/index deployment are complete. The JavaScript Worker route smoke and Hosting build pass. The local demo/test references may still run the PHP router for historical source parity; see the [current runtime contract](firebase-runtime-contract.md) for production API routing, environment configuration and remaining deployment gates.

## Remaining work

No feature package or attached prompt needs to be rerun. Cloudflare CLI authentication/secrets, Worker deployment, Firebase Hosting deployment, and read-only production API/site checks remain. The user confirms the Expo Go app opens, while native feature flows/media evidence are not claimed complete. Use the [current release sequence](firebase-runtime-contract.md); fixed-port emulator suites remain sequential.

Validation results and exact baseline revision are reported with this task's completion. No service account key is accessed, no MySQL data is written, and no live Firebase operation is authorized by this resolution.

## Verification performed

| Check | Actual result |
| --- | --- |
| Main working copy frontend lint, standard build, emulator demo build | PASS; existing bundle-size warning |
| Frontend identifier/formatter/shared-validator tests | PASS, 25 tests |
| Migration lint, syntax build and synthetic tests | PASS, 21 tests |
| New standalone built-runtime browser/security test | PASS, 26 checks; synthetic fixtures cleaned |
| Candidate baseline extracted into a clean temporary source directory | PASS; current Firebase source and original PHP/assets present; no config/db.php, exports, env files or generated deployment tree |
| Clean baseline frontend lint and demo build | PASS |
| Clean baseline standalone runtime, auth and Prompt 8 checks | PASS: 26 + 95 + 177 checks, using original PHP helpers and no database credential file |
| Existing state-preserving emulator rule regression | PASS, 21 tests / 150 assertions; original documents and identities restored |
| Dependency lockfile consistency, candidate credential-pattern scan, docs links/format and PHP syntax | PASS |
| User's original index and protected local config bytes | Unchanged; main remains the checked-out branch |

The clean-copy checks reused the installed dependency folders through temporary symlinks; they did not perform a fresh network install. Lockfiles remain synchronized. These results describe the initial baseline task only; current device, live-project and deployment status appears in the most recent [progress entries](progress.md).
