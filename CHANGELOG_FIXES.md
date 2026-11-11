# Fix log — v32 (Get Started button / login page)

## The reported symptom
On the landing page, **Get Started** did nothing. Clicking it appeared to
reload the same page instead of opening a login screen.

## What was actually wrong
The button was not broken. It was pointing into a redirect that came
straight back:

```
index.php  --[Get Started]-->  resident/login.php  --[redirect]-->  index.php
```

`resident/login.php`, `staff/login.php` and `admin/index.php` were all stubs
whose only job was to redirect to `index.php`, because at an earlier point in
the project `index.php` *was* the login page.

When `index.php` was later restyled into the public landing page, the sign-in
form was removed from it — but the stubs were never repointed, and the login
form was never rebuilt anywhere else. The result:

* the round trip above, which looks exactly like a dead button, and
* **no login form existed anywhere in the codebase.** `index.php` still
  carried the full POST authentication handler at the top of the file, but
  nothing on the site could ever POST to it. The system had working
  authentication logic and no way to reach it.

## What changed

### 1. `login.php` (new, at the site root)
The real login page, carrying both portals on one screen:

* **Resident Account** — signs in with a Resident Number (`R-YYYY-NNNN`)
* **Admin & Staff** — signs in with a username

The authentication handler was moved here from `index.php`, unchanged in
behaviour: same password checks, same deactivated-account messages, same
first-login and profile-completion redirects, same `login_history` logging,
same session regeneration.

One deliberate change: the portal is now chosen explicitly instead of guessed.
The old handler read one identifier box and searched *both* tables, then used
the `R-YYYY-NNNN` format to break ties when an identifier existed in both.
Each submission is now checked against exactly one table, so a staff username
can never resolve to a resident record or the other way round.

### 2. `index.php`
* Orphaned POST handler removed — it now lives in `login.php`.
* **Get Started** points at `login.php`.
* Added a **Sign In** link in the header, so a visitor does not have to scroll
  to the bottom of the page to find the way in.
* The redundant JS click-handler on the button was removed. The button is a
  plain `<a href>`, which navigates without JavaScript; the decorative pen
  animation can now fail without affecting it.

### 3. Redirect stubs
| File | Was | Now |
|---|---|---|
| `resident/login.php` | `../index.php` | `../login.php?portal=resident` |
| `staff/login.php` | `../admin/index.php` | `../login.php?portal=staff` |
| `admin/index.php` | `../index.php` | `../login.php?portal=staff` |

These still exist because `require_resident_login()` and
`require_staff_login()` in `config/functions.php` call `redirect('login.php')`
relative to the current folder. Session guards keep working untouched.

### 4. `assets/css/style.css`
Appended a section for the sign-in page: portal tabs, the two-column layout,
the header Sign In button, and mobile breakpoints. Nothing existing was
edited or removed. The card itself reuses the `.login-card`, `.input-wrap`
and `.btn-block` rules that were already in the file.

## Database
**No changes required.** Every column the login reads already exists in
`database/barangay_survey.sql`, and `config/db.php` adds any missing column
automatically on page load.

## Verified
Tested against PHP 8.3 + MariaDB 10.11 on a freshly dropped database:

* landing page loads, Get Started resolves to `login.php`
* admin sign-in (`admin` / `admin123`) reaches the staff dashboard
* resident sign-in reaches the resident dashboard
* wrong password gives an identical message whether or not the account exists
* a Resident Number typed on the Admin tab suggests switching tabs
* logout, and any guarded page without a session, land on the login page
* every PHP file passes `php -l`; no warnings or notices in the server log
