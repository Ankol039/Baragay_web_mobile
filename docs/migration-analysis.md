# PHP to React migration analysis

Analysis date: 2026-11-04 (Asia/Manila). Prompt 1, Part 1: source examination only.

## Scope and evidence

Read `AGENTS.md` and `docs/progress.md` first. Examined the source of every public, resident, staff, and admin PHP page, all `includes/*.php`, `config/functions.php`, and all of `assets/js/script.js`, including page-specific inline scripts. The inventory below accounts for **47 PHP files**. `config/db.php` is identified as a backend dependency; only non-credential configuration/schema references were inspected. No database credentials or account records are reproduced here.

Project folder: `barangay_survey_system`. Configured PHP base URL: `http://localhost/barangay_survey_system/`. The preceding setup verified the XAMPP document root and port but could not connect to port 80. This is a source-based analysis; authenticated browser rendering and live database results have not been verified. Reading PHP source does not execute its includes or initialization queries.

All React component names, React routes, and `/api` paths below are **proposals**, derived from existing code; none exists yet. Keep the PHP's displayed labels, messages, classes, layout, order, limits, and flows. Route paths in this document are relative to a future React mount point, not a proposal to replace the existing PHP document root. Deployment base/fallback configuration remains for a later authorized task. Keep `assets/css/style.css`, `assets/css/Logo.png`, and SVG paths from `includes/icons.php` unchanged. Landing-page inline styles and decorative SVGs also belong to its appearance baseline.

The newer instruction permits **only this new document**. Therefore `docs/progress.md` and `AGENTS.md` are unchanged; the task record and verification are recorded here instead.

## Current sign-in implementation — Prompt 25 (2026-11-08)

This update supersedes the historical login resolution in §§4 and 6 and the login-tab additions recorded in earlier progress/audits. The source inventory and exact PHP ledger below remain historical evidence. The original PHP entry pages and the earlier test/audit files were removed in previously authorised submission cleanup; they have not been restored or edited for this task.

React `/login` now has one form, without Resident Account/Admin & Staff tabs, switch links or tab hints. Old `?portal=` parameters are ignored. The split layout, brand panel, shared CSS/logo, password show/hide, Log In button and forgot-password note are retained. Shared field label: **Resident No. / Staff No. / Username**; placeholder: **e.g. R-2026-0001, S-2026-0001 or admin**; helper: **Enter your Resident Number, Staff Number or username.** One explanatory footnote covers residents signing in with their Resident Number and staff with their Staff Number or username, plus temporary-password setup.

After trimming spaces, the frontend pure function `frontend/src/utils/detectAccountType.js` normalises the ID; the authoritative `api_detect_account_type()` in `api/lib/auth.php` independently selects exactly one lookup:

| Identifier (case-insensitive pattern) | Lookup | Normalisation |
| --- | --- | --- |
| Exact `R-YYYY-NNNN` | `residents.resident_number` only | Uppercase |
| Exact `S-YYYY-NNNN` | `staff.staff_number` only | Uppercase |
| Anything else, including `admin`, `Admin`, staff usernames and malformed `R-2026-001` | `staff.username` only | Trim; preserve username case and existing DB collation |

YYYY and NNNN each contain exactly four ASCII digits. No fallback searches the other table or the other staff identifier column. A reserved Resident Number cannot authenticate a staff username with that spelling. Client-supplied portal/type values have no authority. The existing `looks_like_resident_number()` helper (which accepts longer suffixes) stays unchanged; login uses the new exact rule.

Missing IDs, malformed IDs with no matching staff username, wrong passwords and archived accounts retain **Invalid username/Resident Number or password.** Valid credentials for deactivated accounts retain their original account-specific messages. Session regeneration, existing session identity precedence, `login_history`, first-login password/profile setup and dashboard redirects are unchanged. `authRedirect.js` still derives destinations from the server-returned user.

Current regression coverage replaces the deleted tab-era audits: `frontend/tests/detectAccountType.test.js`, `docs/tests/login-api.php`, and `frontend/tests/login-browser.mjs` with the CLI-only `docs/tests/login-fixtures.php`. The isolated API suite uses literal requested IDs and an in-memory query spy to prove lookup isolation without touching account data. The live suite uses disposable resident/staff/admin-role accounts with distinct passwords and bounded cleanup, including staff-number and username login, legacy query links, generic wrong-password states, and desktop/mobile checks. Setup and run instructions are in `frontend/README.md`.

Reverification — Prompt 28 (2026-11-10): the existing single-form implementation satisfies the repeated request. Strengthened the real-handler spy tests to assert the exact normalized lookup parameter and reject fallback to a colliding staff username when an R- or S-number has no numbered account. Lint/build, 15 Node tests, 188 isolated API assertions, three PHP syntax checks and 129 live Chrome/API checks pass; all three disposable accounts and their 20 login/logout events were cleaned. Literal `admin`/`Admin` use isolated tests; Chrome uses a unique disposable admin-role username. The root `app/` deployment still has its older tabbed bundle; the verified current build is in `frontend/dist/`. Original PHP pages/stubs remain absent from prior authorized cleanup and were not recreated or changed.

## 1. Web sections and component candidates

Each table has the requested three columns. A shared section is described once, then associated with every page that uses it. A page's rows below are its own sections in addition to that shared shell. A backend handler or redirect has no invented visual section.

### Shared resident shell — `includes/header_resident.php`

Used by `resident/dashboard.php`, `resident/stat_detail.php`, `resident/surveys.php`, `resident/survey_form.php`, `resident/confirmation.php`, `resident/history.php`, `resident/view_response.php`, `resident/profile.php`, and `resident/change_password.php`.

| Web section | HTML element | Possible React Component |
| --- | --- | --- |
| Document, stylesheet, portal layout and content outlet | `html`, `head`, `body.portal-layout`, `.app-main`, `.container` | `ResidentLayout`, `PageMetadata` |
| Sidebar brand and residency badges | `aside#app-sidebar.sidebar`, `.sidebar-header`, logo `img`, `.sidebar-role`, `.sidebar-residence-type` | `PortalSidebar`, `Brand`, `ResidencyBadge` |
| Resident navigation | `nav > a.nav-item` for Dashboard, Available Surveys, Submitted Surveys, My Profile, Change Password | `ResidentNavigation`, `NavItem` |
| Responsive drawer | `#mobile-nav-toggle`, `.mobile-nav-close`, `#nav-drawer-backdrop` | `NavigationDrawer` |
| Topbar, mobile brand, avatar and account chip | `.app-topbar`, `.mobile-brand`, `.account-tab`, `button#account-chip`, `img.account-avatar` or initial `span` | `PortalTopbar`, `AccountChip`, `AccountAvatar` |
| Account dropdown | `#account-menu.account-menu`, full name, portal role, My Profile and Logout links | `AccountMenu` |
| First-login alternative header | `.plain-topbar`, logo, title and Logout link; no sidebar/account dropdown | `OnboardingHeader` |

### Shared staff/admin shell — `includes/header_staff.php`

Used by every rendered staff page listed in §2, including admin-only pages; it is not used by JSON/download/redirect handlers.

| Web section | HTML element | Possible React Component |
| --- | --- | --- |
| Document and page outlet | `head`, stylesheet link, `body`, `.app-main`, `.container` | `StaffLayout`, `PageMetadata` |
| Brand, sidebar sections and navigation | `aside#app-sidebar`, logo, `nav`, `.sidebar-section-label`, `.nav-item` | `PortalSidebar`, `StaffNavigation`, `NavItem` |
| Admin navigation counts | `.nav-count` on Deletion Requests and Deleted Accounts; Residency Records/Deleted Accounts links are admin-only | `NavigationCount` |
| Responsive drawer | Toggle/close buttons and backdrop, matching resident shell | `NavigationDrawer` |
| Topbar and account menu | `.app-topbar`, account chip/avatar/initial, `#account-menu`, My Profile, Change Password, Logout | `PortalTopbar`, `AccountMenu`, `AccountAvatar` |
| Onboarding layout variant | Sidebar withheld by `$hide_navbar`; staff topbar remains for signed-in accounts | `StaffLayout` onboarding variant |

### Shared footer and field/icon includes

| Web section | HTML element | Possible React Component |
| --- | --- | --- |
| `includes/footer.php`: portal footer | `footer.site-footer.no-print` with runtime year and system name | `PortalFooter` |
| `includes/footer.php`: action confirmation | `#confirm-modal.modal-overlay`, message paragraph, Cancel and Yes, Continue controls | `ConfirmModal` |
| `includes/family_fields.php`: work/contact | Section headings and occupation/hotline inputs in `.grid-2` | `HouseholdContactFields` |
| `includes/family_fields.php`: married/spouse reveal | Yes/No radios, `.reveal-block`, person fields | `SpouseFields`, `YesNoReveal` |
| `includes/family_fields.php`: children | Yes/No radios, `.person-rows`, `.person-row`, Add another child/Remove | `ChildrenFields`, `RepeatablePersonRows` |
| `includes/family_fields.php`: parents | Father/Mother `.parent-column` and shared field specification | `ParentFields`, `PersonFields` |
| `includes/family_fields.php`: character references | Repeatable reference rows and add/remove buttons | `CharacterReferenceFields`, `PersonFields` |
| `includes/icons.php`: existing SVG icon set | Inline `svg`, generated by `nav_icon()` | `Icon` with unchanged paths/names |

### `landing.php`

| Web section | HTML element | Possible React Component |
| --- | --- | --- |
| Background decoration | `.bg-decor[aria-hidden]` and inline SVGs | `LandingDecoration` |
| Public header and navigation | `header .nav-wrapper`, brand/logo, `nav.nav-menu`, About/Features/Sign In anchors | `PublicHeader`, `Brand` |
| Hero copy | `section.hero .hero-content`, `h1`, descriptive paragraph | `LandingHero` |
| Hero metrics | `.hero-stats > .stat-item`, number and label spans | `HeroStats`, `HeroStat` |
| Hero illustration card | `.hero-visual`, `.hero-icon`, heading and description | `HeroVisual` |
| Benefits | `section#benefits.checklist-section`, section heading, four `.checklist-item` blocks | `BenefitsSection`, `BenefitItem` |
| Security visual | `.checklist-visual` | `SecurityVisual` |
| Features | `section#features`, `.card-grid` with six feature `.card` elements | `FeaturesSection`, `FeatureCard` |
| About, careers, contact | `section#about`, `section#careers`, `section#contact`, headings, text and mail/tel links | `PublicInfoSection` |
| Call to action copy | `.cta-band` heading and paragraph (no registration form/button in this band) | `LandingCallout` |
| Public footer | `footer .footer-wrapper`, brand, Company/Product link columns, `.footer-bottom` | `PublicFooter`, `FooterLinkGroup` |

### `login.php` and POST error rendering in `index.php`

| Web section | HTML element | Possible React Component |
| --- | --- | --- |
| Split authentication layout | `.auth-wrapper > .auth-split` | `AuthLayout` |
| Branding, description and feature bullets | `.auth-brand`, logo, tagline, `h1`, `.auth-points` | `AuthBrandPanel` |
| Heading and validation | `.auth-form-panel`, `h2`, `.auth-form-hint`, `.alert.alert-error` | `LoginPanel`, `InlineAlert` |
| Identifier/password form | `form[method=POST][novalidate]`, identifier input, `.password-field`, toggle, Log In button | `LoginForm`, `PasswordField` |
| Recovery and first-login instructions | `.auth-recovery`, `.auth-footnote` | `LoginHelp` |

### `resident/dashboard.php`

| Web section | HTML element | Possible React Component |
| --- | --- | --- |
| Welcome, action and reminder | `.page-head`, `.page-actions-row`, Answer a Survey link, `.alert-info` | `PageHead`, `PageActions`, `SurveyReminder` |
| Four metrics | `.db-strip > a.db-cell` and final `span.db-cell` | `MetricStrip`, `MetricCell` |
| Your Progress | `.db-panel-primary`, `canvas#chart-completion`, `.db-kv` | `ChartPanel`, `CompletionChart`, `KeyValueList` |
| Survey Overview | `.overview-progress`, `.overview-list` | `SurveyOverview`, `ProgressMeter` |
| Permanent or temporary address | Conditional `.db-panel`, `.db-address-line`, `dl.db-facts` | `ResidentAddressPanel` |
| Conditional activity chart | `canvas#chart-activity` | `ActivityChart` |
| Conditional residency gauge | `canvas#chart-residency-progress`, dates/months facts | `ResidencyProgressPanel` |
| Conditional household chart | `canvas#chart-household-mine` | `HouseholdChart` |
| Closing surveys table | `.db-panel`, `.db-table-wrap > table` | `ClosingSurveysTable` |
| Recent submissions | `ul.db-rank`, empty state, View all submissions link | `RecentSubmissions`, `EmptyState` |

### Resident survey and response pages

| Web section | HTML element | Possible React Component |
| --- | --- | --- |
| `resident/stat_detail.php`: back link, title, subtitle | `.page-head`, `.back-link` | `PageHead`, `BackLink` |
| `resident/stat_detail.php`: count and selected detail table | `.page-actions-row .detail-count`, `.card > table`, badges/actions | `DetailCount`, `ResidentStatTable` |
| `resident/surveys.php`: page heading | `.page-head` and link to Submitted Surveys | `PageHead` |
| `resident/surveys.php`: waiting surveys | `.card`, `.card-head`, count, `table.table-spaced` or empty state | `SurveyListPanel`, `AvailableSurveyRow` |
| `resident/surveys.php`: already answered | Conditional `.card`, table, Answered badges | `AnsweredSurveyPanel`, `StatusBadge` |
| `resident/surveys.php`: submission confirmation | `#submitted-modal` | `SubmissionSuccessModal` |
| `resident/survey_form.php`: survey introduction and errors | `.card`, title, description, `.alert-error` | `SurveyIntroduction`, `InlineAlert` |
| `resident/survey_form.php`: question list | `form#survey-answer-form`, hidden survey id, cards with `data-required-group` | `SurveyAnswerForm`, `QuestionField` |
| `resident/survey_form.php`: multiple-choice/Yes-No answers | `.option-list`, radio inputs and `.option-row` labels | `RadioQuestion` |
| `resident/survey_form.php`: ratings | `.rating-group`, five radio/label pairs, legend | `RatingQuestion` |
| `resident/survey_form.php`: text answers and actions | `textarea`, Submit Survey and Cancel | `TextQuestion`, `FormActions` |
| `resident/confirmation.php`: standalone legacy confirmation | Centered `.card`, check mark, survey title, Back to Surveys | `SubmissionConfirmationPage` |
| `resident/history.php`: title and submitted-survey table | `.page-head`, `.table-responsive > table.table-spaced`, View action/empty state | `SubmittedSurveysPage`, `ResponseHistoryTable` |
| `resident/view_response.php`: breadcrumb and heading | `.page-head.no-print`, `.response-breadcrumb` | `PageHead`, `BackLink` |
| `resident/view_response.php`: response metadata and print/export actions | `.response-print-card`, `.response-header`, `.report-actions`, description | `ResponseHeader`, `PrintExportActions` |
| `resident/view_response.php`: submitted answers | `.submitted-answer-list > .submitted-answer` | `SubmittedAnswerList`, `SubmittedAnswer` |

### `resident/profile.php`

| Web section | HTML element | Possible React Component |
| --- | --- | --- |
| Page heading and feedback | `.page-head`, `.alert-success`, `.grid-2` | `PageHead`, `ProfileLayout`, `ToastHost` |
| Profile Overview | `.profile-card`, name/identity `table.table-spaced`, Request Change | `ResidentIdentityCard`, `DefinitionTable` |
| Personal Details | Card with birthdate/age and request button | `PersonalDetailsCard` |
| Contact and address breakdown | Card, email/contact actions, permanent and conditional temporary address tables | `ContactCard`, `AddressDetails` |
| Family & Household | Card, pending notice, occupation/hotline/marital table, spouse/parents/children/references tables | `FamilyHouseholdCard`, `PersonDetails` |
| Profile Photo | `.photo-card`, photo/placeholder, upload/remove forms | `ProfilePhotoCard` |
| Crop and upload confirmation | `#photo-confirm-modal`, `canvas#photo-crop-canvas`, zoom slider, preview, buttons | `PhotoCropModal` |
| Contact editor | `#edit-contact-modal`, POST form with `data-dirty-warn` | `ContactEditModal` |
| Name/address request | `#request-change-modal`, POST form, name/address inputs and conditional temporary fields | `NameAddressRequestModal`, `PersonNameFields`, `AddressFields` |
| Birthdate request | `#request-birthdate-modal`, corrected date form | `BirthdateRequestModal` |
| Family change request | `#family-request-modal`, included family fields and reason, or pending notice | `FamilyRequestModal`, `FamilyFields` |
| Photo success confirmation | `#profile-success-modal` | `SuccessModal` |

### Password pages — `resident/change_password.php`, `staff/change_password.php`

| Web section | HTML element | Possible React Component |
| --- | --- | --- |
| Heading and first-login instructions | `.page-head`, `.card-form`, `.alert-info` | `PasswordPage`, `OnboardingNotice` |
| Current, new, confirm passwords | POST form, three `.password-field` wrappers, eye buttons | `ChangePasswordForm`, `PasswordField` |
| Live requirements and matching hint | `#password-rules`, `li[data-rule]`, `#match-hint` | `PasswordRules`, `PasswordMatchHint` |
| Success and navigation options | `#password-success-modal[data-keep-on-close]`, Go to Dashboard/Stay Here | `PasswordSuccessModal` |

### `staff/dashboard.php`

| Web section | HTML element | Possible React Component |
| --- | --- | --- |
| Role-specific heading and New Survey action | `.page-head`, `.page-actions-row` | `PageHead`, `PageActions` |
| Five headline metrics | `.db-strip > a.db-cell` | `MetricStrip`, `MetricCell` |
| Responses Received and date range | `.db-panel-primary`, `.db-panel-filter`, date inputs, Apply/Last 30 days, `canvas#chart-trend` | `TrendPanel`, `DateRangeControls`, `ResponseTrendChart` |
| Participation Rate | Gauge canvas, `.db-kv` | `ParticipationPanel`, `GaugeChart` |
| Responses per Survey | `canvas#chart-responses` | `ResponsesPerSurveyChart` |
| Survey Status and Residency Mix | `canvas#chart-survey-status`, `canvas#chart-residency`, facts | `SurveyStatusChart`, `ResidencyMixChart` |
| Completion Rate | `#completion-rate-card`, `.meter-row`, View All toggle | `CompletionRatePanel`, `ProgressMeter`, `ExpandListButton` |
| Surveys table | `.db-table-wrap > table` and result links | `SurveyOverviewTable` |
| At a Glance | `.db-kv` facts | `DashboardFacts` |
| Most Active Residents | `ul.db-rank` | `ResidentRanking` |
| Question Types in Use | `#question-mix`, generated `.db-bars` | `QuestionTypeBars` |
| Resident Demographics heading | `.db-section-head` conditional on resident count | `DashboardSectionHead` |
| Age Groups, Gender, Priority Groups | `#chart-age`, `#chart-gender`, `#chart-priority` canvases | `AgeChart`, `GenderChart`, `PriorityChart` |
| Common Occupations, Residents by Purok, Household Make-up | `#chart-occupation`, `#chart-purok`, `#chart-household` | `OccupationChart`, `PurokChart`, `HouseholdChart` |
| Admin Accounts & Access | `.db-admin`, second metric strip | `AdminAccessPanel` |
| Admin login/logout tables | Recent Login Activity/Recent Logout Activity panels | `AccountActivityTable` |
| Admin portal breakdowns | Sign-ins/Sign-outs by Portal `.db-bars` | `PortalActivityBreakdown` |

### Staff survey, question, results and reporting pages

| Web section | HTML element | Possible React Component |
| --- | --- | --- |
| `staff/stat_detail.php`: back link, heading and count | `.page-head`, `.back-link`, `.detail-count` | `StatDetailPage`, `PageHead`, `DetailCount` |
| `staff/stat_detail.php`: selected view's table | `.card > table`, conditional role/status badges and result links | `StaffStatTable`, `StatusBadge` |
| `staff/survey_management.php`: heading and create action | `.page-head`, `.page-actions-row` | `PageHead`, `PageActions` |
| `staff/survey_management.php`: searchable survey table | `.card`, `.search-field`, `#surveys-table`, action icons | `SurveyManagementTable`, `TableSearch`, `ActionButtons` |
| `staff/add_survey.php`: metadata form | `.card`, `form#survey-builder-form[data-dirty-warn]`, title/description/date fields | `SurveyBuilder`, `SurveyMetadataFields` |
| `staff/add_survey.php`: repeatable question editor | `#questions-container`, `template#question-template`, `.question-row`, `.choices-box` | `QuestionEditorList`, `QuestionEditor`, `ChoiceEditor` |
| `staff/add_survey.php`: save/preview/cancel controls | `.form-actions` | `SurveyBuilderActions` |
| `staff/add_survey.php`: local preview | `#survey-preview-modal`, `#survey-preview-body` | `SurveyPreviewModal` |
| `staff/edit_survey.php`: return link and metadata editor | `.back-link`, `.card`, POST form, status select, feedback, Manage Questions link | `EditSurveyPage`, `SurveyMetadataFields` |
| `staff/question_management.php`: heading, add action and ordered table | Back link, `.card-head`, `table`, move arrows, edit/delete controls | `QuestionManagementPage`, `QuestionTable`, `QuestionOrderControls` |
| `staff/question_management.php`: add question | `#add-question-modal`, form, text/type and choices | `QuestionModal`, `QuestionFields`, `ChoiceEditor` |
| `staff/question_management.php`: edit question | `#edit-question-modal`, hidden id, existing/new choices | `QuestionModal` edit variant |
| `staff/question_management.php`: confirmation | `#question-success-modal` | `SuccessModal` |
| `staff/results_dashboard.php`: heading and survey selector | `.page-head`, GET form/select with onchange submit | `ResultsPage`, `SurveySelector` |
| `staff/results_dashboard.php`: count, period and survey summary | `.stat-card`, survey card/status and Printable Report link | `ResultSummary`, `SurveySummary` |
| `staff/results_dashboard.php`: question breakdowns | `.card`, `.bar-row`, `.bar-track`, `.bar-fill`, `.bar-value`, average rating | `QuestionResultCard`, `ResultBars`, `RatingSummary` |
| `staff/results_dashboard.php`: short answers | Search input, `[data-answer-text]` cards, dates, no-match state | `TextAnswerList`, `AnswerSearch` |
| `staff/results_dashboard.php`: no selection/missing survey | `.empty-panel` or `.alert-error` | `EmptyState`, `InlineAlert` |
| `staff/reports.php`: heading, selector and actions | `.page-head.no-print`, GET form, Print Report, Export to CSV (Excel) | `ReportsPage`, `SurveySelector`, `PrintExportActions` |
| `staff/reports.php`: print report header | `.card`, Barangay Health Center/Survey Report, metadata paragraphs | `PrintableReport`, `ReportHeader` |
| `staff/reports.php`: question result sections | Nested cards, count tables or text lists, per-question response count | `ReportQuestionSection` |
| `staff/reports.php`: no selection/missing survey | `.empty-panel` or `.alert-error` | `EmptyState`, `InlineAlert` |

### `staff/resident_management.php`

| Web section | HTML element | Possible React Component |
| --- | --- | --- |
| Heading, count and Add/Edit buttons | `.page-head`, `.card-head`, `.btn-pair` | `ResidentsPage`, `PageHead`, `ResidentActions` |
| Search and filter tabs | `.table-toolbar`, `.search-field`, `.filter-tabs` | `TableSearch`, `ResidentFilters` |
| Resident records and row actions | `table#residents-table`, badges, edit/reset/toggle/delete/request controls | `ResidentTable`, `ResidentRow`, `ResidentRowActions` |
| Add resident form | `#add-resident-modal`, POST form with personal/category/residency fields | `ResidentFormModal`, `ResidentPersonalFields`, `CategoryReferenceField`, `ResidencyFields` |
| Permanent/temporary addresses | `.grid-2`, `[data-temp-block]` | `AddressFields`, `TemporaryResidenceFields` |
| Family/household fields | Repeated include of `includes/family_fields.php` | `FamilyFields` |
| Edit chooser | `#edit-resident-chooser-modal`, resident select and Show Edit Form button | `ResidentChooserModal` |
| Edit form | `#edit-resident-info-modal`, prefilled form, read-only status badge and admin switch button | `ResidentFormModal` edit variant, `ResidencySwitch` |
| Staff deletion request | `#request-delete-modal`, target text, required reason form | `DeletionRequestModal` |
| Admin promotion | `#promote-resident-modal`, before/after address table, optional note | `PromoteResidentModal` |
| Admin reversion | `#revert-resident-modal`, address restoration summary, required reason | `RevertResidentModal` |
| Operation success | `#resident-success-modal` | `SuccessModal` |

### Account, profile and review pages

| Web section | HTML element | Possible React Component |
| --- | --- | --- |
| `staff/user_management.php`: heading and pending-deletion notice | `.page-head`, feedback, `.alert-info` with review link | `UsersPage`, `PageHead`, `PendingRequestNotice` |
| `staff/user_management.php`: admin staff-account table | `.card`, search, `#staff-accounts-table`, onboarding/status/action columns | `StaffAccountsTable`, `TableSearch` |
| `staff/user_management.php`: resident-account table | `.card`, search, `#resident-accounts-table`, toggle and management link | `ResidentAccountsTable` |
| `staff/user_management.php`: Add Staff Account | `#add-staff-modal`, employment/name/date-hired form | `AddStaffModal`, `StaffEmploymentFields` |
| `staff/user_management.php`: issued Staff Number | `#new-staff-modal[data-keep-on-close]`, `.credential-slip` and instructions | `StaffCreatedModal` |
| `staff/user_management.php`: other operation success | `#user-success-modal` | `SuccessModal` |
| `staff/complete_profile.php`: heading and account record | `.page-head`, `.grid-2`, `.credential-slip`, Admin Record/Staff Record | `StaffProfilePage`, `StaffRecordCard` |
| `staff/complete_profile.php`: photo card/crop confirmation | `.photo-card`, forms, `#photo-confirm-modal` | `ProfilePhotoCard`, `PhotoCropModal` |
| `staff/complete_profile.php`: non-admin profile form | Contact/birthdate/gender/license, address or pending-address notice, emergency contacts | `StaffProfileForm`, `AddressFields`, `EmergencyContactFields` |
| `staff/complete_profile.php`: setup/save/photo/request result | `#profile-success-modal[data-keep-on-close]` | `ProfileSuccessModal` |
| `staff/address_requests.php`: heading and resident-request table | `.page-head`, `.card`, table, immediate approve/reject POST forms | `AddressRequestsPage`, `ResidentRequestsTable` |
| `staff/address_requests.php`: admin staff-request table | Conditional card/table and decision buttons | `StaffRequestsTable` |
| `staff/address_requests.php`: admin review modal | `#staff-review-modal`, note and decision form | `StaffAddressReviewModal` |
| `staff/address_requests.php`: family request cards | Family & Household Requests card, person summaries and inline note/decision forms; currently inside admin conditional | `FamilyRequestsPanel`, `FamilyRequestCard`, `ReviewForm` |
| `staff/address_requests.php`: success | `#address-request-success-modal` | `SuccessModal` |
| `staff/family_requests.php`: alternative family-review screen | `.page-head`, feedback, table, `details/summary`, review forms | `LegacyFamilyRequestsPage`, `FamilyProposalDetails`, `ReviewForm` |
| `staff/deletion_requests.php`: heading and request table | `.page-head`, count/pending badge, reason/reviewer/status/outcome columns | `DeletionRequestsPage`, `DeletionRequestsTable` |
| `staff/deletion_requests.php`: admin decision | `#review-request-modal`, approval warning, note/decision form | `DeletionReviewModal` |
| `staff/deleted_accounts.php`: heading and empty state | `.page-head`, feedback, empty archive card | `DeletedAccountsPage`, `EmptyState` |
| `staff/deleted_accounts.php`: archived residents/staff | Two cards/tables, metadata, response counts, Restore forms, Delete Forever buttons | `ArchivedResidentsTable`, `ArchivedStaffTable`, `ArchiveActions` |
| `staff/deleted_accounts.php`: permanent delete | `#purge-modal`, target/destruction warnings, POST form | `PurgeAccountModal` |
| `staff/residency_records.php`: heading and category metrics | `.page-head`, back link, two linked `.stat-card` elements | `ResidencyRecordsPage`, `ResidencyRecordFilters` |
| `staff/residency_records.php`: audit history | `.card`, search, `#residency-log`, current/change status, archived address, reason/by/when | `ResidencyHistoryTable`, `TableSearch` |

### Non-screen files

| Web section | HTML element | Possible React Component |
| --- | --- | --- |
| `index.php` ordinary GET, `admin/index.php`, `resident/login.php`, `staff/login.php`, `staff/statistics.php` | No rendered body on redirect | Route redirect/loader; no UI component |
| `resident/logout.php`, `staff/logout.php` | No rendered body; event log and session teardown | Logout action; no page invented |
| `resident/submit.php` | No rendered body; transaction and redirect | Survey submission action |
| `resident/ajax_stats.php`, `staff/ajax_stats.php` | JSON only | Data loader/hook, not a component |
| `resident/export_response.php`, `staff/export_csv.php` | CSV attachment only | Download link/action |
| `config/functions.php` | PHP helper logic only | Remains server-side; no React route |
| `config/db.php` | Database/bootstrap initialization only | Remains server-side; no React route |

## 2. Route map and access

Here `staff, admin` means either role in the staff session. Shared shell rules apply as well as individual page handlers. Role labels below describe actual PHP checks, not assumptions from the sidebar. Internal includes/config files intentionally have no browser route. Handler rows map to a proposed API action rather than a fictional screen.

| PHP file | Proposed React route or action | Allowed role / existing condition |
| --- | --- | --- |
| `index.php` | `/` → `/landing` when anonymous; POST uses `/api/auth/login` | Public; signed-in staff/resident go to their dashboard (staff tested first) |
| `landing.php` | `/landing` | Public; no login redirect in this file |
| `login.php` | `/login` | Public; existing sessions redirect to their dashboard |
| `admin/index.php` | Compatibility redirect → `/` | Public; despite folder name, not an admin dashboard |
| `resident/login.php` | Compatibility redirect → `/` | Public; PHP redirects to `../index.php`, then landing for anonymous GET |
| `resident/logout.php` | Resident logout action → `/` → `/landing` | Resident event logging when session exists; handler itself is not guarded |
| `resident/dashboard.php` | `/resident/dashboard` | Resident |
| `resident/stat_detail.php` | `/resident/stat-detail?view=available\|completed\|assigned` | Resident; unknown view → dashboard |
| `resident/ajax_stats.php` | `/api/resident/stats` (no screen) | Resident |
| `resident/surveys.php` | `/resident/surveys?submitted=:surveyId` | Resident; submitted query drives one-time modal |
| `resident/survey_form.php` | `/resident/survey-form?id=:surveyId&error=empty\|failed` | Resident; survey must be open and unanswered |
| `resident/submit.php` | `/api/resident/survey-submissions` (POST action) | Resident; non-POST and invalid/closed/answered survey → surveys |
| `resident/confirmation.php` | `/resident/confirmation?survey_id=:surveyId` | Resident; standalone legacy confirmation remains reachable |
| `resident/history.php` | `/resident/history` | Resident; own responses only |
| `resident/view_response.php` | `/resident/view-response?id=:responseId&print` | Resident; own response only, otherwise history |
| `resident/export_response.php` | `/api/resident/response-export?id=:responseId` | Resident; own response only, otherwise 404 |
| `resident/profile.php` | `/resident/profile` | Resident; changes scoped to session resident |
| `resident/change_password.php` | `/resident/change-password` | Resident; first-login view hides navigation |
| `staff/login.php` | Compatibility redirect → admin entry → `/` | Public; actual chain is `../admin/index.php` → `../index.php` → landing |
| `staff/logout.php` | Staff logout action → `/` → `/landing` | Staff/admin event logging when session exists; no guard in handler |
| `staff/dashboard.php` | `/staff/dashboard` | Staff, admin; Administration section admin-only |
| `staff/statistics.php` | Compatibility redirect → `/staff/dashboard` | No guard in stub; destination requires staff login |
| `staff/stat_detail.php` | `/staff/stat-detail?view=:view` | Staff/admin: `total_surveys`, `active_surveys`, `total_residents`, `total_responses`; admin only: `staff_accounts`, `deactivated_residents`, `deactivated_staff`, `recent_logins`; all other views → dashboard |
| `staff/ajax_stats.php` | `/api/staff/stats?from=:date&to=:date` | Staff, admin |
| `staff/survey_management.php` | `/staff/survey-management` | Staff, admin; create/edit/toggle/delete survey all available |
| `staff/add_survey.php` | `/staff/add-survey` | Staff, admin |
| `staff/edit_survey.php` | `/staff/edit-survey?id=:surveyId` | Staff, admin; missing survey → survey list |
| `staff/question_management.php` | `/staff/question-management?survey_id=:surveyId` | Staff, admin; missing survey → survey list |
| `staff/results_dashboard.php` | `/staff/results-dashboard?survey_id=:surveyId` | Staff, admin |
| `staff/reports.php` | `/staff/reports?survey_id=:surveyId` | Staff, admin |
| `staff/export_csv.php` | `/api/staff/report-export?survey_id=:surveyId` | Staff, admin; missing survey → reports |
| `staff/resident_management.php` | `/staff/resident-management?edit=:residentId` | Staff/admin view/add/edit/reset/toggle/request deletion; admin only direct archive, promote, revert |
| `staff/user_management.php` | `/staff/user-management` | Staff/admin resident list/toggle; admin-only staff list/create/reset/toggle/archive |
| `staff/complete_profile.php` | `/staff/complete-profile` | Staff/admin; non-admin edits own details, admin record read-only except photo |
| `staff/change_password.php` | `/staff/change-password` | Staff, admin |
| `staff/address_requests.php` | `/staff/address-requests` | Staff/admin resident name/address/birthdate review; admin-only staff-address review. Integrated family review handler accepts staff/admin, but family panel is rendered only for admin |
| `staff/family_requests.php` | `/staff/family-requests` | Staff, admin by guard; alternative implementation has unresolved backend dependencies (§7) |
| `staff/deletion_requests.php` | `/staff/deletion-requests` | Staff/admin can read all requests; only admin can decide |
| `staff/deleted_accounts.php` | `/staff/deleted-accounts` | Admin only (`require_admin_login()`) |
| `staff/residency_records.php` | `/staff/residency-records?filter=permanent\|temporary` | Admin only |
| `includes/header_resident.php` | No route; resident layout dependency | Internal include; not an independently authenticated endpoint |
| `includes/header_staff.php` | No route; staff layout dependency | Internal include |
| `includes/footer.php` | No route; shared footer/modal dependency | Internal include |
| `includes/family_fields.php` | No route; shared form dependency | Internal include |
| `includes/icons.php` | No route; SVG helper dependency | Internal include |
| `config/functions.php` | No route; backend helpers | Internal dependency |
| `config/db.php` | No route; existing database/bootstrap | Internal dependency; credentials stay private |

### Navigation and authentication details

- Resident navigation contains Dashboard, Available Surveys, Submitted Surveys, My Profile, Change Password. The account dropdown contains My Profile and Logout. The sidebar shows permanent/temporary residency and, where applicable, residence type. It is hidden on first login; the plain header offers Logout.
- Staff navigation contains Dashboard; Surveys, Results, Reports; Registered Resident, Address Requests, User Management, Deletion Requests. Admin additionally sees Residency Records and Deleted Accounts. Staff account dropdown contains My Profile, Change Password, Logout. Portal-switch links are commented out, so do not add them.
- `require_staff_login()` calls `require_staff_onboarding()`: password first, then profile. Password/profile/logout filenames are exempt from that helper. `complete_profile.php` itself does not redirect an unfinished password back to step 1. Preserve/document this distinction rather than assuming every route has the same gate.
- `require_resident_login()` checks session existence; it does not globally redirect first-login residents to Change Password. Login sends them there, and the resident header hides navigation while first-login is set. Header reads also log out deactivated/archived residents. Staff header logs out archived staff, but has no matching active-status check. These are the observed checks, not stronger inferred ones.
- `require_admin_login()` returns 403 with the existing rendered text: “Access denied. Only Admin accounts can manage staff accounts.” It is also used on archive and residency-history screens, despite that wording.

## 3. Guide questions

### What are the major sections of the webpage?

The public area has a branded navigation header, decorative background, hero and metrics, benefits, feature cards, informational sections, callout, and footer. Sign-in has a split brand/form layout. Both portals have a role-aware sidebar/drawer, topbar/account dropdown, content container, page heading/actions, cards, metric strips, chart panels, tables, forms, feedback, modals, and shared footer. Resident screens emphasize survey participation, own response records, personal/household information and requests. Staff/admin screens add survey/question editing, results/reports, resident/account management, approval queues, archive controls and residency audit history. These sections are conditional: not every page has a metric strip or chart. Result breakdown bars are HTML/CSS, while dashboard charts use Chart.js.

### Which sections could be reused on other pages?

Reuse portal layout, brand/logo, navigation items/drawer, account avatar/menu, page head/back link/actions, cards, metric cells, chart containers, status/residency/role badges, search/filter controls, table framing/empty states, alerts/toasts, confirmation/success modals, print/export controls and footer. Share person/name/title, address, family-member, category-reference, password and photo-crop fields where their shapes match. Keep page/role-specific policy and labels as props/data. For example staff and resident password success wording differs, and an admin's own profile has no staff detail editor.

### Which elements contain repeated content?

Repeated content includes navigation links, landing benefits/features, metrics, survey rows, question/choice rows, result-option bars, submitted-answer cards, ranked residents/activity entries, key/value facts, identity/address table rows, family-person fields/details, children/references, approval records, account rows, archive metadata, feedback overlays, and password-eye SVGs. Add/edit resident forms largely duplicate the same fields. Public login markup/handlers are duplicated between `login.php` and `index.php`. Preserve each conditional state while extracting the shared markup.

### Which parts should become separate React components?

Use the candidates in §1 as small function components with hooks. Each page should compose a layout, data loader, and its section components. Split long pages particularly at dashboard panels, resident personal/address/family field groups, request types, survey question/choice editors, and modal boundaries. Aim below approximately 200 lines per component. Hooks can manage drawer/menu/modal state, table filtering, one-time feedback, crop interaction, dirty-form detection, and chart data; they must not replace PHP authorization, validation, transactions, generated identifiers, survey availability rules, or residency transitions. Keep the existing MySQL data and `config/functions.php` as the server authority.

## 4. Page-by-page behaviour inventory

All rendered portal pages inherit their header's session/account behaviour and `includes/footer.php`/`assets/js/script.js` behaviours in §5. “No form” below means no page-specific form; the shared confirmation modal still exists. Exact source feedback expressions and modal/form identifiers are indexed in §8 so conditional messages are not reduced to generic replacement text.

### Public pages and compatibility entries

- **`landing.php`**: Static content; no PHP handler, form, POST action, session check, flash or modal. About navigation goes to `#benefits`; Features to `#features`; Sign In to `login.php`. Footer links target `#about`, `#careers`, `#contact`, `#features`, `#benefits`; contact/careers use mailto/tel links. Inline IntersectionObserver reveals each `.reveal` once at threshold 0.12 and bottom root margin -8%, applying its numeric `data-delay` before `is-visible`. The callout mentions creating an account, but no self-registration handler/form exists. Do not infer medical-document upload features from marketing copy.
- **`login.php`**: GET renders sign-in. POST to itself accepts trimmed `identifier` and untrimmed `password`; `novalidate` leaves required checks to PHP. Empty fields show “Please enter your username or Resident Number and password.” Both non-archived staff username and resident number are looked up before selecting the account. A collision uses `looks_like_resident_number()` to choose resident vs staff; password is verified against that account only. Staff login rejects inactive accounts with administrator wording; resident login uses Barangay Health Center wording. Missing/wrong credentials share “Invalid username/Resident Number or password.” Successful login regenerates session id, saves identity/role, records login, then sends resident first-login to resident change-password, staff first-login to staff change-password, incomplete staff profile to complete-profile, otherwise the appropriate dashboard. Existing staff session wins over resident session on entry. Inline password-eye JS switches input type/class/aria-label. No self-service reset or registration flow; the recovery paragraph sends users to the health center.
- **`index.php`**: Same authentication POST handler/form/error states as `login.php`, but anonymous non-POST redirects to `landing.php`. Existing sessions redirect first. Its duplicated form uses CSS cache version 30 vs 28 in `login.php`; both reference the same stylesheet. Preserve the browser-visible login route, not the stale stub comments claiming ordinary root GET is a login form.
- **`admin/index.php`**: Includes functions then redirects to `../index.php`; no role check, page content or form.
- **`resident/login.php`**: Redirects to `../index.php`; anonymous GET subsequently reaches landing, despite the comment describing index as a login page.
- **`staff/login.php`**: Redirects to `../admin/index.php`; that redirects to root index, then landing for anonymous GET.
- **`resident/logout.php` / `staff/logout.php`**: Record logout for the matching session id if present, then unset/destroy the entire session and redirect to folder-local `login.php` (with the chains above). No POST form or confirmation is attached to Logout in the header. These scripts do not call login guards.
- **`staff/statistics.php`**: Functions include and unconditional `dashboard.php` redirect. There is no separate statistics screen.

### Resident portal

- **`resident/dashboard.php`**: Guarded GET; no page POST/form/modal. Counts open active unanswered surveys and all own submitted responses. Shows the earliest five available closing dates and latest five submissions. Assigned headline is `available + all answered`, while Assigned detail lists currently open surveys: these are different query definitions. Completion percentage uses the headline denominator. Six calendar-month labels are filled with zeros; source response query starts five months before current date. Own record/family rows determine permanent vs temporary address panel, activity visibility, household chart (spouse/children/references), and residency progress (six-month minimum; automatic progress never promotes status). Four headline cells link to three stat views; closing table links to survey forms; recent list links to history. Loads Chart.js 4.4.4 and fetches `ajax_stats.php` for completion; other chart datasets are embedded by PHP. Charts use unchanged colours, gauges/centre labels, legend, responsive sizing; failed completion fetch logs to console.
- **`resident/ajax_stats.php`**: Guarded GET JSON `{completion:[{label:'Completed',value:answered},{label:'Available',value:available}]}`; session resident only, open/unanswered filter identical to dashboard. No HTML/form/modal/flash.
- **`resident/stat_detail.php`**: GET `view` whitelist `available`, `completed`, `assigned`; unknown/missing → `dashboard.php`. All queries bind session resident id. Available: open unanswered surveys, earliest close first and Answer Survey links. Completed: all own response/survey rows, latest first with Submitted badges. Assigned: all currently open surveys and Answered/Not yet answered state, unanswered first. Count/table/back-to-dashboard; no POST/modal or independent inline JS.
- **`resident/surveys.php`**: GET lists active surveys with today's date inclusively between start/end, newest start first, splitting waiting from already answered. `submitted` looks up a title and opens `submitted-modal` (“Submission confirmed”); no ownership verification on this title lookup. Inline `history.replaceState` removes the query when a title is found so refresh does not reopen it. Answer Survey goes to `survey_form.php?id=...`; history link shows submitted answers. No POST form here. Empty states distinguish no active surveys from all caught up.
- **`resident/survey_form.php`**: GET `id` loads a survey; absent/closed/inactive/already answered → `surveys.php`. Questions ordered by `question_order`, then id; choice rows come from `survey_choices`. Form POSTs to `submit.php` with `survey_id` and dynamic `q<question_id>` fields: `choice_<choice_id>` for multiple choice, `Yes`/`No`, 1–5 rating, optional text. `error=empty` and `error=failed` display the existing distinct error text. Shared JS marks missing radio groups and alerts “Please answer all required questions before submitting.” Text groups remain optional, including blank text. Cancel returns to surveys.
- **`resident/submit.php`**: Resident-guarded; non-POST → surveys. Reads POST `survey_id`, confirms survey is open, blocks any existing response, reads known survey questions, converts posted answers by question type, skips unanswered/invalid Yes-No/rating values and trims text. For multiple choice it parses the `choice_` prefix; it does not validate that the submitted choice belongs to that question in this handler. No usable answers → form `?id=...&error=empty`. Inserts response and answer rows in one transaction; commit → `surveys.php?submitted=<id>`. Duplicate-key 1062 rolls back and redirects to surveys; other exceptions roll back, log server-side, and go to form `error=failed`. No standalone success page is used by the normal submission path. PHP requires at least one real answer, whereas shared browser JS requires each radio question; preserve this observed difference in the analysis.
- **`resident/confirmation.php`**: Guarded GET `survey_id` fetches title and renders the standalone “Submission confirmed” card; missing title falls back to “the survey”. No response ownership/existence check. Back to Surveys link; no form, POST, flash or inline JS.
- **`resident/history.php`**: GET all own responses with survey descriptions ordered newest first. View action goes to `view_response.php?id=...`; no edit/resubmit action, POST, modal or flash. Empty text when none.
- **`resident/view_response.php`**: GET `id` is constrained by session resident; missing/not owned → history. Shows every question in order, joined to recorded answer; displays choice text, `value / 5`, text with line breaks or “No answer”. Print Response invokes `window.print()`. Presence of `print` registers printing after window load. Download CSV goes to `export_response.php?id=...`; no POST or data mutation.
- **`resident/export_response.php`**: GET `id`; own response only; missing/not owned returns HTTP 404 with “Response not found.” Streams `text/csv; charset=utf-8`, attachment `survey-response-<id>.csv`: Survey, Submitted, blank line, Question/Answer rows, rating as `value / 5`. No screen or JS.
- **`resident/change_password.php`**: GET reads first-login state and consumes `password_changed` flash. POST `current_password`, `new_password`, `confirm_password`: current-password check, shared policy, different from current, matching confirmation. Updates hash and clears first-login; sets `password_changed` to `first`/`normal`, redirects to itself, opens persistent `password-success-modal`. First-login instructions say current password is Resident Number. Success offers Go to Dashboard or Stay Here. Inline checklist mirrors five PHP password rules and shows “Passwords match.”/“Passwords do not match yet.” Shared eye toggles apply. No new-password value is retained.
- **`resident/profile.php`**: GET loads own resident, family rows, pending name/address/birthdate request and pending family request. Consumes `profile_flash_message`, `profile_flash_error`, `profile_show_request_modal`, `profile_show_birthdate_modal`, then unsets them. If any pending update exists, `$error` is cleared before render. Identity/residency/category are not directly editable from this resident page.
  - POST `action=save_contact`: `email`, `contact_number`; at least one nonempty; shared contact pattern. Saves immediately with success message; validation reopens `edit-contact-modal`. Browser email validation exists; this handler does not independently validate email format. No redirect on successful contact save.
  - POST `action=request_birthdate`: `birthdate`; one pending `resident_update_requests` record blocks either kind of identity/date request; requires nonempty date before today and different from stored. Inserts request, never directly changes birthdate. Session feedback/modal flag then redirect to profile for both success and failure.
  - POST `action=request_name_address`: courtesy selection/custom title, name parts, seven permanent address parts and, only for temporary residents, seven `temp_` parts. First/last required; required permanent address parts, permanent postal code format, both address field-length limits, actual changed name/permanent/temporary data and no pending update. Inserts proposed values and prior address; session message/modal flag then redirect. Does not immediately modify resident. `request-change-modal` keeps saved values and adds pending-warning text on open. Page-specific title JS reveals/requires Specify Title.
  - POST `upload_photo=1` with multipart `profile_photo`: validates upload errors, image bytes and jpg/jpeg/png/gif/webp extension; saves under `uploads/residents`, updates photo path, shows “Profile Updated” in `profile-success-modal` on the same response. No explicit 5 MB application limit here; PHP upload limits still apply. Unlike staff upload, does not delete the replaced file. Crop modal uses shared photo JS. `$show_upload_modal` is assigned but not applied to the resident `photo-confirm-modal` class, so upload failures do not automatically activate it in markup.
  - POST `remove_photo=1`: removes existing file if present, clears stored/session photo, sets `profile_flash_success`, redirects to itself. That key is not consumed by this page's initial flash reads (§7). Shared confirmation retains the form action.
  - POST `request_family_change=1`: occupation, hotline, `is_married`, `has_children`, prefixed spouse/father/mother person fields, `children[]`, `references[]`, `family_reason`. Resolves titles; No clears spouse/children. Validates person rows, required reason, married spouse first name, at least one character reference, hotline, and no pending family request. Error activates `family-request-modal`; success stores JSON payload in `resident_family_requests`, sets `flash_success`, redirects. That success key is not read here. A pending request replaces the form with a notice. This form uses `data-unsaved-warning`, which shared dirty-warning JS does not select. Other contact/name/date request forms use `data-dirty-warn`.

### Staff/admin dashboard and survey tools

- **`staff/dashboard.php`**: Staff guard/onboarding. No POST form; date controls are inputs/buttons. GET metrics include all surveys/responses, non-archived residents, date-open surveys, pending resident updates, inactive/past-close counts, seven-day response delta, thirty-day new residents and latest response. Responding residents count is all distinct response resident ids; eligible count is active/non-archived residents; participation is capped at 100. Completion meters use status `active` (without open-date filter), top six by answers, top three initially visible. Survey table shows newest eight; ranking top five. Admin adds staff/deactivated counts, pending deletions, last ten logins and last ten logouts and portal breakdowns with recorded historical role where available. Charts fetch `ajax_stats.php`; inline datasets render participation. Date Apply fetches `from/to` and updates only trend without reload; reset uses browser dates/ISO strings for last 30 days. Fetch failure leaves existing range view; initial error logs and replaces question-mix loading text. `recent_logouts` View all is linked but not in the detail whitelist (§7). Demographic panels exist only with registered residents. Chart.js uses line, horizontal/vertical bars and doughnuts/half gauges with original fonts, colours, value/centre-label plugins and tooltips.
- **`staff/ajax_stats.php`**: GET `from`, `to` parsed strictly as Y-m-d, default end today/start 29 days earlier; swaps reversed dates; clamps difference to 365 days and zero-fills every included date. JSON keys: `responses_per_survey` (newest eight), `survey_status`, `response_trend`, `residency_mix`, `question_types`, `age_groups` (<18,18–34,35–59,60+), `gender_mix`, `priority_groups`, `occupations` (top seven excluding N/A/NA/NONE), `purok_mix` (top seven permanent `purok` field), `household` (married/not married/with children/no children). Entries are `{label,value}`; non-archived resident filters apply to demographics. No admin-only dataset in this endpoint.
- **`staff/stat_detail.php`**: GET `view` whitelist in §2. Unknown, missing or admin-restricted view for staff → dashboard. Shows count, table, back link. Survey response list limit 200; Login Activity limit 100. Login Activity query does not filter login vs logout and does not select stored `account_role`, unlike dashboard activity queries. No forms/POST/flash/modal beyond shared shell.
- **`staff/survey_management.php`**: GET normal list with response counts and client search. GET `toggle=<id>` flips active/inactive and redirects to clean list (no success flash). GET `delete=<id>` permanently deletes survey; looks up title first, sets success/not-found `success`/`error` flash, redirects. UI confirmation explicitly warns deletion also deletes questions, choices, responses/results. Edit/questions/results links use query ids. This page does not call `get_flash` for its delete feedback; no visible flash renderer for those keys here (§7).
- **`staff/add_survey.php`**: POST title, description, start/end and `questions[index][text|type|choices][]`; required title/dates, meaningful title ≥8, optional description meaningful ≥10, start≤end, at least one nonblank question. Transaction creates active survey owned by session staff, skips blank questions/choices, orders nonblank questions, inserts choices only for multiple choice. Commit → survey list; rollback shows “An error occurred while creating the survey.” This handler does not enforce the two-choice rule or meaningful per-question text used by question-management, despite form hint. Browser title max150/description max500; question255/choice150. Inline template starts one question, adds/removes/renumbers question headings and switches choices by type. Shared JS adds/removes choices. Preview builds escaped unsaved title, description, dates/questions/choices and opens `survey-preview-modal`; no API call. Form has dirty warning. After server error metadata is retained but dynamic question rows are recreated as one empty row.
- **`staff/edit_survey.php`**: GET `id`, missing → list. POST title, description, dates, status; same required/meaningful title/description/date ordering validation as add. Updates metadata only; same-page “Survey updated successfully.” and current values. Save Changes and Manage Questions; no page-specific modal, dirty warning or inline JS.
- **`staff/question_management.php`**: GET `survey_id` mandatory existing survey. GET `delete=<qid>` deletes only owned question, resequences all questions, redirects `deleted=1`. GET `move=up|down&qid=...` swaps with adjacent question order (all non-up values treated down), then redirects `moved=1`. Success flags `deleted`, `moved`, `added`, `updated` map to “Question deleted.”, “Question order updated.”, “Question added.”, “Question updated.”.
  - POST without `update_question`: `question_text`, `question_type`, `choices[]`; nonempty meaningful question ≥5; multiple choice requires at least two trimmed nonblank choices; appends next order, inserts choices, redirects `added=1`.
  - POST with `update_question=1`: `question_id`, text/type, `existing_choices[choice_id]`, `new_choices[]`; checks question owner and same text/two-choice rules. Updates kept choice text by id, removes blank existing choices (with their linked answers), inserts new choices, or clears all choices for non-multiple-choice type; redirects `updated=1`.
  - `add-question-modal`/`edit-question-modal` reopen for respective validation errors; success also opens `question-success-modal` and renders success alert. Both forms have dirty warning. Inline edit buttons parse embedded question JSON, populate id/text/type and choice inputs, then activate modal. Shared JS controls add/remove choices and type reveal. First/last move arrow is a muted span.
- **`staff/results_dashboard.php`**: GET `survey_id` via auto-submitting select. No selection shows “No Result Selected”; unknown survey shows “Survey not found.” For valid survey displays respondent count, collection period, status and report link. Multiple-choice/Yes-No bars use per-question answer totals as percentage denominator, all-zero states and tied maxima correctly; Yes/No values explicitly zero-filled. Rating is average rounded to two decimals plus five zero-filled rating bands and count. Text displays latest 200 nonblank answers with dates and per-question client search. These bars are HTML/CSS, not Chart.js canvases. No POST/flash or custom modal.
- **`staff/reports.php`**: GET `survey_id` via auto-submitting select; no selection “No Report Selected”, invalid “Survey not found.” Valid report includes creator, title/description/period, total respondents and generated time. Per-question count tables explicitly include all choices, both Yes/No and all five ratings even at zero; text list is not capped to 200. “Based on … responses” uses actual question-answer count. Print calls `window.print()` with `.no-print` controls/shell; CSV export passes survey id. No POST/modal.
- **`staff/export_csv.php`**: Guarded GET `survey_id`, missing → reports. Attachment `survey_report_<sanitized_title>.csv`, `text/csv`; header/period plus per-question Option/Count. Multiple choice includes zero-count choices; Yes-No/rating queries emit only observed values (unlike printed report's zero-fill); text rows are Response/value, nonblank, uncapped. No HTML/JS.

### Staff/admin people, profiles, approvals and archive

- **`staff/resident_management.php`**: Normal GET loads all non-archived residents plus embedded edit lookup including children/references; search matches resident number/name; tabs All/Permanent/Temporary/Pending Login/Deactivated combine with search. GET `edit=<id>` loads existing record for server prefilling, but does not by itself activate the edit overlay; row edit and chooser activate it client-side.
  - GET `reset=<id>`: resets to Resident Number, sets first-login, `flash_success`, clean list redirect. GET `toggle=<id>`: changes active state on non-archived resident, flash and redirect; history retained. GET `delete=<id>`: admin-only archive via helper, resolves pending deletion requests, flashes kept-history result, redirects. Non-admin gets denial flash and clean redirect. Despite old button warning saying history is deleted, implementation archives (§7).
  - POST `request_delete=1`, resident id, required reason: verifies resident and no pending deletion request; captures resident/requester identity snapshot; duplicate pending gets informational success flash. Otherwise inserts request and redirects with success; invalid reason/resident shows page error. UI is staff-only `request-delete-modal`, pending row becomes muted clock. Handler itself permits either staff role.
  - POST `add_resident=1`: personal name/title/custom title, optional extension/email/contact, required first/middle/last, birthdate, gender, birthplace, special category/reference, residency status/start, permanent address, conditional temporary address/type, occupation/hotline and family fields. Generates global max-sequence `R-YYYY-NNNN` using current year (not sequence reset per year), hashes Resident Number as default password. Requires family references, married spouse surname/first name, children if Yes, person row required names, valid hotline and occupation≤100; required addresses, permanent postal code format, shared contact/address-length/reference checks; required valid nonfuture residency date, six months for permanent, date not before birthdate, no future birthdate and unique generated number. Transaction inserts resident and related child/reference rows; success flash includes generated number, then redirects. Error reopens Add modal and retains posted values.
  - POST `update_resident=1`, resident id and same editable fields: current status read from DB and kept; posted status cannot perform a promotion. Same broad validation, with six-month test only when an existing permanent resident's start date changes. Edit handler does not repeat add handler's permanent postal-code regex. Transaction updates record/children/references; success redirect or edit modal reopened with posted values and error. Identifier/password unchanged by this branch.
  - POST `promote_resident=1` (admin), resident id/optional reason: must currently be temporary, have temporary address, valid residency start and at least six months. Transaction snapshots both addresses/type in `resident_residency_changes`, copies temporary address into permanent fields, clears temporary fields/type, sets permanent; flash and redirect. No automatic promotion.
  - POST `revert_resident=1` (admin), resident id/required reason: must be permanent. If latest unreverted promotion exists, restores archived original permanent address, moves current address into temporary fields, restores valid prior residence type, marks promotion reverted. Without snapshot, keeps permanent address and copies it into temporary fields, clears residence type and tells staff what to fill next. Writes reversal audit snapshot in same transaction, flashes and redirects. These branches are conditioned on admin rather than returning explicit denial for a non-admin forged flag.
  - Inline JS: chooser/row buttons fill the edit form from embedded record lookup, including custom titles, family reveal radios, recreated person rows and status/read-only badge; missing selection/record raises exact alerts. Birthdate changes update singular/plural age. Temporary status reveals/enables/requires temporary fields. Category selection reveals label/hint/pattern/reference and clears None. Residency date updates duration/minimum warning and custom validity; admin status switch previews before/after addresses, closes edit modal and opens promotion/revert confirmation, resetting note. Shared modal reset applies unless keep-on-close exists. Relevant IDs are in §8.
- **`staff/user_management.php`**: Staff/admin GET resident accounts; only admin loads staff-account list. Two independent client search tables, current account marked “(you)”, onboarding badges password-not-set/profile-incomplete/complete. GET `toggle_resident` allows either staff role, flashes and redirects. GET `toggle_staff` admin-only; cannot toggle self; flips non-archived target active state then flash/redirect. GET `delete_staff` admin-only; cannot self, validates target and protects deletion of last active other admin via `active_admin_count`; archives and flashes/redirects. GET `reset_staff` admin-only and not self; resets hash to Staff Number, first-login=1, flash/redirect; missing number/record errors.
  - POST `add_staff=1`: admin only; courtesy/custom title, first/middle/last/extension and date hired; required first/last/hire date, no future hire. Always creates role `staff`. Generates `S-YYYY-NNNN` with global suffix sequence; username and temporary password both Staff Number; active, first-login=1, profile_completed=0, created_by current admin. Sets JSON `new_staff` and success flashes, redirects to list. `new-staff-modal` shows only issued Staff Number and handover instructions; otherwise general `user-success-modal`. Validation opens `add-staff-modal`; inline custom-title field toggle. There is no role promotion/username editing form despite related helper functions and some descriptive text.
- **`staff/complete_profile.php`**: GET own record; missing → logout. Admin sees read-only Admin Record and photo controls; non-admin gets contact/profile/address/emergency form. Onboarding when non-admin profile incomplete; consumes `profile_saved` outcome. Pending staff-address request locks address editing but permits other personal updates.
  - Multipart POST `upload_photo=1` with `profile_photo`: upload errors/image/extension checks and ≤5 MB; saves under `uploads/staff`, deletes old photo file after new upload succeeds, updates path, sets `profile_saved=photo` and redirects. Errors activate crop modal. Shared crop workflow and confirmed POST `remove_photo=1`; removal clears photo/session and sets `flash_success`, redirects (that flash is not consumed here).
  - Non-admin POST without `upload_photo`: contact/email/birthdate/gender/license, seven address fields, reason, emergency name/number. Required valid contact; optional email valid; birthdate before today; license≤50 with permitted letters/digits/spaces/hyphen/slash; emergency phone pattern; when unlocked, required address parts and four-digit optional postal code. Updates personal/emergency fields and profile_completed in transaction. First setup saves address immediately, outcome `first`; later changed address needs reason and creates `staff_update_requests`, outcome `requested`; pending/unchanged address leaves stored address intact, outcome `normal`. Flash `profile_saved`, self redirect; success modal uses exact outcome-specific heading/message plus Dashboard/Stay Here. Inline age updates. Page does not use `data-dirty-warn` on this form.
- **`staff/change_password.php`**: Own first-login/profile state and `password_changed` flash. POST current/new/confirm: current hash, new must not case-insensitively equal Staff Number, shared policy, different from current, matching confirm. Clears first-login and hashes password. Incomplete profile: `success` flash “Password set. One more step: tell us how to reach you.” then complete-profile redirect; otherwise `password_changed=first|normal` and self redirect/success modal. First-login heading/button are Set Your Password/Set Password, step 1 of 2; standard view Change Password/Update Password. Same live checklist/match hint/eye controls as resident. Staff shell hides sidebar during first step.
- **`staff/address_requests.php`**: GET resident requests pending-first and submission descending; pending rows have separate direct approve/reject POST forms. GET staff requests loads all for admin, own-only otherwise, but Staff Requests panel is enclosed in admin-only rendering. Integrated Family & Household Requests panel and its script are also enclosed in that admin conditional; handlers still accept staff resident/family decisions.
  - POST `request_id`, `action=approve|reject`, optional `review_comment`: pending resident update only. Transaction marks status/reviewer/time/note; approval applies permanent address only when household number is carried, temp address only when temp household is carried, name only when proposed first/last is nonblank, and birthdate if present. Rebuilds address line (legacy stored-address fallback). Reject keeps record. Same-page success modal “Request has been approved/rejected.”; absent/already processed error. Browser forms do not offer resident review comment input, though handler supports it.
  - POST `staff_request_id`, action, review_comment: admin-only. Pending lookup, status/reviewer/name/time/note, approval writes staff address; same-page “Staff address request has been approved/rejected.” `staff-review-modal` fills target/decision and requires note on reject in browser only (server does not require it).
  - POST `family_request_id`, `family_action=approve|reject`, optional `family_comment`: pending `resident_family_requests` JSON. Invalid payload left pending. Transaction applies occupation/hotline/person fields, booleans and replaces children/references on approval; then saves reviewer/time/name/comment for either decision. Commit sets `flash_success` and redirects to itself; rollback leaves records and shows error. No `get_flash` consumes that key on this page. Family card shows proposed household data, reason/review note and inline approve/reject/note form.
- **`staff/family_requests.php`**: Separate guarded GET/POST implementation for `resident_family_update_requests` and nested `proposed_family_json`, not the integrated table/payload. GET table includes expandable full details. POST `request_id`, `action`, optional review_comment; pending lookup, malformed proposal error; approve normalizes nested spouse/father/mother through `collect_family_person`, validates family details/references/phone, transaction updates resident/person rows and conditionally closes pending request; race/error rolls back. Reject conditionally closes pending request and reports already processed if needed. Same-page feedback; no special modal/inline JS beyond shell. Table/helper are absent from the inspected initialization/helper definitions (§7); do not describe this as a working interchangeable alias.
- **`staff/deletion_requests.php`**: GET all deletion requests pending-first then latest, joined to live resident archive state. Staff sees awaiting-admin; admin has `review-request-modal`. POST request id/action/review_comment is admin-only; pending lookup; reject requires nonblank comment server-side. Transaction records status/reviewer/name/time/note; approve archives resident and resolves other pending deletions for it. Success flash then self redirect; errors stay on page. Modal fills reason/target and toggles approval warning/required rejection note/button label. Decided rows distinguish kept resident, restored account, in archive (admin link), moved-to-archive staff text, or removed record, preserving review metadata and stripping restoration marker from visible note.
- **`staff/deleted_accounts.php`**: Admin GET archive tables sorted deletion-descending and counts held responses; no content mutation on GET. POST `restore=1`, `kind=staff|residents`, `id`: clears archive metadata via helper; resident restores append `[Account later restored.]` marker to approved deletion reviews; success/not-found message then self redirect. Restoring does not change `is_active` or first-login flags even though success text says can sign in again. POST `purge=1`, kind/id: self-staff deletion denied; hard-deletes only archived target; resident responses are subject to existing database cascades. Flash and clean redirect. Restore is direct form; Delete Forever opens `purge-modal` with target, irreversible warning and held-response count, then POST confirmation. No upload cleanup is performed by purge handler.
- **`staff/residency_records.php`**: Admin GET; optional filter accepted only `permanent`/`temporary`, others treated all. All audit changes newest-first, counts of promotion/reversion across full log; selected metric filters by destination status. Shows current status separately from historical transition, later-undone marker, archived address/temporary origin, reason, actor, time and deleted-resident fallback. Client search only name/resident number. No POST/revert button/modal on this page; transitions originate on resident management.

### Includes and backend helpers

- **`includes/header_resident.php`**: Loads icons/assets/title, reads session resident's residency, first-login, active/archive state, photo/title/first name/type; may call existing photo-column ensure helper. Redirects inactive/archived resident to logout before rendering. Sidebar active link uses current PHP basename; nested pages are not automatically marked as their parent nav entry. Uses stored photo file existence and image-error initial fallback. Names come from session with current courtesy title. Mobile drawer/topbar/account links as above.
- **`includes/header_staff.php`**: Role normalized from session for Admin/Staff label, profile/photo/title read from database each render. Archived account → logout. Initial excludes courtesy titles; image error hides photo and shows fallback. Admin queries pending deletion/archive counts. Hides sidebar during onboarding, retains topbar. No independent form or session guard.
- **`includes/footer.php`**: Closes content wrappers, renders current-year footer and shared `confirm-modal` with keep-on-close, includes `assets/js/script.js?v=16`. It does not consume/render `flash_success`/`flash_error` itself.
- **`includes/icons.php`**: `nav_icon(name)` returns unchanged 18×18 inline SVG; names: `dashboard`, `surveys`, `residents`, `results`, `statistics`, `reports`, `staff`, `logout`, `profile`, `password`, `edit`, `search`, `lock`, `power`, `chevron`, `clock`, `check`, `trash`, `switch`, `eye`, `download`, `chevron-left`. Unknown name falls back to circle. No route, POST, state or CDN icon font.
- **`includes/family_fields.php`**: Renders occupation/hotline, spouse Yes-No, children Yes-No and repeatable rows, optional parents and required references. Uses `person_field_spec()` labels/types/limits. Courtesy Others has sibling custom input. Prefixes make add/edit/request ids distinct. It does not save data or expose an endpoint; browser reveal/row behaviour is shared JS, server checks are in callers.
- **`config/functions.php`**: Starts session; escaping, redirects and guards; staff onboarding gate; resident/staff number recognition; staff number generation and username validation/free/suggestion helpers (username suggestions are not used by current create form); full name/address builders; meaningful text, contact/address and title validators; photo existence/initial generation; archive/restore/last-admin checks; gender/residence/category metadata; six-month residency duration/formatting; historical account-event role labels/logging; flash set/get; password policy; inclusive survey availability; person field/display/collect/validate/fetch/replace helpers; hotline regex/hints. Some ensure helpers can ALTER missing legacy columns when called: do not execute them during this analysis. No API or frontend import of this file.
- **`config/db.php`**: Existing MySQL connection and runtime initialization/migrations; Manila timezone. Initialization references include base survey/account/result/history tables, family rows/requests, resident update/delete/residency changes and staff update requests. It is not a route or a client-side configuration file. Future API bootstrap may include it with functions as authorized, keeping credentials/private data server-only. This analysis neither executes it nor resets/migrates the DB.

## 5. Complete shared JavaScript behaviour map

These behaviours come from `assets/js/script.js`; page-specific chart/editor/profile scripts are covered with their pages above. Extract to hooks/components with the same user-visible states, without running the legacy DOM listeners against React-owned DOM.

| Behaviour | Existing selectors/events and exact effects | React candidate |
| --- | --- | --- |
| Modal fields reset | On generic open and close, clear text/file/textarea fields, reset selects to first option (dispatch change), restore checkbox/radio defaults; hidden/action inputs untouched; dispatch input and remove modal alerts. Skip all reset for `data-keep-on-close` | `useModalForm` |
| Pending identity request warning | Opening `#request-change-modal[data-pending-request="1"]` inserts/shows “You already have a pending name/address request under review.” | `NameAddressRequestModal` |
| Modal open/close | Delegated `data-modal-open`/`data-modal-close`; click overlay backdrop closes; Escape iterates over **all** active overlays (despite comment saying topmost) | `Modal` |
| Alert-to-toast conversion | Success/error alerts outside modals become toasts only when direct container children or first child of `.card`/`.grid-2`; preserve inner HTML; info alerts stay; live region polite/atomic; 6000 ms then 220 ms fade/translate removal | `ToastHost`, `useFeedback` |
| Destructive confirmation | Delegated `data-confirm` anchors or form buttons open shared message/proceed modal; native `confirm` fallback if missing. Cancel does not submit. On form confirmation carry submitter name/value as hidden input, set `data-confirmed-submit`, use requestSubmit or submit; link confirmation retains href | `ConfirmModal`, `useConfirmedAction` |
| Question type reveal | Existing `.question-type-select` listeners plus delegated change show choices only for multiple_choice; initial existing rows dispatch change | `QuestionTypeFields` |
| Answer form validation | At submit, each `[data-required-group]` with no selected input and no text control gets `.missing`; blocks and alerts “Please answer all required questions before submitting.” Text controls are optional | `SurveyAnswerForm` |
| Photo selection | `#profile_photo` change accepts `image/` MIME; otherwise “Please select a valid image file.” Object URL/Image used; read failure “Unable to read that image. Please choose another photo.” Revoke previous URL on next selection | `usePhotoCrop` |
| Photo crop | 320×320 canvas in pages; cover-fit and centre image, clamp position, preview JPEG quality0.9, zoom1–3 around centre; pointer capture for dragging with canvas-coordinate scaling and drag CSS | `PhotoCropper` |
| Choose another/upload | Choose another hides crop modal, empties input/preview, reopens picker after120 ms. Confirm disables button (“Preparing...”), exports JPEG blob/file `profile-photo.jpg`, installs via DataTransfer then submits photo form. Blob failure: “Unable to prepare the resized photo. Please try again.” Browser failure: “Your browser could not prepare the resized photo. Please try another browser or image.” | `PhotoCropModal` |
| Legacy residency select confirmation | `.confirm-residency-change` saves previous value on focus, native confirm on change, submit when accepted or restore previous. No current page renders this selector; preserve as known legacy JS, do not invent a UI | `useConfirmedSelect` if needed |
| Mobile drawer | Toggle sidebar `.mobile-open`, body `.nav-open`, backdrop `.active`/aria-hidden, toggle aria-expanded/label. Close button and Escape return focus to toggle; backdrop/nav-item clicks close; resize>1100 closes | `NavigationDrawer` |
| Account menu | Chip toggles `.open` and aria-expanded; outside click or Escape closes. No focus-trap behaviour exists in source | `AccountMenu` |
| Table search/filter | `data-table-search` input/search uses trimmed lowercase substring in `tr[data-search-text]`; active tab `data-filter-group` matches tokens in row `data-filter`, `all` accepts any. Combines term and filter, toggles no-match row. Does not paginate or sort | `useTableFilter`, `TableSearch`, `FilterTabs` |
| Completion expansion | `data-toggle-more` toggles `.meter-row.is-hidden`/`.is-shown`, expanded flag and text between `data-label-more` and “Show top 3 only” | `ExpandableMeters` |
| Password eye | `.password-toggle[data-target]` changes password/text, `.is-visible`, “Show password”/“Hide password” aria labels | `PasswordField` |
| Choice rows | Delegated add creates one input max150 named from `data-choice-name` plus remove button; remove clears rather than removes when≤2 inputs, otherwise removes row | `ChoiceEditor` |
| Unsaved changes | Only `form[data-dirty-warn]`: input/change set dirty, submit clears; beforeunload asks via browser; Cancel inside form asks “Discard the details you entered?” and stops propagation if declined, else resets. Family `data-unsaved-warning` does not match | `useDirtyForm` |
| Open-text answer search | `data-answer-search` input filters `[data-answer-text]` case-insensitively and toggles `.answer-no-match`; unlike table search it does not trim term | `TextAnswerList` |
| Spouse/children reveals | Checked `input[type=radio][data-reveals]` value1 shows associated block, other value hides; hidden block inputs/selects/textareas disabled so they do not POST. Initial sync for `is_married`/`has_children` | `YesNoReveal` |
| Person repeaters | `data-add-row` clones first row within same form/modal, clears input/select values, enables fields, appends, focuses first input. Renumbers labels and names including selects (`children[index][part]` etc); last row cannot be removed. Exposes `window.renumberPersonRows` for inline edit loader | `RepeatablePersonRows` |
| Family title Others | Delegated `data-title-select` finds following sibling `data-title-other`; Others reveals it, other values hide and clear. Runs initial sync. Resident/staff identity forms with wrapper layout also have page-specific title handlers | `CourtesyTitleField` |
| Diagnostic output | Logs `script.js v7 loaded` even though header comment says build v5 and footer cache version16 | No product UI; record source version mismatch only |

## 6. Proposed API contracts derived from PHP handlers

### Contract conventions and shared request shapes

This is an implementation inventory, **not implemented endpoints**. Paths are logical paths beneath the existing site's `/api` directory; mapping them to PHP entry files is a future implementation detail. Calls use the existing PHP session cookie and session identity, not caller-supplied identity for own-account operations. Keep all database queries, business validation, authorization, generated numbers, archive helpers and transactions server-side. Do not expose hashes, credentials or raw database exceptions. No new business entities, self-registration, password recovery email, role-promotion UI, medical-document API, pagination or automatic residency promotion is inferred.

Proposed normal JSON success: `{ok:true,data:...,message?:exactSourceText,redirect?:reactLocation,ui?:{modal,flashKind,outcome}}`. Validation/action failure: `{ok:false,message:exactSourceText,errors?:...,ui?:{modal},redirect?:reactLocation}`. Authentication/onboarding failures need an explicit state/redirect usable by React. This JSON envelope is proposed; current pages generally return HTML/302, and the two `ajax_stats.php` files return their plain objects. Preserve exact original validation precedence, visible messages and resulting destination/modal, including distinctions documented in §7. Keep one-time outcome consumption equivalent to flash/PRG, without replaying mutations when refreshing. Do not return entered passwords. CSV endpoints remain attachments, not JSON.

The legacy inventory in §4 explicitly records state-changing GET actions. Proposed API equivalents below use **POST** action endpoints so React can request those actions explicitly after the same confirmation; this changes transport, not the user's flow or server business rules. Original PHP handlers are untouched. Read-only search/filter, modal previews, photo crop, show/hide password and print do not need mutation endpoints.

Shared shapes (names match original form fields unless stated):

- **Address**: `household_number`, `purok`, `street_highway`, `barangay`, `municipality`, `postal_code`, `province`. Required parts are household_number/barangay/municipality/province. Limits 30/60/120/80/80/4/80. Optional postal code is four digits where the original handler checks it. Temporary fields are the same with `temp_` prefixes; do not collapse the two addresses.
- **Name**: `courtesy_title`, `courtesy_title_other`, `first_name`, `middle_name`, `last_name`, `name_extension`. Resolve Others server-side to custom title≤20; normal options Mr./Mrs./Ms./Mx. Required middle name applies to staff resident add/edit, but not every Name use.
- **Person**: courtesy/custom title, first/middle/last/extension and `gender`; first/surname required on nonblank repeatable rows; field metadata from `person_field_spec()`. Fixed relatives prefix these fields with `spouse_`, `father_`, `mother_`; `children[index][field]` and `references[index][field]` are repeaters. Do not conflate this flat active payload with the nested legacy family implementation.
- **Family**: `occupation`, `hotline_number`, `is_married` (0/1), `has_children` (0/1), fixed relative fields above, `children[]`, `references[]`. Blank repeatable rows are dropped; No clears spouse/children in corresponding handlers. Require at least one reference; hotline pattern is shared PHP definition.
- **ResidentInput**: Name + Address + temporary Address, `email`, `contact_number`, `birthdate`, `birthplace`, `gender`, `residency_status` (create only; update reads current DB status), `residency_start_date`, `residence_type`, `special_category`, `category_reference`, Family. Server generates resident id/number/password defaults. Special category none/pwd/senior_citizen/pregnant; residence type AR/DR/BH/BS/RL/TR only for temporary. Follow handler-specific checks described in §4.
- **StaffProfileInput**: `contact_number`, `email`, `birthdate`, `gender`, `license_number`, Address, `reason`, `emergency_contact_name`, `emergency_contact_number`. Server builds combined emergency_contact, decides initial save vs pending address request, and profile completion.
- **SurveyInput**: `title`, `description`, `start_date`, `end_date`; edit also `status`; create also `questions[index][text|type|choices]`. Types `multiple_choice`, `yesno`, `rating`, `short_answer`; question-management uses its own `question_text`/`question_type` field names and stricter validation.
- **StatsSeries**: array of `{label:string,value:number}`. Server must calculate counts/dates/percentages and record labels using current logic; React displays them. Keep existing query scope and limits rather than deriving new definitions in browser.

### Authentication, session and shared metadata

| Method | Proposed path | Request | Response / source / access |
| --- | --- | --- | --- |
| GET | `/api/session` | Existing session cookie | Sanitized role/account/name/photo/initial, active/archive/first-login/profile status, exact next destination and navigation visibility; admin pending deletion/archive counts. Derived from login, guards and headers. Anonymous state allowed. Must distinguish resident from staff/admin and staff password/profile steps |
| GET | `/api/form-metadata` | Session where needed | Password rule labels, Name/Person/Address labels/limits/placeholders, gender options, title options, residence types, category reference label/pattern/hint, required parts, minimum residency months and hotline/contact hints from `config/functions.php`; no callback/SQL/credential leakage. Can be included in relevant page read response instead of standalone call |
| POST | `/api/login` | `{identifier,password}` | Current: one server-detected resident-number/staff-number/username lookup as specified in the Prompt 25 update above; existing hash checks, errors, session, audit and redirects retained; public |
| POST | `/api/auth/logout` | Cookie; infer matching role, no submitted user id | Record corresponding logout, destroy full session, return public landing destination following existing stub chain; derives from both logout files. Existing no-session request remains harmless |

### Resident reads and actions

| Method | Proposed path | Request | Response / source / access |
| --- | --- | --- | --- |
| GET | `/api/resident/dashboard` | Session only | Headline counts/percentage/next deadline, five closing surveys, five recent submissions, six activity month rows, sanitized record/address facts, household series, residency duration/gauge and visibility flags. `resident/dashboard.php`; resident |
| GET | `/api/resident/stats` | Session only | Existing `{completion:StatsSeries}` with Completed/Available order. `resident/ajax_stats.php`; resident |
| GET | `/api/resident/stat-detail` | `view=available\|completed\|assigned` | Title/subtitle/unit/count, typed rows and action destinations for that view; invalid → dashboard. `resident/stat_detail.php`; resident |
| GET | `/api/resident/surveys` | Optional `submitted=<surveyId>` | Waiting/answered currently open surveys, counts, exact empty-state state and optional submitted title/modal; session-scoped answered flags. `resident/surveys.php`; resident |
| GET | `/api/resident/survey-form` | `id=<surveyId>` | Open/unanswered survey metadata and ordered questions/choices; otherwise surveys destination. `resident/survey_form.php`; resident |
| POST | `/api/resident/survey-submissions` | `survey_id`, dynamic `q<id>` answers (`choice_<id>`, Yes/No,1–5,text), form encoding or equivalent JSON adapter | Transaction result and surveys `submitted` modal destination; empty/failed → exact form error state, already answered/closed → surveys. `resident/submit.php`; resident. Preserve one-attempt/duplicate handling |
| GET | `/api/resident/confirmation` | `survey_id=<id>` | Survey title or existing fallback for standalone confirmation; does not assert that a response was submitted. `resident/confirmation.php`; resident |
| GET | `/api/resident/history` | Session only | Own response id/survey id/title/description/submitted_at, newest first; empty state. `resident/history.php`; resident |
| GET | `/api/resident/response` | `id=<responseId>` | Own survey metadata, submitted time and ordered questions/typed answers including missing answer states; not owned/missing → history. `resident/view_response.php`; resident |
| GET | `/api/resident/response-export` | `id=<responseId>` | CSV attachment and original filename/format; 404 “Response not found.” when missing/not owned. `resident/export_response.php`; resident. Could initially retain original PHP download URL |
| GET | `/api/resident/profile` | Session only | Sanitized own identity/contact/category/residency/address/photo, spouse/parents/children/references, pending identity/date/family request state, current date/age labels and one-time outcomes/modal flags actually consumed. `resident/profile.php`, resident header; resident |
| POST | `/api/resident/contact` | `email`, `contact_number` (legacy `action=save_contact`) | Updated contact and exact success, or original validation with contact-modal state. Immediate save. `resident/profile.php`; resident |
| POST | `/api/resident/birthdate-requests` | `birthdate` (legacy `action=request_birthdate`) | Pending request and exact message or first validation error/birthdate-modal state; own birthdate unchanged until review. `resident/profile.php`; resident |
| POST | `/api/resident/name-address-requests` | Name + Address + temporary Address where applicable (legacy `action=request_name_address`) | Pending proposal and success/error/request-modal state; preserve one pending shared update queue and all changed-field checks. `resident/profile.php`; resident |
| POST | `/api/resident/family-requests` | Family + `family_reason` (legacy `request_family_change=1`) | Pending `resident_family_requests` request or first error/family-modal state; retain existing flash-key mismatch as recorded until approved correction. `resident/profile.php`; resident |
| GET | `/api/resident/password-state` | Session only | First-login flag, password rule labels, one-time password_changed result. Can be folded into session/profile response. `resident/change_password.php`; resident |
| POST | `/api/resident/password` | `current_password`, `new_password`, `confirm_password` | Cleared first-login, exact error or `password_changed=first\|normal` success-modal state/self destination. `resident/change_password.php`; resident |
| POST | `/api/resident/photo` | Multipart `profile_photo`, legacy `upload_photo=1`; crop submits JPEG | Sanitized photo URL and Profile Updated state or exact upload error; existing file extension/image validation and resident-specific size behaviour. `resident/profile.php`; resident |
| POST | `/api/resident/photo/remove` | Legacy `remove_photo=1`; no caller resident id | Cleared photo/initial; existing `profile_flash_success` outcome and self destination (unconsumed flash noted). `resident/profile.php`; resident |

### Staff/admin dashboard, surveys, results and exports

| Method | Proposed path | Request | Response / source / access |
| --- | --- | --- | --- |
| GET | `/api/staff/dashboard` | Session only | Five main metrics/facts, deltas, participation, six completion meters, eight surveys, five ranking rows; admin-only account metrics, ten login/logout rows and portal splits; correct visibility flags. `staff/dashboard.php`; staff/admin with privileged fields omitted for staff |
| GET | `/api/staff/stats` | Optional `from`, `to` Y-m-d | Existing object with eleven series keys listed in §4; validate/swap/clamp/zero-fill dates server-side. `staff/ajax_stats.php`; staff/admin |
| GET | `/api/staff/stat-detail` | `view` from whitelist | Title/subtitle/columns/data/count; restricted or invalid → dashboard. Limits200 responses/100 activity. `staff/stat_detail.php`; four general/four admin-only views as §2 |
| GET | `/api/staff/surveys` | No search API needed; filtering is client-side | Survey rows with dates/status/response counts newest-first. Also supplies survey dropdown choices for Results/Reports. `staff/survey_management.php`, results/reports selector queries; staff/admin |
| POST | `/api/staff/surveys` | SurveyInput with `questions[]` | New survey id/active state and survey-list redirect; exact validation/transaction error. `staff/add_survey.php`; staff/admin |
| GET | `/api/staff/survey` | `id=<surveyId>` | Editable metadata or survey-list redirect. `staff/edit_survey.php`; staff/admin |
| POST | `/api/staff/survey/update` | `id`, title/description/start_date/end_date/status | Updated metadata, “Survey updated successfully.” or first original error. `staff/edit_survey.php`; staff/admin |
| POST | `/api/staff/survey/toggle` | `id` (legacy GET toggle) | New active/inactive state and clean list destination, no invented flash. `staff/survey_management.php`; staff/admin |
| POST | `/api/staff/survey/delete` | `id` (legacy GET delete) | Hard-deletion result, source success/error flash and list destination; existing cascade semantics. `staff/survey_management.php`; staff/admin |
| GET | `/api/staff/questions` | `survey_id` | Survey, ordered questions/choices/type labels, first/last order-control states; invalid survey → list. `staff/question_management.php`; staff/admin |
| POST | `/api/staff/questions` | `survey_id`, `question_text`, `question_type`, `choices[]` | Added ordered question; source added=1/message/success modal or Add-modal validation. `staff/question_management.php`; staff/admin |
| POST | `/api/staff/question/update` | `survey_id`, `question_id`, `question_text`, `question_type`, `existing_choices` keyed by choice id, `new_choices[]` (legacy update_question=1) | Updated question/choices; preserves kept choice ids, clears blank/removed choices and linked answers; updated=1 or Edit-modal errors. `staff/question_management.php`; staff/admin |
| POST | `/api/staff/question/delete` | `survey_id`, `question_id` (legacy GET delete) | Owned question deletion and resequencing; deleted=1/“Question deleted.”. `staff/question_management.php`; staff/admin |
| POST | `/api/staff/question/move` | `survey_id`, `qid`, `move=up\|down` | Adjacent order swap and moved=1/“Question order updated.”. `staff/question_management.php`; staff/admin |
| GET | `/api/staff/results` | Optional `survey_id` | Selector state; survey metadata/count, per-question answer totals, percentage bases, Yes-No zero bands, rating average/n/five bands, latest200 text answers/dates; absent/missing survey states. `staff/results_dashboard.php`; staff/admin |
| GET | `/api/staff/report` | Optional `survey_id` | Printable report metadata, creator, generated time, respondent total, all question rows with report-specific zero-filled counts and uncapped text. `staff/reports.php`; staff/admin. Do not blindly reuse capped Results data |
| GET | `/api/staff/report-export` | `survey_id` | Existing CSV attachment (including observed-only Yes-No/rating rows) and sanitized title filename; invalid → reports. `staff/export_csv.php`; staff/admin. Existing download handler may remain directly linked |

### Staff/admin residents, accounts, profiles and reviews

| Method | Proposed path | Request | Response / source / access |
| --- | --- | --- | --- |
| GET | `/api/staff/residents` | Optional `edit=<residentId>` compatibility state | Non-archived resident rows/count, sanitized complete editable records including children/references, pending deletion ids, admin restoration-address previews and permissions. `staff/resident_management.php`; staff/admin. Source embeds SELECT-star lookup, but API must omit stored hashes |
| GET | `/api/staff/resident` | `id` | One sanitized editable resident and household rows, current fixed status and restoration preview; can be served by list payload if small. Same lookup handlers; staff/admin |
| POST | `/api/staff/residents` | ResidentInput (legacy add_resident=1) | Created resident and auto-generated Resident Number for existing handover success text, list redirect or Add-modal first error/retained values; do not return a hash. `staff/resident_management.php`; staff/admin |
| POST | `/api/staff/resident/update` | `resident_id` + ResidentInput (legacy update_resident=1) | Saved resident or Edit-modal error/retained values; status remains DB value. `staff/resident_management.php`; staff/admin |
| POST | `/api/staff/resident/password-reset` | `resident_id` (legacy GET reset) | Reset-to-Resident-Number outcome, first-login flag and exact flash/list destination. `staff/resident_management.php`; staff/admin |
| POST | `/api/staff/resident/toggle` | `resident_id` (legacy GET toggle/toggle_resident), return context resident-management/user-management | Active state and exact relevant message/list destination; shared mutation serves both entry screens without losing source wording. `staff/resident_management.php`, `staff/user_management.php`; staff/admin |
| POST | `/api/staff/resident/delete` | `resident_id` (legacy GET delete) | Archive plus pending-deletion resolution, exact flash and list destination; reject non-admin as original. `staff/resident_management.php`; admin |
| POST | `/api/staff/deletion-requests` | `resident_id`, `reason` (legacy request_delete=1) | Captured deletion request or pending-duplicate outcome; exact reason/record errors; resident unchanged. `staff/resident_management.php`; staff/admin by handler; UI staff-only |
| POST | `/api/staff/resident/promote` | `resident_id`, optional `reason` (legacy promote_resident=1) | Validated six-month transition/audit/address result and exact flash/list destination, or first eligibility error. `staff/resident_management.php`; admin |
| POST | `/api/staff/resident/revert` | `resident_id`, required `reason` (legacy revert_resident=1) | Reverted record, restored-address or no-snapshot outcome and exact flash/list destination. `staff/resident_management.php`; admin |
| GET | `/api/staff/users` | Session only | Resident accounts for staff/admin; staff-account rows/onboarding states and pending-deletion notice only for admin; current-user marker. `staff/user_management.php` |
| POST | `/api/staff/users` | Name + `date_hired` (legacy add_staff=1); no role/username/password input | Generated Staff Number, name, fixed role staff and existing new-staff handover-modal state; exact validation. `staff/user_management.php`; admin |
| POST | `/api/staff/user/toggle` | `staff_id` (legacy GET toggle_staff) | Active-state outcome/flash; deny self/non-admin. `staff/user_management.php`; admin |
| POST | `/api/staff/user/password-reset` | `staff_id` (legacy GET reset_staff) | Reset-to-Staff-Number and first-login outcome with exact message; deny self/non-admin. `staff/user_management.php`; admin |
| POST | `/api/staff/user/delete` | `staff_id` (legacy GET delete_staff) | Archive outcome, self/last-active-admin/target checks and exact flash. `staff/user_management.php`; admin |
| GET | `/api/staff/profile` | Session only | Own sanitized account/employment/profile/photo, onboarding/pending address state, read-only-admin flag, `profile_saved` outcome. `staff/complete_profile.php`, header; staff/admin |
| POST | `/api/staff/profile` | StaffProfileInput | Saved non-admin profile, initial/current/requested address outcome, first validation error or profile_saved first/requested/normal and self destination. `staff/complete_profile.php`; staff only; admin has no details editor |
| POST | `/api/staff/photo` | Multipart `profile_photo`, legacy upload_photo=1 | Photo URL or exact upload error; ≤5MB, existing image/extensions, replacement cleanup; profile_saved=photo. `staff/complete_profile.php`; staff/admin |
| POST | `/api/staff/photo/remove` | Legacy remove_photo=1 | Cleared photo/initial, source flash_success and self destination. `staff/complete_profile.php`; staff/admin |
| GET | `/api/staff/password-state` | Session only | Staff Number reference, first-login/profile completion and consumed password_changed state; can be folded into session/profile. `staff/change_password.php`; staff/admin |
| POST | `/api/staff/password` | `current_password`, `new_password`, `confirm_password` | Source error or clear first-login with self success-modal/complete-profile redirect according to profile state. `staff/change_password.php`; staff/admin |
| GET | `/api/staff/address-requests` | Session only | Resident update proposals/status; all staff requests for admin, own-only for staff if exposed as data while preserving current hidden panel; integrated family proposals/status with actual role visibility flags. `staff/address_requests.php` |
| POST | `/api/staff/address-request/review` | `request_id`, `action=approve\|reject`, optional `review_comment` | Resident request decision and selective name/address/temp/birthdate updates, exact success/error; staff/admin. `staff/address_requests.php` |
| POST | `/api/staff/staff-address-request/review` | `staff_request_id`, `action`, `review_comment` | Staff address decision/update and exact success/error; rejection-note browser/server distinction preserved. `staff/address_requests.php`; admin |
| POST | `/api/staff/family-request/review` | `family_request_id`, `family_action`, optional `family_comment` | Active `resident_family_requests` transaction/decision or payload/save error, original flash/self redirect. `staff/address_requests.php`; staff/admin handler; current panel admin-only |
| GET | `/api/staff/legacy-family-requests` | Session only | Alternative `resident_family_update_requests` proposals/list/details; **blocked dependency**, not interchangeable with active table. `staff/family_requests.php`; staff/admin |
| POST | `/api/staff/legacy-family-request/review` | `request_id`, `action`, optional `review_comment` | Nested proposal review transaction/decision and exact errors; **blocked dependency** on missing helper/table initialization. Include only if this legacy route is retained after clarification. `staff/family_requests.php`; staff/admin |
| GET | `/api/staff/deletion-requests` | Session only | All requests with resident/archive/restore state, reviewer/time/comment, counts and decision permissions. `staff/deletion_requests.php`; staff/admin |
| POST | `/api/staff/deletion-request/review` | `request_id`, `action`, `review_comment` (required on reject) | Decision, archive/resolution effects, exact success flash or pending/not-found/error. `staff/deletion_requests.php`; admin |
| GET | `/api/staff/deleted-accounts` | Session only | Archived residents/staff, deletion metadata and held response counts; empty archive state. `staff/deleted_accounts.php`; admin |
| POST | `/api/staff/deleted-account/restore` | `kind=staff\|residents`, `id` (legacy restore=1) | Restored/already-restored/not-found source flash, resident review markers updated; account active flag unchanged. `staff/deleted_accounts.php`; admin |
| POST | `/api/staff/deleted-account/purge` | `kind=staff\|residents`, `id` (legacy purge=1) | Permanent-deletion/not-found outcome and original flash or self-protection error; only archived targets. `staff/deleted_accounts.php`; admin |
| GET | `/api/staff/residency-records` | Optional `filter=permanent\|temporary` | Full counts, filtered historical snapshots/current status, names/deleted fallback and actor/time/reason; client search as before. `staff/residency_records.php`; admin |

There is no endpoint for footer/icon rendering, opening/closing a modal, local table/text search, printing, local survey preview, revealing fields, adding unsaved form rows, or chart tooltip interactions. Those are client behaviours. `resident/confirmation.php` is a reachable GET view, not a second submission endpoint. Compatibility PHP login/admin/statistics stubs are redirects, not additional authentication APIs.

## 7. Source discrepancies and migration decisions still open

These are observations to preserve or resolve explicitly in later prompts; no fixes or schema changes were made.

1. **Login entry comments differ from code.** Root/index GET redirects to landing, not login. Resident/staff login stubs eventually reach root. Public Sign In correctly links to `login.php`. Normal survey submission uses the survey-list modal, not standalone confirmation.
2. **Two family-request systems.** Resident profile writes `resident_family_requests(payload,reason,requested_at)`; integrated address review reads it and works with flat relative fields. `staff/family_requests.php` reads `resident_family_update_requests(proposed_family_json,submitted_at)` and calls `collect_family_person()`, absent from `config/functions.php` and the rest of PHP source. `config/db.php` initializes the active table, not this alternative table. Actual live DB existence was not tested. Separate route is not linked in current sidebar. Do not create a parallel schema or silently merge payloads.
3. **Role rendering versus handlers.** Integrated family review is inside the admin-only markup block even though its server handler accepts staff. Staff address requests are loaded own-only for staff but their table is also hidden by admin-only markup. `user_management.php` itself is staff-accessible, not wholly admin-only. The separate legacy family page is staff-guarded, not admin-only.
4. **Unconsumed flashes.** Resident photo removal writes `profile_flash_success` but profile consumes only profile_flash_message/error/modal flags. Resident family success writes `flash_success` not consumed there. Staff photo removal and password-to-profile onboarding success write `flash_success` not consumed by complete-profile. Address family review writes `flash_success` not consumed there. Survey deletion sets success/error flashes not read by survey-management. Footer does not consume them. These keys may surface on another page that later consumes the same session key; do not claim they already display on the origin page.
5. **Broken logout detail target and activity scope.** Dashboard links `stat_detail.php?view=recent_logouts`, but detail has no such view, so it redirects to dashboard. `recent_logins` detail selects all event rows without event filter or stored account_role; dashboard separately filters each event and uses stored historical role. Do not invent a working logout-detail screen in the route map.
6. **Metrics use different definitions.** Resident Assigned headline counts open-unanswered plus all historical answered; assigned detail lists only currently open. Staff Completion Rate filters active status without dates although copy says open; active-survey headline/detail includes dates. Participation numerator is not restricted to currently active residents but percentage capped. Preserve the queries until an explicit change request.
7. **Validation differs by handler.** Add-survey does not enforce two choices/meaningful question text as question-management does. Browser answering requires radio answers while submit PHP accepts any one usable answer. Resident contact uses browser-only email format validation; resident upload has no explicit5MB cap while staff upload does. Resident add checks permanent postal code regex; edit omits that check; temporary postal regex is not universally enforced. Birthdate and residency-date limits also differ by page. Do not promise uniform rules unsupported by handlers.
8. **Archive text can be stale.** Admin resident delete row confirmation still warns survey responses are permanently lost, but handler now archives and keeps them. Archive Restore clears deletion fields only, so previously deactivated accounts stay inactive despite success wording. Purge really deletes. Preserve current visible text unless the user authorizes correcting it.
9. **UI state gaps.** Family request form has data-unsaved-warning rather than data-dirty-warn. Generic modal reset may clear prefilled family modal on reopening. Resident upload error flag does not activate crop overlay in markup; staff does. Add-survey error does not restore generated question rows. GET resident `edit` preloads values without auto-activating overlay. The live browser effect of these states remains to be verified.
10. **Authentication enforcement differs.** Resident first-login navigation hiding is not a global route redirect; staff onboarding has its own exempt filenames. Staff header reacts to archived accounts but not deactivation mid-session, unlike resident header. Do not replace those observed states with inferred checks during documentation.
11. **Protect data boundaries.** Current resident edit lookup is built from `SELECT *` and embedded as JSON, potentially including stored password hashes. A future API response must explicitly select/serialize only needed UI fields; no password hashes or credentials should enter React. This is a response-boundary requirement, not an authorization to change existing PHP.
12. **Infrastructure unavailable for live checks.** No React/Vite package manifest, dependencies, build or lint scripts exist. Previous localhost check was unreachable. No XAMPP services were started and no PHP handler was executed in this task; runtime/schema side effects therefore were not used as a way to inspect the app.

## 8. Exact source ledger

The following generated inventory records direct request keys, forms, overlays, redirects, and feedback expressions with source lines. It complements the narrative above: runtime expansions, dynamic question/relative/address fields and final message concatenations are explained in §§4–6. Empty initializers are omitted. Strings and identifiers are source evidence, not new UI wording or an instruction to execute an action. Includes/config paths appear in §2 even where they have no handler. All source paths/line references refer to the unchanged PHP snapshot examined for this task.



### `admin/index.php` source ledger

- Behaviour/feedback at line 4: `redirect('../index.php');`.

### `includes/footer.php` source ledger

- Modal overlays: `confirm-modal`.

### `includes/header_resident.php` source ledger

- Behaviour/feedback at line 46: `redirect('logout.php');`.
- Behaviour/feedback at line 49: `redirect('logout.php');`.

### `includes/header_staff.php` source ledger

- Behaviour/feedback at line 36: `redirect('logout.php');`.

### `index.php` source ledger

- Direct `$_POST` keys: `identifier`, `password`.
- Form at line 154: `<form method="POST" novalidate>`.
- Behaviour/feedback at line 10: `redirect('staff/dashboard.php');`.
- Behaviour/feedback at line 13: `redirect('resident/dashboard.php');`.
- Behaviour/feedback at line 17: `redirect('landing.php');`.
- Behaviour/feedback at line 28: `$error = 'Please enter your username or Resident Number and password.';`.
- Behaviour/feedback at line 75: `$error = 'This account has been deactivated. Please contact the administrator.';`.
- Behaviour/feedback at line 86: `redirect('staff/change_password.php');`.
- Behaviour/feedback at line 89: `redirect('staff/complete_profile.php');`.
- Behaviour/feedback at line 91: `redirect('staff/dashboard.php');`.
- Behaviour/feedback at line 95: `$error = 'This account has been deactivated. Please contact the Barangay Health Center.';`.
- Behaviour/feedback at line 103: `redirect('resident/change_password.php');`.
- Behaviour/feedback at line 105: `redirect('resident/dashboard.php');`.
- Behaviour/feedback at line 117: `$error = 'Invalid username/Resident Number or password.';`.

### `login.php` source ledger

- Direct `$_POST` keys: `identifier`, `password`.
- Form at line 150: `<form method="POST" novalidate>`.
- Behaviour/feedback at line 10: `redirect('staff/dashboard.php');`.
- Behaviour/feedback at line 13: `redirect('resident/dashboard.php');`.
- Behaviour/feedback at line 24: `$error = 'Please enter your username or Resident Number and password.';`.
- Behaviour/feedback at line 71: `$error = 'This account has been deactivated. Please contact the administrator.';`.
- Behaviour/feedback at line 82: `redirect('staff/change_password.php');`.
- Behaviour/feedback at line 85: `redirect('staff/complete_profile.php');`.
- Behaviour/feedback at line 87: `redirect('staff/dashboard.php');`.
- Behaviour/feedback at line 91: `$error = 'This account has been deactivated. Please contact the Barangay Health Center.';`.
- Behaviour/feedback at line 99: `redirect('resident/change_password.php');`.
- Behaviour/feedback at line 101: `redirect('resident/dashboard.php');`.
- Behaviour/feedback at line 113: `$error = 'Invalid username/Resident Number or password.';`.

### `resident/change_password.php` source ledger

- Direct `$_POST` keys: `confirm_password`, `current_password`, `new_password`.
- Form at line 97: `<form method="POST">`.
- Modal overlays: `password-success-modal`.
- Behaviour/feedback at line 18: `get_flash('password_changed');`.
- Behaviour/feedback at line 34: `$error = 'Current password is incorrect.';`.
- Behaviour/feedback at line 38: `$error = 'Your new password does not meet the requirements: ' . implode('; ', $policy_failures) . '.';`.
- Behaviour/feedback at line 40: `$error = 'Your new password must be different from your current one.';`.
- Behaviour/feedback at line 42: `$error = 'New password and confirmation do not match.';`.
- Behaviour/feedback at line 52: `set_flash('password_changed', $is_first_login ? 'first' : 'normal');`.
- Behaviour/feedback at line 53: `redirect('change_password.php');`.

### `resident/confirmation.php` source ledger

- Direct `$_GET` keys: `survey_id`.

### `resident/export_response.php` source ledger

- Direct `$_GET` keys: `id`.

### `resident/login.php` source ledger

- Behaviour/feedback at line 5: `redirect('login.php') from other files in * this folder keep working. */ require_once '../config/functions.php';`.
- Behaviour/feedback at line 9: `redirect('../index.php');`.

### `resident/logout.php` source ledger

- Behaviour/feedback at line 13: `redirect('login.php');`.

### `resident/profile.php` source ledger

- Direct `$_POST` keys: `action`, `birthdate`, `children`, `contact_number`, `courtesy_title`, `courtesy_title_other`, `email`, `family_reason`, `first_name`, `has_children`, `hotline_number`, `is_married`, `last_name`, `middle_name`, `name_extension`, `occupation`, `references`, `remove_photo`, `request_family_change`, `temp_`, `upload_photo`.
- Direct `$_FILES` keys: `profile_photo`.
- Form at line 647: `<form method="POST" class="photo-remove-form">`.
- Form at line 655: `<form id="photo-upload-form" method="POST" enctype="multipart/form-data" class="profile-photo-form">`.
- Form at line 704: `<form method="POST" class="profile-request-form" data-dirty-warn>`.
- Form at line 730: `<form method="POST" class="profile-request-form" data-dirty-warn>`.
- Form at line 823: `<form method="POST" class="profile-request-form" data-dirty-warn>`.
- Form at line 887: `<form method="POST" data-unsaved-warning>`.
- Modal overlays: `photo-confirm-modal`, `edit-contact-modal`, `request-change-modal`, `request-birthdate-modal`, `profile-success-modal`, `family-request-modal`.
- Behaviour/feedback at line 9: `$message = $_SESSION['profile_flash_message'] ?? '';`.
- Behaviour/feedback at line 10: `$error = $_SESSION['profile_flash_error'] ?? '';`.
- Behaviour/feedback at line 48: `$_SESSION['profile_flash_success'] = 'Profile photo removed. Your initial is shown instead.';`.
- Behaviour/feedback at line 49: `header('Location: profile.php');`.
- Behaviour/feedback at line 56: `$upload_error = 'Please select a photo to upload.';`.
- Behaviour/feedback at line 61: `$upload_error = 'The selected photo is too large.';`.
- Behaviour/feedback at line 64: `$upload_error = 'The upload was interrupted. Please try again.';`.
- Behaviour/feedback at line 67: `$upload_error = 'Please select a photo to upload.';`.
- Behaviour/feedback at line 70: `$upload_error = 'There was a problem uploading your photo. Please try again.';`.
- Behaviour/feedback at line 81: `$upload_error = 'Uploaded file must be a valid image.';`.
- Behaviour/feedback at line 83: `$upload_error = 'Only JPG, PNG, GIF, or WEBP images are allowed.';`.
- Behaviour/feedback at line 87: `$upload_error = 'Unable to create the upload directory. Please contact support.';`.
- Behaviour/feedback at line 93: `$upload_error = 'Unable to save the uploaded photo. Please try again.';`.
- Behaviour/feedback at line 102: `$message = 'Profile photo uploaded successfully.';`.
- Behaviour/feedback at line 117: `$error = 'Please provide your email or contact number to update.';`.
- Behaviour/feedback at line 120: `$error = 'A contact number can only contain digits, spaces, +, -, and brackets.';`.
- Behaviour/feedback at line 130: `$message = 'Your email and contact information have been updated successfully.';`.
- Behaviour/feedback at line 146: `$_SESSION['profile_flash_error'] = 'You already have a pending request under review.';`.
- Behaviour/feedback at line 147: `$_SESSION['profile_show_birthdate_modal'] = true;`.
- Behaviour/feedback at line 149: `$_SESSION['profile_flash_error'] = 'Choose the corrected birthdate.';`.
- Behaviour/feedback at line 150: `$_SESSION['profile_show_birthdate_modal'] = true;`.
- Behaviour/feedback at line 152: `$_SESSION['profile_flash_error'] = 'Birthdate must be in the past.';`.
- Behaviour/feedback at line 153: `$_SESSION['profile_show_birthdate_modal'] = true;`.
- Behaviour/feedback at line 155: `$_SESSION['profile_flash_error'] = 'That is the birthdate already on record.';`.
- Behaviour/feedback at line 156: `$_SESSION['profile_show_birthdate_modal'] = true;`.
- Behaviour/feedback at line 163: `$_SESSION['profile_flash_message'] = 'Your birthdate correction has been sent to staff for review.';`.
- Behaviour/feedback at line 165: `header('Location: profile.php');`.
- Behaviour/feedback at line 240: `$_SESSION['profile_flash_error'] = 'You already have a pending name/address request under review.';`.
- Behaviour/feedback at line 241: `$_SESSION['profile_show_request_modal'] = true;`.
- Behaviour/feedback at line 242: `header('Location: profile.php');`.
- Behaviour/feedback at line 245: `$_SESSION['profile_flash_error'] = 'First name and last name cannot be blank.';`.
- Behaviour/feedback at line 246: `$_SESSION['profile_show_request_modal'] = true;`.
- Behaviour/feedback at line 247: `header('Location: profile.php');`.
- Behaviour/feedback at line 250: `$_SESSION['profile_flash_error'] = 'Please fill in: ' . implode(', ', $missing) . '.';`.
- Behaviour/feedback at line 251: `$_SESSION['profile_show_request_modal'] = true;`.
- Behaviour/feedback at line 252: `header('Location: profile.php');`.
- Behaviour/feedback at line 255: `$_SESSION['profile_flash_error'] = 'A Philippine postal code is four digits.';`.
- Behaviour/feedback at line 256: `$_SESSION['profile_show_request_modal'] = true;`.
- Behaviour/feedback at line 257: `header('Location: profile.php');`.
- Behaviour/feedback at line 260: `$_SESSION['profile_flash_error'] = 'These entries are too long: ' . implode(', ', $over) . '.';`.
- Behaviour/feedback at line 261: `$_SESSION['profile_show_request_modal'] = true;`.
- Behaviour/feedback at line 262: `header('Location: profile.php');`.
- Behaviour/feedback at line 265: `$_SESSION['profile_flash_error'] = 'These entries are too long: ' . implode(', ', $over) . '.';`.
- Behaviour/feedback at line 266: `$_SESSION['profile_show_request_modal'] = true;`.
- Behaviour/feedback at line 267: `header('Location: profile.php');`.
- Behaviour/feedback at line 270: `$_SESSION['profile_flash_error'] = 'Nothing has changed yet. Edit a name or address field before sending the request.';`.
- Behaviour/feedback at line 271: `$_SESSION['profile_show_request_modal'] = true;`.
- Behaviour/feedback at line 272: `header('Location: profile.php');`.
- Behaviour/feedback at line 295: `$_SESSION['profile_flash_message'] = 'Your name and address update request has been sent to staff for review.';`.
- Behaviour/feedback at line 296: `header('Location: profile.php');`.
- Behaviour/feedback at line 377: `$problems[] = 'Give a short reason so staff know what you are correcting.';`.
- Behaviour/feedback at line 380: `$problems[] = 'Enter your spouse\'s first name, or answer No to "Are you married?".';`.
- Behaviour/feedback at line 383: `$problems[] = 'At least one character reference is required.';`.
- Behaviour/feedback at line 386: `$problems[] = 'Check the hotline number. ' . hotline_format_hint();`.
- Behaviour/feedback at line 389: `$problems[] = 'You already have a change waiting for review. Staff will look at that one first.';`.
- Behaviour/feedback at line 393: `$family_error = $problems[0];`.
- Behaviour/feedback at line 404: `$_SESSION['flash_success'] = 'Your family details change was sent to barangay staff for review.';`.
- Behaviour/feedback at line 405: `redirect('profile.php');`.

### `resident/stat_detail.php` source ledger

- Direct `$_GET` keys: `view`.
- Behaviour/feedback at line 90: `redirect('dashboard.php');`.

### `resident/submit.php` source ledger

- Direct `$_POST` keys: `q`, `survey_id`.
- Behaviour/feedback at line 7: `redirect('surveys.php');`.
- Behaviour/feedback at line 20: `redirect('surveys.php');`.
- Behaviour/feedback at line 28: `redirect('surveys.php');`.
- Behaviour/feedback at line 79: `redirect('survey_form.php?id=' . $survey_id . '&error=empty');`.
- Behaviour/feedback at line 102: `redirect('surveys.php?submitted=' . $survey_id);`.
- Behaviour/feedback at line 111: `redirect('surveys.php');`.
- Behaviour/feedback at line 115: `redirect('survey_form.php?id=' . $survey_id . '&error=failed');`.
- Behaviour/feedback at line 119: `redirect('survey_form.php?id=' . $survey_id . '&error=failed');`.

### `resident/survey_form.php` source ledger

- Direct `$_GET` keys: `error`, `id`.
- Form at line 64: `<form method="POST" action="submit.php" id="survey-answer-form">`.
- Behaviour/feedback at line 16: `redirect('surveys.php');`.
- Behaviour/feedback at line 24: `redirect('surveys.php');`.

### `resident/surveys.php` source ledger

- Direct `$_GET` keys: `submitted`.
- Modal overlays: `submitted-modal`.

### `resident/view_response.php` source ledger

- Direct `$_GET` keys: `id`, `print`.
- Behaviour/feedback at line 23: `redirect('history.php');`.

### `staff/add_survey.php` source ledger

- Direct `$_POST` keys: `description`, `end_date`, `questions`, `start_date`, `title`.
- Form at line 82: `<form method="POST" id="survey-builder-form" data-dirty-warn>`.
- Modal overlays: `survey-preview-modal`.
- Behaviour/feedback at line 18: `$error = 'Title, start date, and end date are required.';`.
- Behaviour/feedback at line 20: `$error = 'Give the survey a real title - at least eight characters that describe what it is about.';`.
- Behaviour/feedback at line 22: `$error = 'Either write a proper description of at least ten characters, or leave it blank.';`.
- Behaviour/feedback at line 24: `$error = 'Start date cannot be after end date.';`.
- Behaviour/feedback at line 30: `$error = 'Please add at least one question, and give it a question to ask.';`.
- Behaviour/feedback at line 66: `redirect('survey_management.php');`.
- Behaviour/feedback at line 69: `$error = 'An error occurred while creating the survey.';`.

### `staff/address_requests.php` source ledger

- Direct `$_POST` keys: `action`, `family_action`, `family_comment`, `family_request_id`, `request_id`, `review_comment`, `staff_request_id`.
- Form at line 381: `<form method="POST" style="display:inline-flex; gap:8px; align-items:center;">`.
- Form at line 386: `<form method="POST" style="display:inline-flex; gap:8px; align-items:center;">`.
- Form at line 488: `<form method="POST">`.
- Form at line 575: `<form method="POST" class="inline-review-form">`.
- Modal overlays: `staff-review-modal`, `address-request-success-modal`.
- Behaviour/feedback at line 41: `$error = 'That request has already been decided.';`.
- Behaviour/feedback at line 45: `$error = 'That request could not be read and was left pending.';`.
- Behaviour/feedback at line 97: `$_SESSION['flash_success'] = $decision === 'approved' ? 'Family details updated from the resident\'s request.' : 'Family details request rejected. Nothing on the record changed.';`.
- Behaviour/feedback at line 100: `redirect('address_requests.php');`.
- Behaviour/feedback at line 104: `$error = 'That request could not be applied. Nothing was changed.';`.
- Behaviour/feedback at line 112: `$error = 'Only an administrator can review staff address changes.';`.
- Behaviour/feedback at line 125: `$error = 'That staff request was not found, or it has already been reviewed.';`.
- Behaviour/feedback at line 163: `$message = 'Staff address request has been ' . $action . '.';`.
- Behaviour/feedback at line 181: `$error = 'Request not found or already processed.';`.
- Behaviour/feedback at line 275: `$message = 'Request has been ' . ($action === 'approved' ? 'approved' : 'rejected') . '.';`.

### `staff/ajax_stats.php` source ledger

- Direct `$_GET` keys: `from`, `to`.

### `staff/change_password.php` source ledger

- Direct `$_POST` keys: `confirm_password`, `current_password`, `new_password`.
- Form at line 115: `<form method="POST">`.
- Modal overlays: `password-success-modal`.
- Behaviour/feedback at line 22: `get_flash('password_changed');`.
- Behaviour/feedback at line 38: `$error = 'Current password is incorrect.';`.
- Behaviour/feedback at line 44: `$error = 'Your new password cannot be your Staff Number. That is the temporary password printed on your hand-over slip.';`.
- Behaviour/feedback at line 48: `$error = 'Your new password does not meet the requirements: ' . implode('; ', $policy_failures) . '.';`.
- Behaviour/feedback at line 50: `$error = 'Your new password must be different from your current one.';`.
- Behaviour/feedback at line 52: `$error = 'New password and confirmation do not match.';`.
- Behaviour/feedback at line 62: `set_flash('success', 'Password set. One more step: tell us how to reach you.');`.
- Behaviour/feedback at line 63: `redirect('complete_profile.php');`.
- Behaviour/feedback at line 67: `set_flash('password_changed', $is_first_login ? 'first' : 'normal');`.
- Behaviour/feedback at line 68: `redirect('change_password.php');`.

### `staff/complete_profile.php` source ledger

- Direct `$_POST` keys: `barangay`, `birthdate`, `contact_number`, `email`, `emergency_contact_name`, `emergency_contact_number`, `gender`, `household_number`, `license_number`, `municipality`, `postal_code`, `province`, `purok`, `reason`, `remove_photo`, `street_highway`, `upload_photo`.
- Direct `$_FILES` keys: `profile_photo`.
- Form at line 348: `<form method="POST" class="photo-remove-form">`.
- Form at line 356: `<form id="photo-upload-form" method="POST" enctype="multipart/form-data" class="profile-photo-form">`.
- Form at line 365: `<form method="POST">`.
- Modal overlays: `photo-confirm-modal`, `profile-success-modal`.
- Behaviour/feedback at line 45: `redirect('logout.php');`.
- Behaviour/feedback at line 49: `get_flash('profile_saved');`.
- Behaviour/feedback at line 86: `$_SESSION['flash_success'] = 'Profile photo removed. Your initial is shown instead.';`.
- Behaviour/feedback at line 87: `redirect('complete_profile.php');`.
- Behaviour/feedback at line 94: `$upload_error = 'Please select a photo to upload.';`.
- Behaviour/feedback at line 99: `$upload_error = 'The selected photo is too large.';`.
- Behaviour/feedback at line 102: `$upload_error = 'The upload was interrupted. Please try again.';`.
- Behaviour/feedback at line 105: `$upload_error = 'Please select a photo to upload.';`.
- Behaviour/feedback at line 108: `$upload_error = 'There was a problem uploading your photo. Please try again.';`.
- Behaviour/feedback at line 120: `$upload_error = 'Uploaded file must be a valid image.';`.
- Behaviour/feedback at line 122: `$upload_error = 'Only JPG, PNG, GIF, or WEBP images are allowed.';`.
- Behaviour/feedback at line 124: `$upload_error = 'Please choose a photo under 5 MB.';`.
- Behaviour/feedback at line 128: `$upload_error = 'Unable to create the upload directory. Please contact the administrator.';`.
- Behaviour/feedback at line 134: `$upload_error = 'Unable to save the uploaded photo. Please try again.';`.
- Behaviour/feedback at line 151: `set_flash('profile_saved', 'photo');`.
- Behaviour/feedback at line 152: `redirect('complete_profile.php');`.
- Behaviour/feedback at line 202: `$error = 'Contact number is required.';`.
- Behaviour/feedback at line 204: `$error = 'Enter a contact number using digits, spaces, and + ( ) - only.';`.
- Behaviour/feedback at line 206: `$error = 'Enter a valid email address, or leave the field blank.';`.
- Behaviour/feedback at line 208: `$error = 'Birthdate must be in the past.';`.
- Behaviour/feedback at line 210: `$error = 'That license number is too long (50 characters maximum).';`.
- Behaviour/feedback at line 212: `$error = 'Enter a license number using letters, digits, spaces, and - / only.';`.
- Behaviour/feedback at line 214: `$error = 'Enter an emergency contact number using digits, spaces, and + ( ) - only.';`.
- Behaviour/feedback at line 216: `$error = 'Household Number, Barangay, Municipality/City, and Province are required.';`.
- Behaviour/feedback at line 218: `$error = 'A Philippine postal code is four digits.';`.
- Behaviour/feedback at line 220: `$error = 'Give a short reason for the address change so the administrator can act on it.';`.
- Behaviour/feedback at line 279: `set_flash('profile_saved', $outcome);`.
- Behaviour/feedback at line 280: `redirect('complete_profile.php');`.

### `staff/deleted_accounts.php` source ledger

- Direct `$_POST` keys: `id`, `kind`, `purge`, `restore`.
- Form at line 176: `<form method="POST" class="inline-select-form">`.
- Form at line 236: `<form method="POST" class="inline-select-form">`.
- Form at line 270: `<form method="POST">`.
- Modal overlays: `purge-modal`.
- Behaviour/feedback at line 21: `$message = get_flash('success');`.
- Behaviour/feedback at line 21: `get_flash('success');`.
- Behaviour/feedback at line 47: `set_flash('success', 'Account restored. It can sign in again and its records are back in the lists.');`.
- Behaviour/feedback at line 49: `set_flash('success', 'That account was not found in the archive, or it has already been restored.');`.
- Behaviour/feedback at line 51: `redirect('deleted_accounts.php');`.
- Behaviour/feedback at line 67: `$error = 'You cannot permanently delete the account you are signed in with.';`.
- Behaviour/feedback at line 78: `set_flash('success', $gone ? 'Account permanently deleted. This one cannot be undone.' : 'That account was not found in the archive.');`.
- Behaviour/feedback at line 81: `redirect('deleted_accounts.php');`.

### `staff/deletion_requests.php` source ledger

- Direct `$_POST` keys: `action`, `request_id`, `review_comment`.
- Form at line 261: `<form method="POST">`.
- Modal overlays: `review-request-modal`.
- Behaviour/feedback at line 16: `$message = get_flash('success');`.
- Behaviour/feedback at line 16: `get_flash('success');`.
- Behaviour/feedback at line 24: `$error = 'Only an administrator can approve or reject a deletion request.';`.
- Behaviour/feedback at line 37: `$error = 'That request was not found, or it has already been reviewed.';`.
- Behaviour/feedback at line 41: `$error = 'Give a short reason when rejecting a request.';`.
- Behaviour/feedback at line 73: `set_flash('success', $action === 'approved' ? 'Request approved. ' . $request['resident_name'] . ' was moved to Deleted Accounts and can be restored from there.' : 'Request rejected. The record was left untouched.');`.
- Behaviour/feedback at line 76: `redirect('deletion_requests.php');`.

### `staff/edit_survey.php` source ledger

- Direct `$_GET` keys: `id`.
- Direct `$_POST` keys: `description`, `end_date`, `start_date`, `status`, `title`.
- Form at line 57: `<form method="POST">`.
- Behaviour/feedback at line 19: `redirect('survey_management.php');`.
- Behaviour/feedback at line 30: `$error = 'Title, start date, and end date are required.';`.
- Behaviour/feedback at line 32: `$error = 'Give the survey a real title - at least eight characters that describe what it is about.';`.
- Behaviour/feedback at line 34: `$error = 'Either write a proper description of at least ten characters, or leave it blank.';`.
- Behaviour/feedback at line 36: `$error = 'Start date cannot be after end date.';`.
- Behaviour/feedback at line 42: `$message = 'Survey updated successfully.';`.

### `staff/export_csv.php` source ledger

- Direct `$_GET` keys: `survey_id`.
- Behaviour/feedback at line 14: `redirect('reports.php');`.

### `staff/family_requests.php` source ledger

- Direct `$_POST` keys: `action`, `request_id`, `review_comment`.
- Form at line 212: `<form method="POST" class="review-inline-form">`.
- Behaviour/feedback at line 27: `$error = 'Request not found or already processed.';`.
- Behaviour/feedback at line 31: `$error = 'The stored family request is invalid and could not be reviewed.';`.
- Behaviour/feedback at line 52: `$validation[] = 'The approved spouse entry is missing a first name.';`.
- Behaviour/feedback at line 55: `$validation[] = 'The approved spouse entry is missing a surname.';`.
- Behaviour/feedback at line 58: `$validation[] = 'The approved request says the resident has children but contains no child.';`.
- Behaviour/feedback at line 61: `$validation[] = 'At least one character reference is required.';`.
- Behaviour/feedback at line 64: `$validation[] = 'The hotline number is invalid.';`.
- Behaviour/feedback at line 68: `$error = $validation[0];`.
- Behaviour/feedback at line 107: `$message = 'Family & Household changes approved and written to the resident record shared by Admin and Staff portals.';`.
- Behaviour/feedback at line 111: `$error = 'The family changes could not be saved. Nothing was changed.';`.
- Behaviour/feedback at line 122: `$message = $closed ? 'Family & Household request rejected.' : 'The request was already processed.';`.

### `staff/login.php` source ledger

- Behaviour/feedback at line 4: `redirect('login.php') * from other files in this folder keep working. */ require_once '../config/functions.php';`.
- Behaviour/feedback at line 8: `redirect('../admin/index.php');`.

### `staff/logout.php` source ledger

- Behaviour/feedback at line 13: `redirect('login.php');`.

### `staff/question_management.php` source ledger

- Direct `$_GET` keys: `added`, `delete`, `deleted`, `move`, `moved`, `qid`, `survey_id`, `updated`.
- Direct `$_POST` keys: `choices`, `existing_choices`, `new_choices`, `question_id`, `question_text`, `question_type`, `update_question`.
- Form at line 314: `<form method="POST" id="add-question-form" data-dirty-warn>`.
- Form at line 360: `<form method="POST" id="edit-question-form" data-dirty-warn>`.
- Modal overlays: `add-question-modal`, `edit-question-modal`, `question-success-modal`.
- Behaviour/feedback at line 21: `redirect('survey_management.php');`.
- Behaviour/feedback at line 53: `redirect('question_management.php?survey_id=' . $survey_id . '&deleted=1');`.
- Behaviour/feedback at line 56: `$message = 'Question deleted.';`.
- Behaviour/feedback at line 96: `redirect('question_management.php?survey_id=' . $survey_id . '&moved=1');`.
- Behaviour/feedback at line 99: `$message = 'Question order updated.';`.
- Behaviour/feedback at line 113: `$error = 'Question text is required.';`.
- Behaviour/feedback at line 116: `$error = 'Write the question out in words: at least five characters, and not one repeated character.';`.
- Behaviour/feedback at line 119: `$error = 'A multiple-choice question needs at least two choices. Blank boxes are ignored.';`.
- Behaviour/feedback at line 139: `redirect('question_management.php?survey_id=' . $survey_id . '&added=1');`.
- Behaviour/feedback at line 143: `$message = 'Question added.';`.
- Behaviour/feedback at line 170: `$error = 'That question does not belong to this survey.';`.
- Behaviour/feedback at line 172: `$error = 'Question text is required.';`.
- Behaviour/feedback at line 175: `$error = 'Write the question out in words: at least five characters, and not one repeated character.';`.
- Behaviour/feedback at line 178: `$error = 'A multiple-choice question needs at least two choices. Blank boxes are ignored.';`.
- Behaviour/feedback at line 216: `redirect('question_management.php?survey_id=' . $survey_id . '&updated=1');`.
- Behaviour/feedback at line 220: `$message = 'Question updated.';`.

### `staff/reports.php` source ledger

- Direct `$_GET` keys: `survey_id`.
- Form at line 81: `<form method="GET">`.

### `staff/residency_records.php` source ledger

- Direct `$_GET` keys: `filter`.

### `staff/resident_management.php` source ledger

- Direct `$_GET` keys: `delete`, `edit`, `reset`, `toggle`.
- Direct `$_POST` keys: `add_resident`, `birthdate`, `birthplace`, `category_reference`, `children`, `contact_number`, `courtesy_title`, `courtesy_title_other`, `email`, `first_name`, `gender`, `has_children`, `hotline_number`, `is_married`, `last_name`, `middle_name`, `name_extension`, `occupation`, `promote_resident`, `reason`, `references`, `request_delete`, `residence_type`, `residency_start_date`, `residency_status`, `resident_id`, `revert_resident`, `special_category`, `temp_`, `update_resident`.
- Form at line 1276: `<form method="POST">`.
- Form at line 1487: `<form method="POST">`.
- Form at line 2070: `<form method="POST">`.
- Form at line 2323: `<form method="POST">`.
- Form at line 2360: `<form method="POST">`.
- Modal overlays: `add-resident-modal`, `edit-resident-chooser-modal`, `edit-resident-info-modal`, `resident-success-modal`, `request-delete-modal`, `promote-resident-modal`, `revert-resident-modal`.
- Behaviour/feedback at line 25: `$message = $_SESSION['flash_success'];`.
- Behaviour/feedback at line 31: `$error = $_SESSION['flash_error'];`.
- Behaviour/feedback at line 51: `$_SESSION['flash_success'] = "Password reset to default (resident number).";`.
- Behaviour/feedback at line 52: `redirect('resident_management.php');`.
- Behaviour/feedback at line 70: `$_SESSION['flash_error'] = 'Only an administrator can delete a resident record. Use Request Deletion instead, or deactivate the account to block access without losing their survey history.';`.
- Behaviour/feedback at line 71: `redirect('resident_management.php');`.
- Behaviour/feedback at line 106: `$_SESSION['flash_success'] = $deleted ? 'Resident moved to Deleted Accounts. Their survey responses were kept, and you can restore the account from there.' : 'Resident could not be found.';`.
- Behaviour/feedback at line 109: `redirect('resident_management.php');`.
- Behaviour/feedback at line 136: `$_SESSION['flash_success'] = $new_state ? 'Resident account reactivated.' : 'Resident account deactivated. Their survey history has been kept.';`.
- Behaviour/feedback at line 139: `redirect('resident_management.php');`.
- Behaviour/feedback at line 154: `$error = 'Give a reason so the administrator can act on the request.';`.
- Behaviour/feedback at line 163: `$error = 'That resident could not be found.';`.
- Behaviour/feedback at line 174: `$_SESSION['flash_success'] = 'A deletion request for this resident is already waiting for the administrator.';`.
- Behaviour/feedback at line 175: `redirect('resident_management.php');`.
- Behaviour/feedback at line 189: `$_SESSION['flash_success'] = 'Deletion request sent to the administrator for ' . $resident_name . '. The account is untouched until they decide.';`.
- Behaviour/feedback at line 190: `redirect('resident_management.php');`.
- Behaviour/feedback at line 216: `$_SESSION['flash_error'] = 'Resident not found.';`.
- Behaviour/feedback at line 218: `$_SESSION['flash_error'] = 'That resident is already permanent.';`.
- Behaviour/feedback at line 221: `$_SESSION['flash_error'] = 'This resident has no temporary address on file, so there is nothing to promote. Edit their record first.';`.
- Behaviour/feedback at line 223: `$_SESSION['flash_error'] = 'Set a valid "Residing Here Since" date on this resident before making them permanent.';`.
- Behaviour/feedback at line 225: `$_SESSION['flash_error'] = 'This resident has stayed only ' . format_residency_duration($duration) . '. They must reach ' . permanent_residency_min_months() . ' months before being made permanent.';`.
- Behaviour/feedback at line 278: `$_SESSION['flash_success'] = trim($person['first_name'] . ' ' . $person['last_name']) . ' is now a permanent resident. Their previous address is kept in Residency Records.';`.
- Behaviour/feedback at line 281: `redirect('resident_management.php');`.
- Behaviour/feedback at line 310: `$_SESSION['flash_error'] = 'Resident not found.';`.
- Behaviour/feedback at line 312: `$_SESSION['flash_error'] = 'That resident is already temporary.';`.
- Behaviour/feedback at line 314: `$_SESSION['flash_error'] = 'Give a reason before reverting someone to temporary. It is kept on the record.';`.
- Behaviour/feedback at line 409: `$_SESSION['flash_success'] = trim($person['first_name'] . ' ' . $person['last_name']) . ' has been returned to temporary resident status.' . ($needs_type ? ' Open their record and set the Type of Temporary Residence.' : '') . ($promotion ? '' : ' No archived address existed, so their address on file became the temporary one - enter their permanent address next.');`.
- Behaviour/feedback at line 414: `redirect('resident_management.php');`.
- Behaviour/feedback at line 505: `$family_errors[] = 'Enter the spouse\'s surname, or answer No to "Is this resident married?".';`.
- Behaviour/feedback at line 508: `$family_errors[] = 'Enter the spouse\'s first name, or answer No to "Is this resident married?".';`.
- Behaviour/feedback at line 511: `$family_errors[] = 'Add at least one child, or answer No to "Does this resident have children?".';`.
- Behaviour/feedback at line 514: `$family_errors[] = 'At least one character reference is required.';`.
- Behaviour/feedback at line 517: `$family_errors[] = 'Check the hotline number. ' . hotline_format_hint();`.
- Behaviour/feedback at line 520: `$family_errors[] = 'That occupation is too long (100 characters maximum).';`.
- Behaviour/feedback at line 619: `$error = 'Please fill in all required fields (marked with *).';`.
- Behaviour/feedback at line 625: `$error = $family_errors[0];`.
- Behaviour/feedback at line 629: `$error = 'Please fill in: ' . implode(', ', $missing) . '.';`.
- Behaviour/feedback at line 633: `$error = 'Choose the type of temporary residence.';`.
- Behaviour/feedback at line 637: `$error = 'A Philippine postal code is four digits.';`.
- Behaviour/feedback at line 641: `$error = 'A contact number can only contain digits, spaces, +, -, and brackets.';`.
- Behaviour/feedback at line 648: `$error = 'These entries are too long: ' . implode(', ', $over) . '.';`.
- Behaviour/feedback at line 655: `$error = 'Enter the ' . $fields[$special_category]['label'] . ' for this resident, or set the category to None.';`.
- Behaviour/feedback at line 660: `$error = 'That reference number is too long (60 characters maximum).';`.
- Behaviour/feedback at line 667: `$error = $fields[$special_category]['error'];`.
- Behaviour/feedback at line 671: `$error = 'Enter the date this person began residing in the barangay.';`.
- Behaviour/feedback at line 675: `$error = 'The residency start date is not a valid past date.';`.
- Behaviour/feedback at line 683: `$error = 'This person has been residing here for only ' . format_residency_duration($residency_duration) . '. A resident must complete at least ' . permanent_residency_min_months() . ' months before they can be recorded as Permanent. Register them as Temporary for now,' . ' then change the status once they reach ' . permanent_residency_min_months() . ' months.';`.
- Behaviour/feedback at line 691: `$error = 'The residency start date cannot be earlier than the birthdate.';`.
- Behaviour/feedback at line 696: `$error = 'Birthdate cannot be in the future.';`.
- Behaviour/feedback at line 704: `$error = 'A resident with the generated Resident Number already exists. Please try again.';`.
- Behaviour/feedback at line 776: `$error = 'The resident could not be saved. Please try again.';`.
- Behaviour/feedback at line 783: `$_SESSION['flash_success'] = "Resident added successfully. Their auto-generated Resident Number (and default password) is: <strong>" . h($resident_number) . "</strong>";`.
- Behaviour/feedback at line 784: `redirect('resident_management.php');`.
- Behaviour/feedback at line 825: `$family_errors[] = 'Enter the spouse\'s surname, or answer No to "Is this resident married?".';`.
- Behaviour/feedback at line 828: `$family_errors[] = 'Enter the spouse\'s first name, or answer No to "Is this resident married?".';`.
- Behaviour/feedback at line 831: `$family_errors[] = 'Add at least one child, or answer No to "Does this resident have children?".';`.
- Behaviour/feedback at line 834: `$family_errors[] = 'At least one character reference is required.';`.
- Behaviour/feedback at line 837: `$family_errors[] = 'Check the hotline number. ' . hotline_format_hint();`.
- Behaviour/feedback at line 840: `$family_errors[] = 'That occupation is too long (100 characters maximum).';`.
- Behaviour/feedback at line 947: `$error = 'Please fill in all required fields (marked with *).';`.
- Behaviour/feedback at line 951: `$error = $family_errors[0];`.
- Behaviour/feedback at line 955: `$error = 'Please fill in: ' . implode(', ', $missing) . '.';`.
- Behaviour/feedback at line 959: `$error = 'Choose the type of temporary residence.';`.
- Behaviour/feedback at line 963: `$error = 'A contact number can only contain digits, spaces, +, -, and brackets.';`.
- Behaviour/feedback at line 970: `$error = 'These entries are too long: ' . implode(', ', $over) . '.';`.
- Behaviour/feedback at line 977: `$error = 'Enter the ' . $fields[$special_category]['label'] . ' for this resident, or set the category to None.';`.
- Behaviour/feedback at line 982: `$error = 'That reference number is too long (60 characters maximum).';`.
- Behaviour/feedback at line 989: `$error = $fields[$special_category]['error'];`.
- Behaviour/feedback at line 993: `$error = 'Enter the date this person began residing in the barangay.';`.
- Behaviour/feedback at line 997: `$error = 'The residency start date is not a valid past date.';`.
- Behaviour/feedback at line 1018: `$error = 'This person has been residing here for only ' . format_residency_duration($residency_duration) . '. A resident must complete at least ' . permanent_residency_min_months() . ' months before they can be recorded as Permanent. Revert them to Temporary ' . 'first if the date is correct.';`.
- Behaviour/feedback at line 1026: `$error = 'The residency start date cannot be earlier than the birthdate.';`.
- Behaviour/feedback at line 1030: `$error = 'Birthdate cannot be in the future.';`.
- Behaviour/feedback at line 1091: `$error = 'The changes could not be saved. Please try again.';`.
- Behaviour/feedback at line 1097: `$_SESSION['flash_success'] = 'Resident updated successfully.';`.
- Behaviour/feedback at line 1098: `redirect('resident_management.php');`.

### `staff/results_dashboard.php` source ledger

- Direct `$_GET` keys: `survey_id`.
- Form at line 121: `<form method="GET">`.

### `staff/stat_detail.php` source ledger

- Direct `$_GET` keys: `view`.
- Behaviour/feedback at line 228: `redirect('dashboard.php');`.
- Behaviour/feedback at line 234: `redirect('dashboard.php');`.

### `staff/statistics.php` source ledger

- Behaviour/feedback at line 8: `redirect('dashboard.php');`.

### `staff/survey_management.php` source ledger

- Direct `$_GET` keys: `delete`, `toggle`.
- Behaviour/feedback at line 29: `set_flash('success', 'Survey “' . ($survey['title'] ?? 'Survey') . '” was deleted successfully.');`.
- Behaviour/feedback at line 31: `set_flash('error', 'The selected survey could not be found or deleted.');`.
- Behaviour/feedback at line 34: `redirect('survey_management.php');`.
- Behaviour/feedback at line 44: `redirect('survey_management.php');`.

### `staff/user_management.php` source ledger

- Direct `$_GET` keys: `delete_staff`, `reset_staff`, `toggle_resident`, `toggle_staff`.
- Direct `$_POST` keys: `add_staff`, `courtesy_title`, `courtesy_title_other`, `date_hired`, `first_name`, `last_name`, `middle_name`, `name_extension`.
- Form at line 401: `<form method="POST">`.
- Modal overlays: `add-staff-modal`, `new-staff-modal`, `user-success-modal`.
- Behaviour/feedback at line 15: `$message = get_flash('success');`.
- Behaviour/feedback at line 15: `get_flash('success');`.
- Behaviour/feedback at line 17: `get_flash('new_staff');`.
- Behaviour/feedback at line 28: `$error = 'Only administrators can deactivate staff accounts.';`.
- Behaviour/feedback at line 30: `$error = 'You cannot deactivate your own account while logged in.';`.
- Behaviour/feedback at line 45: `set_flash('success', $new_state ? 'Staff account reactivated.' : 'Staff account deactivated.');`.
- Behaviour/feedback at line 46: `redirect('user_management.php');`.
- Behaviour/feedback at line 62: `$error = 'Only administrators can delete a staff account.';`.
- Behaviour/feedback at line 64: `$error = 'You cannot delete the account you are signed in with.';`.
- Behaviour/feedback at line 73: `$error = 'That staff account could not be found.';`.
- Behaviour/feedback at line 77: `$error = 'This is the only administrator account left. Promote or create another administrator before deleting this one.';`.
- Behaviour/feedback at line 81: `set_flash('success', $target['full_name'] . ' was moved to Deleted Accounts. You can restore the account from there.');`.
- Behaviour/feedback at line 82: `redirect('user_management.php');`.
- Behaviour/feedback at line 97: `$error = 'Only administrators can reset a staff password.';`.
- Behaviour/feedback at line 99: `$error = 'Use Change Password to update your own password.';`.
- Behaviour/feedback at line 114: `set_flash('success', 'Password reset to the Staff Number (' . $row['staff_number'] . '). They will be asked to set a new one at their next login.');`.
- Behaviour/feedback at line 115: `redirect('user_management.php');`.
- Behaviour/feedback at line 117: `$error = 'That staff account could not be found.';`.
- Behaviour/feedback at line 143: `set_flash('success', $new_state ? 'Resident account reactivated.' : 'Resident account deactivated.');`.
- Behaviour/feedback at line 144: `redirect('user_management.php');`.
- Behaviour/feedback at line 159: `$error = 'Only administrators can create staff accounts.';`.
- Behaviour/feedback at line 176: `$error = 'First name, last name, and date hired are required.';`.
- Behaviour/feedback at line 179: `$error = 'Date hired cannot be in the future.';`.
- Behaviour/feedback at line 207: `set_flash('new_staff', json_encode([ 'full_name' => with_courtesy_title($courtesy_title, $full_name), 'staff_number' => $staff_number, ]));`.
- Behaviour/feedback at line 211: `set_flash('success', 'Staff account created for ' . $full_name . '.');`.
- Behaviour/feedback at line 212: `redirect('user_management.php');`.

## 9. Task record and verification

| Prompt number | What was done | Open issues |
| --- | --- | --- |
| 1 — Part 1 (2026-11-04) | Created only `docs/migration-analysis.md`. Read project memory, examined requested PHP/JS source, documented page sections/components, guide answers, all PHP routes/dependencies and roles, per-page behaviour, shared JS, proposed API request/response contracts and exact source ledger. | Source discrepancies in §7 await later direction. Live rendering/database data not verified; React/build/lint toolchain does not exist. `docs/progress.md` intentionally unchanged under this prompt's one-file-only instruction. |

Verification performed without executing application PHP or database initialization:

- Inventoried all **47 `.php` files** recursively; every path is mentioned and has a row in the route/dependency map. No missing files or unmapped PHP paths.
- Cross-checked all **35 source form declarations**, **30 modal-overlay declarations** (including role/flash-dependent markup), direct GET/POST/FILES keys, and **323 redirect/flash/feedback expressions** in the ledger. Counts are source declarations, not rendered instances in loops. Runtime-generated question/choice/person names and actions are additionally documented in the behaviour/API sections.
- Checked Markdown table structure: **21 tables**, consistent column counts, including the requested three-column section tables; literal pipes in table code cells escaped.
- Compared SHA-256 snapshots of all **64 pre-existing non-Git files**: zero modifications and zero deletions. The only added file is `docs/migration-analysis.md`. Existing working-tree changes from before this task were preserved.
- `git diff --check` passed. No `package.json` exists anywhere in the project, so there is no build/lint command to run; no frontend scaffolding, package install, build output or lint configuration was created for this analysis.

No PHP page, configuration, include, asset, upload, database file, project memory file or progress log was changed. No database was recreated, reset, or queried, and no API or React implementation was started.
