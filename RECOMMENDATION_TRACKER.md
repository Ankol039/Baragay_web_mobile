# Recommendation Tracker — Activity 6

Barangay Health Center Survey Management System
Response to Group 4's recommendations (incorporating Group 3's)

**Status as of this build:** 130 recommendations reviewed · 111 done · 0 to add · 5 declined · 14 not applicable

**Runtime audit (batch 9):** 4 defects found and fixed against a live MariaDB + PHP 8.3 environment. See the end of this document.

---

## 1. Done in this build (batch 1)

Eight items closed in this pass, on top of the 72 already satisfied by v7.

| # | Item | Portal | Where |
|---|------|--------|-------|
| 1 | Philippine timezone set for PHP and MySQL — fixes the one-day-off date | All four | `config/db.php` |
| 2 | Password toggle on the login page | All four | `index.php` |
| 3 | Password-recovery route stated on the login page | All four | `index.php` |
| 4 | Placeholder text darkened (`#9aaaa4` → `#6f817b`) for contrast | All four | `assets/css/style.css` |
| 5 | Contact number rejects letters — browser pattern + server check | Staff, Admin, both Resident | `resident/profile.php`, `staff/resident_management.php`, `config/functions.php` |
| 6 | Address fields capped at sensible lengths, per field | Staff, Admin, both Resident | same three files |
| 7 | Reports: "Generated on" stamp, per-question denominators, and zero-count rows for yes/no and rating | Staff, Admin | `staff/reports.php` |
| 8 | Results: "Based on N responses" on multiple-choice and yes/no | Staff, Admin | `staff/results_dashboard.php` |
| 9 | Edit Survey: "Back to Survey List" moved to the top left | Staff, Admin | `staff/edit_survey.php` |

Two housekeeping fixes went in alongside: the commented-out `sidebar-footer` blocks were deleted from both headers, and the live database password in `config/db.php` was replaced with a placeholder.

## 2. Done in batch 2 (25)

Every remaining applicable recommendation is now implemented.

### Staff / Admin — survey building (8)

| Item | Where |
|------|-------|
| Edit an existing question, keeping answers attached to unchanged choices | `staff/question_management.php` |
| Reorder questions with up/down arrows, auto-renumbered after a delete | `staff/question_management.php` |
| "Remove Choice" button on every choice row | both builders + `assets/js/script.js` |
| On-screen note that blank choice boxes are ignored on save | both builders |
| "Preview Survey" modal showing the resident's view before publishing | `staff/add_survey.php` |
| Unsaved-changes warning (`data-dirty-warn`) | `assets/js/script.js`, applied to survey and profile forms |
| Title and description quality check — rejects "qwerty", "aaaa", too-short text | `config/functions.php` (`valid_written_text`), used by add and edit |
| Required-field asterisks, character limits, and helper text | `staff/add_survey.php`, `staff/question_management.php` |

Also fixed while in there: **"+ Add Choice" did nothing at all on the Add Question modal** — the button existed but no handler was bound on that page. Both builders now share one delegated handler, which is also why the "adds two choices" report can never come back.

### Staff / Admin — reports, results, dashboard (5)

| Item | Where |
|------|-------|
| Searchable survey selector on Reports | `staff/reports.php` |
| Searchable survey selector on Results | `staff/results_dashboard.php` |
| Search open-text answers per question | `staff/results_dashboard.php` |
| Submission date shown on each open-text answer, 20-row cap lifted to 200 | `staff/results_dashboard.php` |
| Date-range filter on the 30-day chart, re-fetching without a page reload | `staff/dashboard.php`, `staff/ajax_stats.php` |

### Staff / Admin — layout (5)

| Item | Where |
|------|-------|
| Add Choice and Remove Question separated, with a bordered question header | `assets/css/style.css` (`.question-row-head`) |
| Save Changes matched to its neighbours via a shared action row | `.form-actions`, min-width 170px |
| Print Report given the same button class as the export link | `staff/reports.php` |
| Add Resident and Edit Resident forms widened | `.modal-wide`, 860px |
| Questions numbered live as they are added or removed | `staff/add_survey.php` |

### Resident portals (7)

| Item | Portal | Where |
|------|--------|-------|
| Confirmation before discarding a request form | Both | `assets/js/script.js` |
| Form cleared on cancel so it reopens empty | Both | `assets/js/script.js` |
| Available Surveys split into "Waiting for your answer" and "Already answered" | Both | `resident/surveys.php` |
| Sidebar sub-labels distinguishing the two survey pages | Both | `includes/header_resident.php` |
| Empty profile fields offer the action instead of a dash | Both | `resident/profile.php` |
| **Temporary residents can request a temporary-address correction** | Temporary | `resident/profile.php`, `staff/address_requests.php`, `config/db.php` |
| Sidebar collapses under browser zoom instead of overflowing | Both | `assets/css/style.css` |

The temporary-address work spans three layers: eight new columns self-heal onto `resident_update_requests`, the request form shows the temporary block only for temporary residents, and approval writes the parts back with the same "don't wipe what wasn't submitted" guard the permanent address already had.

## 3. Declining (5)

| Item | Reason |
|------|--------|
| Confirmation prompt on Logout | Friction on a security action; users expect logout to be immediate. A "You have been signed out" notice on the login page gives the same reassurance. |
| Breadcrumbs on every page | Dashboards are top level; "Dashboard › Dashboard" is noise. Detail pages already carry back links. |
| Search/filter inside the stat-detail tabs | Fixed short lists. Adds chrome without value at current data volume. |
| "No other responses recorded" note on a sparse chart | The chart already renders a real empty state when there is nothing to plot. |
| Remove residents' ability to update their own information | **Confirmed by the group.** The intended behaviour is exactly what is built: a resident who notices an error on their own account can adjust the details and send them to staff or admin for approval. Nothing is changed on the record until it is reviewed. Removing the feature would delete that route. |

## 4. Not applicable (14)

> **Six of these were reclassified in batch 12** and are now built. Group 3's
> recommendations named fields our system genuinely lacked; the group decided to
> add them rather than leave them out, so Spouse, Children, Parents, Occupation,
> Hotline and Character References moved from "not applicable" to done. They are
> listed under batch 12 at the end of this document. The remaining items below
> stay not applicable, because they describe form mechanics our build does not
> use rather than data it was missing.

### Describes a system that is not ours (6)

Group 3's "Add New Resident" section reviewed a different build. Our Add Resident is a single scrollable modal with Personal, Address and Family sections.

- Combine multi-tab form into one scrollable form — already one form
- Remove the Age field — already auto-calculated, read-only, from birthdate
- Impossible dates such as February 31 — blocked by `type="date"` with `max`
- Purok dropdown needing revised options — Purok is a free-text address part
- Employer Address asterisk — no employer field; occupation is recorded instead
- Duplicate stepper-plus-tabs progress indicators — no stepper exists
- Two logout buttons — only one is live; the sidebar copy was already commented out (now deleted)

### Homescreen items (3)

There is no landing page. `index.php` is the login.

- Careers / Contact / Privacy Policy / Terms of Service links
- Twitter and GitHub links
- Multiple "Get Started" buttons

### Premised on two login pages (4)

`index.php` is the single login for all roles. `admin/index.php`, `staff/login.php`, and `resident/login.php` are redirect stubs.

- "Back to Admin Login" link
- "Switch Account Type" control
- Rename the heading to "Resident sign in" for parity with "Staff sign in"
- Consolidate the two login interfaces into one — already done

### Bug reports that do not reproduce (3)

- "Add Choice adds two choices" — one listener per row, one input per click. The form starts with two blank choice fields, which is likely what was observed.
- "Participation rate: 133%" — the value is clamped 0–100 in PHP before it reaches the gauge, and the panel note defines the metric.
- Stray `#login-section` fragment — the string appears nowhere in the codebase.

---

## Notes for the group

All 105 applicable recommendations are implemented. The remaining 25 entries in the PDF are 5 declined with reasons and 20 that describe a system other than ours.

Two items were found during the review rather than in either group's list, and both are fixed: the non-functional "+ Add Choice" button on the Add Question modal, and the temporary residents' inability to request a correction to their temporary address.

## Batch 3 — group's own change requests (not from the PDF)

| Change | Portal | Where |
|--------|--------|-------|
| Removed "Still to answer" / "Your past answers" sidebar sub-labels | Both resident | `includes/header_resident.php` |
| Removed the residency badge from the dashboard welcome line | Both resident | `resident/dashboard.php` |
| Login Activity now shows Admin vs Staff, and Permanent vs Temporary Resident | Admin | `config/functions.php` (`login_type_label`), `staff/dashboard.php`, `staff/stat_detail.php` |
| Residency start date required, with a 6-month minimum before Permanent status | Staff, Admin | `staff/resident_management.php`, `config/functions.php`, `config/db.php` |

The sidebar sub-labels and the welcome badge were themselves batch-2 items answering Group 4's "clearer labels" recommendation. The group overruled them, so the tracker records them as reverted by request rather than outstanding.

## Batch 4 — residency lifecycle

| Change | Where |
|--------|-------|
| **Fixed the ArgumentCountError on Edit Resident** — bind_param had 30 type characters for 31 variables. Present in v7 too (29 vs 30), so editing a resident had never worked. Both statements now build the type string with `str_repeat()`. | `staff/resident_management.php` |
| Make Permanent: the temporary address becomes the permanent one, the old permanent address is archived, temp fields clear | `staff/resident_management.php` |
| Revert to Temporary: the archived address is restored and the lived-at address goes back to temporary; a written reason is required | `staff/resident_management.php` |
| Residency Records page listing every move with the archived address, reason, author and timestamp | `staff/residency_records.php` (new), admin nav |
| New table `resident_residency_changes` (22 columns, self-healing) | `config/db.php` |

Both actions are admin-only and transactional. The resident portal needed no change: it keys the temporary sections off `residency_status` and `temp_*`, so the temporary address disappears on promotion and returns on reversion automatically.

Verified against a live MariaDB: promote then revert round-trips both addresses to their exact original values, and the portal shows/hides correctly at each step.

## Batch 5 — group's change requests

| Change | Portal | Where |
|--------|--------|-------|
| Remove Photo button, reverting to the initial-letter avatar; file deleted from disk too | All four | `staff/complete_profile.php`, `resident/profile.php` |
| Sidebar item renamed to "Registered Resident" | Admin, Staff | `includes/header_staff.php` |
| **Fixed: promote/revert did nothing.** The modals were rendering inside an `if (!$can_delete)` branch, so an admin never received them. Relocated to top level. | Admin | `staff/resident_management.php` |
| Row icon buttons removed; the action now sits under Residency Status inside the Edit Resident form, labelled "Make Permanent Resident" or "Revert to Temporary Resident" to match the saved status | Admin | `staff/resident_management.php` |
| Residency Records now saves (follows from the fix above) and shows status now, the change made, and the resident | Admin | `staff/residency_records.php` |
| Recent Logout Activity panel and Sign-outs by Portal | Admin | `staff/dashboard.php`, both `logout.php` |
| Portal breakdowns split residents into permanent and temporary | Admin | `staff/dashboard.php` |
| Staff Requests section hidden from staff; admin only | Staff, Admin | `staff/address_requests.php` |

Two new `login_history` columns: `event` ('login'/'logout') and `account_role`, which stores Admin / Staff / Permanent Resident / Temporary Resident at the moment of the event so old rows do not get relabelled when someone's residency later changes.

## Batch 6 — group's change requests

| Change | Portal | Where |
|--------|--------|-------|
| Admin split onto its own rail, above Staff portal, in both Sign-ins and Sign-outs by Portal | Admin | `staff/dashboard.php` |
| Made Permanent and Reverted to Temporary are now clickable, filtering Change History to that kind of move, with a back link out | Admin | `staff/residency_records.php` |
| Survey answer options rebuilt as 48px tappable rows with a drawn radio dot | Both resident | `resident/survey_form.php`, `assets/css/style.css` |
| 1–5 scale: selected value is now a filled primary block, 56px, instead of bold text | Both resident | same two files |
| PWD / Senior Citizen / Pregnant each require their supporting number, enforced in the browser and on the server | Admin, Staff | `staff/resident_management.php`, `config/functions.php`, `config/db.php` |

One new column, `residents.category_reference` (varchar 60), holding the PWD ID, Senior Citizen ID, or the doctor's PRC licence number depending on the category selected. Choosing None clears it.

## Batch 7 — group's change requests

| Change | Portal | Where |
|--------|--------|-------|
| **Fixed: "Yes, Continue" did nothing on Remove Photo.** The shared confirm modal only knew how to follow a link, and the trigger is a submit button, so the proceed link resolved to `#`. It now submits the owning form. | All four | `assets/js/script.js` |
| PWD, Senior Citizen and Pregnant reference fields show their official format under the box, with browser and server validation | Admin, Staff | `config/functions.php`, `staff/resident_management.php` |

Formats enforced:

- **PWD** — `RR-PPMM-BBB-NNNNNNN`, e.g. 03-1408-000-0000123
- **Senior Citizen** — `SC-00-000000`, e.g. SC-26-004512
- **Pregnant** — doctor's PRC licence, six or seven digits, with or without the "PRC No." / "License No." prefix

No database change in this batch.

## Batch 8 — setup robustness

Fixed: `Unknown database 'barangay_survey_system'` fatal error after the database is dropped.

| Change | Where |
|--------|-------|
| Connect to the server first, then `CREATE DATABASE IF NOT EXISTS`, then select it | `config/db.php` |
| The eight base tables are created if absent, so an empty database becomes a working system on first load | `config/db.php` |
| First administrator seeded (`admin` / `admin123`) only when the staff table is empty | `config/db.php` |
| Each schema check wrapped in try/catch, so one failed migration logs instead of blanking the site | `config/db.php` |

The project no longer needs `database/barangay_survey.sql` at all. It is kept for reference and for the sample survey data.

### Needs testing before submission

The changes are syntax-clean but have not been run against a live database. Worth checking on XAMPP:

1. Question reorder and edit, including editing a question that already has answers recorded
2. A temporary resident submitting a temporary-address change, and an admin approving it — the eight new columns are created on first page load
3. The date-range filter on the dashboard chart
4. The unsaved-changes prompt, on both a survey form and a resident request form

## Batch 9 — runtime audit against a live database

The build was run end to end against MariaDB 10.11 and PHP 8.3: schema booted from an
empty database, every page crawled while signed in, and the survey lifecycle exercised
with real submissions. Four defects surfaced that static checking had not.

| Fix | Severity | Where |
|-----|----------|-------|
| **An empty submission locked the resident out of the survey.** Posting the form with nothing filled in created a response row, recorded no answers, and moved the survey to "Already answered" — permanently spending the resident's single attempt on a survey they never answered, and adding a phantom response to the participation figures. Answers are now read and validated *before* any row is created, and a submission with no valid answer is refused with an explanation. | High | `resident/submit.php`, `resident/survey_form.php` |
| **"Answer surveys only once" had no database guarantee.** A comment in `submit.php` claimed a UNIQUE key enforced it; no such key existed, and two identical rows inserted without complaint. The application check is a SELECT followed by an INSERT, so a double-clicked Submit could pass it twice. A real unique key on `(survey_id, resident_id)` now self-heals into place, collapsing any duplicates already recorded, and a 1062 collision is handled as the success it is from the resident's side. | High | `config/db.php`, `resident/submit.php` |
| **A database outage produced a fatal error with a stack trace.** `@new mysqli(...)` followed by a `connect_error` check cannot work on PHP 8 — mysqli throws, and `@` does not suppress exceptions, so the check was unreachable and server paths were exposed on any connection failure. The connection is now caught, and an unreachable database ends the request with a 503 and a plain explanation. | Medium | `config/db.php` |
| **A survey could be created with no questions.** The guard tested `empty($questions)` while blank question boxes are dropped later, so a single empty question box satisfied it. The check now counts questions that actually carry text. | Low | `staff/add_survey.php` |

Rejecting out-of-range answers came with the submission rewrite: a rating of 99 or a
yes/no of "Maybe" used to be written to the database verbatim, and is now discarded.

### Verified working in the same pass

Booting from a dropped database rebuilds all twelve tables, the unique index and the
seed administrator on one page load. All PHP files lint clean. Every staff, admin and
resident page returns 200 with no warnings or notices, both empty and with real data
loaded. All four question types — multiple choice, yes/no, rating, short answer — build
and save into their correct columns. Survey opening and closing dates, duplicate
prevention, the resident answer history and its CSV export, and Philippine time on both
PHP and MySQL all behave as documented.

`database/barangay_survey.sql` has been re-exported from the live schema, so the dump
now matches what the self-healing block produces instead of trailing it. The three
superseded fragment dumps have been removed. One portability note: five `mb_*` calls
require the mbstring extension, which XAMPP enables by default — worth confirming on
InfinityFree, as its absence is a fatal error rather than a degraded page.

## Batch 10 — group's change request: residency status is no longer editable from the edit form

**Requested:** remove the Residency Status dropdown from Edit Resident on the Registered
Resident page, because changing it did not save into Residency Records. Keep the
Make Permanent / Revert button in the same form. Leave the dropdown alone on Add Resident.

The report was accurate, and the cause was in the code's own comment: *"Changing the
dropdown only relabels the record."* Saving the edit form wrote `residency_status`
straight to the column. Nothing moved the addresses across, nothing archived the old one,
and nothing was written to `resident_residency_changes` — so a status changed that way
left no trace in Residency Records and could not be undone.

| Change | Where |
|--------|-------|
| Dropdown replaced with a read-only badge showing the saved status | `staff/resident_management.php` |
| The edit handler now reads the status from the stored record and ignores any posted value | same |
| **Removed an orphaned `update_status` POST endpoint** — no form used it, but it changed the column directly with no logging, the same silent path by another route | same |
| Temporary Residence block now shows/hides from the saved status instead of the removed dropdown, keeping the disable-while-hidden behaviour | same |
| Residency-duration note falls back to the badge when there is no dropdown, so the Add form and the Edit form both keep it | same |
| Read-only status styled to line up with the inputs beside it | `assets/css/style.css` |

### A lockout avoided while making the change

The six-month rule was written to guard the dropdown: it refused any save where the status
was Permanent and the residency was too short. With the dropdown gone that check would have
trapped the administrator — a permanent resident whose start date sits under the minimum
could never have *any* field edited, because there was no longer a way to set Temporary from
this form to satisfy the rule. The check now applies only when the start date is actually
being changed, so a contradictory new date is still refused while existing records stay
editable.

### Verified against the live database

Posting `residency_status=permanent` by hand to the edit form leaves the resident temporary
and writes no log row, while the rest of that same submission saves normally. Promotion moves
the temporary address into the permanent fields, clears the temporary ones, archives the old
permanent address and records the move. Reverting restores both addresses and the residence
type to their exact prior values and records that too — a full round-trip. Add Resident still
creates a temporary resident from its dropdown. All staff and admin pages return 200 with no
warnings; PHP lints clean, CSS braces balance, JS parses.

## Batch 11 — group's change request: Age display and optional license number

**Requested:** an Age display box beside the Birthdate field on the staff account setup
form, and a text box — not required, no asterisk — where staff can record a PRC or CSE
license number.

Both were added to `staff/complete_profile.php`, the "Step 2 of 2" form the new hire fills
in at first login. That is where Birthdate lives, and where a staff member enters their own
details; the administrator's Add Staff Account modal stays an employment record only, as its
own instructions say.

| Change | Detail |
|--------|--------|
| Age display box | Read-only, sits beside Birthdate, phrased as "37 years old" |
| License Number box | Optional, no asterisk, 50 characters, placeholder naming PRC and CSE |
| `staff.license_number` column | Added through the self-healing block, `varchar(50)` nullable |

**Age is never stored.** It is worked out from the birthdate every time it is shown, because
a stored age is wrong from the next birthday onwards. The server renders the opening value so
the box is correct before any script runs, and the script keeps it in step as the date is
changed — the same approach already used for residents.

**An empty license box is stored as NULL**, not an empty string, so "no license" and "not
filled in yet" do not become two different kinds of nothing in the database. The value is
checked for length and restricted to letters, digits, spaces, hyphens and slashes, which
covers both `PRC 0123456` and `CSE-2019-004521`.

### Verified against the live database

The column self-heals onto an existing `staff` table on the first page load. A new staff
account was created through Add Staff Account, signed in with its issued Staff Number, and
the setup form saved a license number, cleared it back to NULL, and rejected both an
overlong value and one containing markup. Age rendered as "37 years old" from a birthdate of
4 March 1989 with scripting out of the picture. The field carries no `required` attribute and
no asterisk. All staff, admin and resident pages return 200 with no warnings; PHP lints clean
and the inline script balances.

## Batch 12 — group's change request: broken filters removed, family details added

### Part 1 — search bars

The "Find a Survey" boxes above the survey dropdowns on Reports and Results were
removed. They never worked, and the reason is worth recording: the filter rebuilt the
entire `<select>` on every keystroke. That threw away the current selection and fought
the `onchange` that submits the form, so choosing a survey after typing did nothing at
all. The dead JavaScript behind them was removed with them.

The real search bars stay. All of them already matched on both an ID and a name —
Registered Residents and Resident Accounts search resident number plus full name,
Residency Records searches resident number plus name, Surveys searches title and dates.
**Staff Accounts had no search bar at all**, so one was added, matching on staff number,
username and full name.

### Part 2 — family and household details on the resident record

Six recommendations that had been recorded as not applicable are now built, on both the
Add Resident and Edit Resident forms and shown on the resident's own profile.

| Section | Behaviour |
|---------|-----------|
| Occupation | Free text, not a dropdown — "Student", "Tricycle driver" and "OFW - seafarer" all have to fit |
| Hotline Number | Optional, no asterisk. Accepts `8XXX-YYYY`, `(02) 8XXX-YYYY`, `(0XX) XXX-YYYY` and mobile numbers |
| Spouse | Yes/No on "Is this resident married?". Yes reveals surname, first, middle and extension |
| Children | Yes/No, then one or more names with an "Add another child" button |
| Parents | Father's and Mother's names, optional, four parts each |
| Character References | **Required, at least one**, for temporary and permanent residents alike, with "Add another reference" |

### Database changes

All through the self-healing block in `config/db.php` — nothing to import.

**Sixteen new columns on `residents`:** `occupation`, `hotline_number`, `is_married`,
`spouse_last_name`, `spouse_first_name`, `spouse_middle_name`, `spouse_name_extension`,
`has_children`, and four each for `father_*` and `mother_*`.

**Two new tables**, because children and character references repeat and a resident may
have any number of either:

```
resident_children                 resident_character_references
  child_id       (PK)               reference_id   (PK)
  resident_id    (FK, CASCADE)      resident_id    (FK, CASCADE)
  last_name                         last_name
  first_name                        first_name
  middle_name                       middle_name
  name_extension                    name_extension
  display_order                     display_order
  created_at                        created_at
```

Storing these as numbered columns would cap how many can be recorded and leave most of
them empty. Storing them as one comma-joined string is what caused the resident address
bug earlier in this project, where a value containing a comma could not be told apart
from two values. `ON DELETE CASCADE` means removing a resident takes their children and
references with them instead of leaving rows pointing at nobody.

### Design notes

**An answer of No clears what is behind it.** Choosing "not married" wipes any spouse
name already typed, and choosing "no children" removes the child rows, so a stray name
cannot survive on a record that says there is none. The hidden fields are disabled as
well as hidden, which stops the browser blocking submission over a `required` field
nobody can see and stops a stale value being posted.

**Rows are renumbered on the client.** Removing the middle of three children rewrites
`children[2][...]` to `children[1][...]`, so the list stays a proper sequence rather than
gaining a hole. Blank rows are dropped server-side, so adding a row and changing your
mind costs nothing.

**Both forms share one file.** `includes/family_fields.php` renders the sections for Add
and Edit alike, with an id prefix keeping the two apart on a page that holds both, so the
two forms cannot drift out of step.

### A bug found and fixed during testing

The first hotline pattern rejected `(02) 8123-4567` — one of the formats the request
specifically named. The `(02)` branch allowed a two-to-three digit area code but then
expected only three or four digits after it, which the eight-digit Metro Manila number
does not match. The pattern was split into explicit branches and re-checked against
fourteen cases covering every documented format plus malformed ones.

### Verified against the live database

Creating a resident without a character reference is refused. A full creation saved a
spouse, two children and two references in entry order, with parents, occupation and
hotline. Answering No to married cleared the spouse name; answering No to children
removed the rows. A reference with a surname and no first name is refused by position
("Character reference 1 needs a first name"). All three documented hotline formats save;
`12345` does not. The resident's own profile shows every field, with children and
references numbered. Deleting a resident cascades to both tables. Promotion still moves
addresses and writes to Residency Records, with the family data intact afterwards.
Dropping the whole database and loading one page rebuilds all fourteen tables, the
sixteen new columns, the unique response index and the staff license column. All staff,
admin and resident pages return 200 with no warnings; PHP lints clean, CSS braces
balance, JavaScript parses.

## Batch 13 — group's change request: placeholders, stray div, deletion request display, wording

### 1. Example text in every input

Text boxes that only had a label now carry an example, so the form can be filled in
without reading the notes underneath it. Two shared definitions do the work, which keeps
the Add form, the Edit form and the resident's own request forms in step:

- `person_name_parts()` carries the example for each name part — Surname "e.g. Dela Cruz",
  First Name "e.g. Juan", Middle Name "e.g. Santos", Extension "e.g. Jr, Sr, III". Used by
  spouse, children, parents and character references alike.
- `address_field_placeholders()` is new, and gives each address part a Philippine example:
  "e.g. 1623 or Blk 13 Lot 3", "e.g. Purok 3", "e.g. Rizal Street", "e.g. Anyatam",
  "e.g. San Ildefonso", "e.g. 3010", "e.g. Bulacan". The labels alone left real doubt —
  Purok and Street / Highway / Subdivision / Village both take a name, and it was not
  obvious which one a subdivision belonged in until an example sat in the box.

Birthplace, email, contact number, survey title, question text and the login box were
given examples individually. Ninety-three placeholder attributes render on Registered
Residents alone.

### 2. Stray `</div>` in resident_management.php

Removed. The `temp-residence-block` had already closed on the line above, so the extra
tag closed the form's own wrapper early. Rendered output now balances at 175 open and
175 close; the file went from 82 closing tags to 81.

### 3. Deletion Requests — Status and Action

**The administrator's note read as part of the status.** It rendered as a bare unlabelled
line directly under the badge, so a note of "Byebye" appeared to be the reason the request
was approved — sitting one column away from the staff member's actual reason. It is now
labelled "Administrator's note:", with a separate line above it reading "Approved by
[name] · [date]". That date comes from `reviewed_at`, which was already being written on
every decision and had never been shown.

**The Action column showed a bare dash**, which read as a missing button rather than a
finished request. It now says what became of the account:

| State | Admin sees | Staff sees |
|-------|-----------|------------|
| Pending | Approve / Reject buttons | Awaiting admin |
| Rejected | Resident kept | Resident kept |
| Approved, still deleted | **In Deleted Accounts** (link) | Moved to Deleted Accounts |
| Approved, then restored | Account restored | Account restored |
| Record purged | Record removed | Record removed |

Staff have no Deleted Accounts page, so they get the wording without the link.

**The restore marker is no longer glued to the note.** `deleted_accounts.php` appends
"[Account later restored.]" to the end of `review_comment`; that text is stripped for
display and shown as its own Action state instead. The page also joins the resident row,
so it reports the true current state from `deleted_at` rather than trusting a marker that
might be missing.

**No database changes.** The join uses columns that already existed.

### 4. Wording

- Occupation hint now reads: Type it in full. Put "N/A" if they are not working or studying.
- Hotline hint and the validation error both end at "…for example Pampanga (045) 123-4567."
  Both come from `hotline_format_hint()`, so the two cannot drift apart. The pattern still
  accepts a mobile number; it is simply no longer advertised, since removing acceptance
  would reject numbers already on file.

### Verified against the live database

Approving with a note of "Byebye" renders as "Approved by Barangay Health Officer ·
Aug 19, 2026 1:42 PM" with "Administrator's note: Byebye" labelled beneath it, and an
Action of "In Deleted Accounts" that links. Restoring the account changes Action to
"Account restored" with the marker stripped from the note. A rejection shows "Resident
kept". The staff portal shows the same wording with no admin-only link. Twelve admin
pages, six staff pages and five resident pages all return 200 with no warnings. Dropping
the database and loading one page rebuilds all fourteen tables and the seed
administrator. PHP lints clean, CSS braces balance, JavaScript parses.


## Batch 14 — group's change request: Address Requests label, Edit Resident family fields

### 1. "Processed" removed from Address Requests

The last column showed "Processed" or "Closed" once a request had been decided. The
Status column two cells over already says Approved or Rejected, so the word repeated
information without adding any, and there is no action left to offer. The cell is now
empty for decided requests. "Closed" went with it, since leaving one and removing the
other would have made the column inconsistent.

### 2. Edit Resident lost the character references and turned into Add Resident

Two separate faults, both real, and they compounded each other.

**The Edit modal never loaded the family data.** It is filled in by JavaScript from a
lookup built by `SELECT * FROM residents`, without reloading the page. Children and
character references live in their own tables, so that query could never return them —
and the JavaScript did not set occupation, hotline, spouse or parents either. Every Edit
therefore opened with the whole Family section blank, however much the resident had on
file. Saving then failed on "at least one character reference is required" for a resident
who already had one.

*Fixed by* carrying `children` and `references` into the lookup for each resident, and
populating the whole section on open: occupation, hotline, spouse, parents, both Yes/No
answers with the block behind each one revealed to match, and the repeatable rows rebuilt
from the stored records with their field names correctly indexed. A resident with none on
file still gets one empty row to type into.

**A failed update reopened the Add form.** `$form_had_error` drove the Add Resident modal
whichever form had been submitted, and edit mode was established only from `?edit=` in the
URL — which a form post does not carry. So a failed update dropped the person into a blank
Add Resident form, with the button reading "Add Resident" and everything they had typed
gone.

*Fixed by* recording which form failed and reopening that one, and by re-reading the
resident from `$_POST['resident_id']` when an update fails, so the form stays pointed at
the right person while the error is corrected.

**No database changes.** Both faults were in how existing data was loaded and displayed.

### 3. Placeholder insertion — already resolved

Raised in case it was outstanding. It was a note about how batch 13 was built, not a
defect left in the code: the affected files were restored and redone with exact string
matches at the time, and all PHP lints clean with every placeholder rendering as an
attribute inside its input tag. The note has been removed from batch 13, as a record of
tooling trouble does not belong in a document about the system.

### Verified against the live database

Opening Edit for a resident with a spouse, one child and one character reference was
tested in a real DOM: occupation "Head Teacher", hotline, spouse "Mario Santos", father
"Pedro", the married answer ticked Yes with its block revealed, and both repeatable rows
rebuilt as `children[0][first_name]=Miguel` and `references[0][first_name]=Elena`. A
resident with no references on file opens with one blank row and the spouse block hidden,
with nothing carried over from the previously opened resident. Submitting an update with
the references cleared now reopens the **Edit** modal with the button still reading
"Update Resident", `resident_id` intact and every submitted value in place. A failed add
still reopens the Add modal. A valid update saves two references in order. Twelve admin
pages and five resident pages return 200 with no warnings; PHP lints clean and JavaScript
parses.

## Batch 15 — group's change request: dashboard charts for all four portals

Six charts were added to the Admin and Staff dashboards and three to the Resident
dashboard, drawn in the same Chart.js setup and `.db-panel` grid the existing dashboard
already used, so nothing new was introduced structurally.

### Why these charts

The Add Resident form had grown a great deal — birthdate, gender, priority group,
occupation, purok, and the marital and children answers — and **none of it was shown back
anywhere**. Staff were typing in details that returned nothing. Every new chart reads a
field that was already being collected.

Nothing duplicates what was there. The existing panels cover surveys, responses,
participation, residency mix, question types and sign-in activity; the new ones cover the
people, which had no representation at all.

### Admin and Staff — Resident Demographics

| Panel | Chart | Reads |
|-------|-------|-------|
| Age Groups | Vertical bars | `birthdate`, banded in SQL so no stored age can drift |
| Gender | Ring | `gender`, with unrecorded shown rather than dropped |
| Priority Groups | Ring | `special_category` — PWD, senior, pregnant |
| Common Occupations | Horizontal bars | `occupation`, top seven, "N/A" and "None" filtered out |
| Residents by Purok | Horizontal bars | `purok`, top seven |
| Household Make-up | Vertical bars | `is_married` and `has_children` |

Every query is scoped to `deleted_at IS NULL`, so a deleted resident stops counting
immediately instead of quietly inflating the barangay's figures. The whole section is
skipped when no residents are on file rather than rendering six empty frames.

### Resident — personal panels, and they differ by residency status

| Panel | Chart | Shows |
|-------|-------|-------|
| Your Activity | Vertical bars | Their own submissions per month over six months, empty months included so a quiet month reads as a gap |
| Towards Permanent Status *(temporary)* / Your Residency *(permanent)* | Half-ring gauge | Months completed against the minimum before permanent status can be recorded |
| On Your Record | Ring | Spouse, children and character references recorded alongside them |

This is where the two resident portals finally differ in substance. A temporary resident
sees how far through the minimum they are, with the months still to go and a note that
reaching it does not change their status on its own — barangay staff record that. A
permanent resident sees how long they have been registered. Each panel is left out when it
has nothing behind it, so a new account shows a shorter dashboard rather than empty frames.

No resident query reaches across to anybody else's record: a resident sees their own
household and their own activity, never the barangay's.

### CSS

The new panels inherit `.db-panel` wholesale and only adjust what the charts need: chart
heights step down at 900px and again at 560px so a six-panel row stacks instead of
squeezing each chart to nothing, a chart above a key-value list gains a dividing rule, and
panels no longer break across a page when printed. The stylesheet cache-buster was moved
from `v=27` to `v=28`, without which browsers would serve the old file and none of it
would appear.

### No database changes

Every figure comes from columns that already existed.

### Verified against the live database

Nine residents of varied ages, genders, priority groups, occupations and puroks were
created, and each chart was confirmed to instantiate with the right data by running the
rendered pages through a real DOM with Chart.js stubbed — not by reading the markup. The
admin dashboard builds eleven charts, the staff dashboard the same eleven without the
administrator band, the permanent resident four and the temporary resident three, with no
duplicate canvas ids anywhere and no clash with the existing charts. Deleting every
resident leaves the dashboard at 200 with the demographics section correctly absent.
Thirteen admin pages, four staff pages and ten resident pages return 200 with no warnings;
PHP lints clean, CSS braces balance and JavaScript parses.

## Batch 16 — group's change request: residency note, family edit requests, full name format

### 1. The residency note is gone

"How long you have been registered with the health center." was removed from the permanent
resident's dashboard panel. Only the temporary panel keeps a note now, because it has to
explain what its gauge is counting towards; once a resident is permanent the heading and
the dates below say everything, so the line was repeating the panel back to itself. This
was checked through an actual promotion: a temporary resident showed the note, was promoted
through the six-month rule, and the panel became "Your Residency" with no note at all.

### 2. Residents can now request family & household changes

The card had no way to correct anything. It now carries a Request Change button, and the
form behind it is **the same shared partial the Add Resident form uses**, so a resident is
offered exactly the fields staff record and the two cannot drift apart.

Nothing is written on submission. The proposal goes to staff and an administrator decides,
matching the name and address flow already in place. Approving applies the whole set inside
a transaction — the columns on the resident row and the children and character reference
rows together — because a half-applied family record would be worse than none. Rejecting
changes nothing and returns a note to the resident.

Only one request may be open at a time. A queue of competing proposals for the same record
would leave staff deciding which of them is current, so a second submission is refused
while one is pending.

### 3. Family members are recorded and shown the way the resident is

Profile Overview lists Courtesy Title, Full Name, First Name, Middle Name, Surname,
Extension Name and Gender, each in its own box. A spouse or a character reference is a
person too, so all five kinds — spouse, father, mother, each child, each character
reference — are now collected and displayed identically, in their own separate boxes.

**Full Name is never stored.** It is composed from the parts every time it is shown, so it
cannot disagree with the parts it is built from — the same reasoning that keeps Age derived
from birthdate rather than saved.

One definition in `person_field_spec()` drives the Add Resident form, the Edit Resident
form, the resident's request form, the staff review screen and the resident's profile, so
none of the five can fall out of step with the others.

### Database changes — all self-healing, nothing to import

**Six columns on `residents`:** `spouse_courtesy_title`, `spouse_gender`,
`father_courtesy_title`, `father_gender`, `mother_courtesy_title`, `mother_gender`.

**Two columns on each repeatable table** — `resident_children` and
`resident_character_references` both gain `courtesy_title` and `gender`.

**One new table**, `resident_family_requests`:

```
request_id       resident_id (FK, CASCADE)   payload (JSON)
reason           status                      requested_at
reviewed_at      reviewed_by                 reviewed_by_name
review_comment
```

The proposal is held as JSON rather than as a mirror of every family column. Children and
character references repeat, so a column mirror would need its own child tables and would
have to be extended again for every field added later. The payload is written and read by
one pair of functions and rendered for review server-side.

### Three bugs found and fixed while building

**The new columns would not have appeared on a fresh install.** The `resident_children` and
`resident_character_references` ALTERs were placed in the first migration pass, which runs
before those tables are created further down the same file — on a new database they would
have found no table and been skipped silently. Moved to the second pass, and confirmed
present after dropping the whole database and rebuilding.

**The repeatable-row JavaScript only handled `input`.** Courtesy title and gender are
dropdowns, so "Add another" would have left a previous person's title stuck on a fresh row,
and renumbering would have posted the selects under the wrong index. Both places now handle
`input, select`.

**"Add another" added the row to the wrong form.** It looked its group up with a
page-wide `document.querySelector`, and Registered Residents renders the Add and Edit forms
together — so pressing the button in one form silently added the row to the other. It is
now scoped to the form the button sits in, proven in a real DOM with both forms present.

The stylesheet and script cache-busters were moved to `v=29` and `v=15`; without that,
browsers would serve the old files and none of this would appear.

### Verified against the live database

Dropping the whole database and loading one page rebuilds all fifteen tables with every new
column present. A resident added through the Add form with courtesy title and gender on the
spouse, both parents, a child and a character reference saves all six fields for each, and
the resident's own profile shows every one of them in the seven-row format. A change request
left the record untouched until approval, then applied the occupation, hotline, a corrected
child extension name and an added second character reference in one go; a rejection changed
nothing. A second request while one is pending is refused, as is one with no reason or no
character reference. Thirteen admin pages and five resident pages return 200 with no
warnings, with no duplicate element ids anywhere on the page. PHP lints clean, CSS braces
balance and JavaScript parses.

## Batch 17 — group's change request: errno 121 crash, and "Others" on family courtesy titles

### 1. The fatal error creating resident_family_requests

```
Uncaught mysqli_sql_exception: Can't create table
`barangay_survey_system`.`resident_family_requests` (errno: 121 "Duplicate key on write or update")
```

**Cause.** InnoDB requires foreign key *names* to be unique across the whole database, not
just within a table, and a name can outlive the table it belonged to — a half-finished
CREATE, or a table dropped while the server was busy, leaves the name claimed. The table
was being created with `CONSTRAINT fk_family_request_resident`, so on a database where
that name was already taken the CREATE failed with errno 121 and took the site down on
every page load, because `config/db.php` runs on every request.

This was reproduced exactly: claiming the name on another table made the old form of the
statement fail with the identical error message.

**Fix.** The foreign key is no longer named — InnoDB picks a name it knows is free, which
came out as `resident_family_requests_ibfk_1`. If creation still fails with the key, the
table is created without it and the failure is logged rather than thrown: the cascade is a
convenience for tidying up after a deleted resident, and deletions already go through code
that clears these rows, so a working site without the cascade beats a fatal error with it.

The same treatment was applied to `resident_children` and `resident_character_references`,
which were written the same way and carried the same risk.

**No schema change is needed to recover.** Replacing the folder is enough; the table is
created on the next page load. Verified by leaving the name deliberately squatted and
loading the site — 200, no fatal, table created with the cascade intact.

### 2. "Others" on every family member's Courtesy Title

The four listed titles left no room for an Engr. or an Atty., which the resident's own
courtesy title had always allowed. Spouse, father, mother, every child and every character
reference now carry the same **Others** option with a box to type into, in the Admin and
Staff Add and Edit forms, and in the resident's own change request form.

- The literal word "Others" is never stored. `resolve_courtesy_title()` turns it into
  whatever was typed, so nobody is recorded with "Others" as a title.
- A stored title that is not one of the four selects Others and reappears in the box, so
  reopening a form shows what was saved rather than dropping it silently to blank.
- Choosing a listed title again clears the box, so a leftover value cannot override it.

**No database change.** `courtesy_title` is already `varchar(20)` everywhere and holds a
free-text title without alteration.

### A bug found and fixed during testing

Restoring a custom title into a repeatable row left the box holding the value while staying
hidden. `applyTitle` fires a change event and the handler that shows the box is delegated
from the document, so a row still detached from the page never reached it. The row is now
appended before its title is restored. Caught by driving the Edit modal in a real DOM and
reading back the visibility of every box, not by reading the markup.

### Verified against the live database

A resident added with Engr. on the spouse, Atty. on the father and Dr. on a child stores
those exact titles, not "Others". Reopening Edit puts each back with Others selected and
the box visible and filled; switching one back to a listed title clears the custom value.
The resident's own profile shows them in the seven-row format, a change request carries
them through the payload, the staff review screen displays them, and approving writes them
to the record. Dropping the whole database rebuilds all fifteen tables with all three
foreign keys present. Thirteen admin pages and five resident pages return 200 with no
warnings; PHP lints clean, CSS braces balance, JavaScript parses. Cache-busters moved to
CSS `v=30` and script `v=16`.
