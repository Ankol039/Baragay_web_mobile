# Created completion worktrees

Created 11 November 2026 from `codex/firebase-baseline` (`c66714dcc03402e1ecdd7d964d07d5d6a96e3373`). All four are managed worktrees attached to this chat. The original checkout remains on `main`; no uncommitted changes or private configuration were copied.

| Package | Branch | Absolute workspace |
| --- | --- | --- |
| firebase-reports | `codex/firebase-reports` | `/Users/polmacbook/.codex/worktrees/firebase-reports/barangay_survey_system` |
| firebase-accounts | `codex/firebase-accounts` | `/Users/polmacbook/.codex/worktrees/firebase-accounts/barangay_survey_system` |
| expo-resident | `codex/expo-resident` | `/Users/polmacbook/.codex/worktrees/expo-resident/barangay_survey_system` |
| firebase-integration | `codex/firebase-integration` | `/Users/polmacbook/.codex/worktrees/firebase-integration/barangay_survey_system` |

Reports, Accounts and Expo can implement their packages concurrently. Integration coordinates shared files and merges; Delivery reuses Integration. The selected workspace for this chat is now Integration. No additional chats were created, and no feature agents were started.

Use the shared header and matching package from [the revised work plan](firebase-worktree-batches.md). Each worktree contains original PHP references, current Firebase code, runtime contract and lockfiles. Do not use the old dirty main checkout as a feature baseline.

Dependency folders and private environment files are intentionally absent. Before implementation, run `npm ci` in the worktree’s `frontend/`; install `migration/` dependencies with `npm ci` if its tests are needed. Expo scaffolding/dependency setup belongs to package C. Never copy real `.env` files, database credentials, private exports or a service account key between worktrees.

Existing browser/emulator helpers share fixed ports and some suites reset local fixtures. Run stateful suites one at a time through the coordinator; do not start competing emulator suites in all worktrees. No production operation is included in this setup.

Verification: all four initially clean on their named branches at the approved baseline; required source/reference files present and `config/db.php` absent. The Integration-only setup record/progress change is committed separately, leaving feature worktrees clean. Lint/build and local emulator regression are recorded in progress.
