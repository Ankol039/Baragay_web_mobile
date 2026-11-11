# Public repository preparation

Destination: https://github.com/Ankol039/Baragay_web_mobile.git (`main`).

This source snapshot was prepared from the integrated web/mobile worktree on 11 November 2026. New publication commits use Ankol030 <bartolomejulianasamara396@gmail.com>.

The original Git repositories, worktrees, commits, uncommitted files and remotes are preserved locally. This candidate starts a separate history because the original history includes SQL resident/staff records and password hashes. It must not be published with the original ancestors. Legacy SQL is retained as schema only. Credentials, real environment files, personal exports/uploads, screenshots containing account information, dependencies and caches are excluded.

The integrated source includes the current JavaScript Worker conversion and member-app work. Original PHP remains reference/runtime compatibility source. Separate feature-worktree variants remain untouched locally; their content is not silently substituted into this integration snapshot.

This preparation verifies source checks; it does not deploy Firebase, change production data or prove all live/mobile flows. Public push requires approval of the separate source-only history.

## Validation on the publication copy

- React: lint, production build, five survey validator tests and two runtime unit tests pass. Existing large-bundle advisory remains.
- Expo: lint, nine unit tests and Android/iOS/web exports pass. Physical-device checks and Expo Doctor were not rerun.
- Migration: lint, syntax build and 21 synthetic unit tests pass.
- JavaScript backend: syntax checks for 29 modules and one account-data unit test pass.
- Secret scanning: Gitleaks 8.30.1 checked the candidate and original integration history. Original scanner findings were synthetic test credentials, a checksum and a Firebase project-ID comparison; no privileged key/token was detected. SQL row/password-hash review independently blocked publishing the original history.
- No emulator reset, production write/deploy or credential-file access was performed. Installed dependency packages were reused for checks; fresh network installation was not tested.

Two integration files changed after the fixed snapshot was captured: `api/firebase-js/member-app.mjs` and `docs/member-app/tools/redesign.py`. Those later edits remain in the original worktree. The candidate is a captured source snapshot, not an assertion that ongoing development has completed.
