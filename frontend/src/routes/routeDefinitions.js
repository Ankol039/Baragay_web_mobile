// Screen paths from docs/migration-analysis.md §2.
// Query strings are preserved. Session guards are applied in AppRoutes.
export const publicRoutes = [
  {"path": "/landing", "title": "Barangay Health Center Survey System", "source": "landing.php", "icon": "profile", "documentTitle": ""},
  {"path": "/login", "title": "Sign In", "source": "login.php", "icon": "lock"},
]

export const residentRoutes = [
  {"path": "/resident/dashboard", "title": "Dashboard", "source": "resident/dashboard.php", "icon": "dashboard"},
  {"path": "/resident/stat-detail", "title": "Surveys Available", "source": "resident/stat_detail.php", "icon": "statistics"},
  {"path": "/resident/surveys", "title": "Available Surveys", "source": "resident/surveys.php", "icon": "surveys"},
  {"path": "/resident/survey-form", "title": "Survey", "source": "resident/survey_form.php", "icon": "surveys"},
  {"path": "/resident/confirmation", "title": "Submission Confirmed", "source": "resident/confirmation.php", "icon": "check"},
  {"path": "/resident/history", "title": "Submitted Surveys", "source": "resident/history.php", "icon": "reports"},
  {"path": "/resident/view-response", "title": "Submitted Response", "source": "resident/view_response.php", "icon": "reports"},
  {"path": "/resident/profile", "title": "My Profile", "source": "resident/profile.php", "icon": "profile"},
  {"path": "/resident/change-password", "title": "Change Password", "source": "resident/change_password.php", "icon": "password"},
]

export const staffRoutes = [
  {"path": "/staff/dashboard", "title": "Dashboard", "source": "staff/dashboard.php", "icon": "dashboard"},
  {"path": "/staff/stat-detail", "title": "Total Surveys", "source": "staff/stat_detail.php", "icon": "statistics"},
  {"path": "/staff/survey-management", "title": "Survey Management", "source": "staff/survey_management.php", "icon": "surveys"},
  {"path": "/staff/add-survey", "title": "Create Survey", "source": "staff/add_survey.php", "icon": "surveys"},
  {"path": "/staff/edit-survey", "title": "Edit Survey", "source": "staff/edit_survey.php", "icon": "edit"},
  {"path": "/staff/question-management", "title": "Question Management", "source": "staff/question_management.php", "icon": "surveys"},
  {"path": "/staff/results-dashboard", "title": "Results Dashboard", "source": "staff/results_dashboard.php", "icon": "results"},
  {"path": "/staff/reports", "title": "Printable Report", "source": "staff/reports.php", "icon": "reports"},
  {"path": "/staff/resident-management", "title": "Resident Management", "source": "staff/resident_management.php", "icon": "residents"},
  {"path": "/staff/user-management", "title": "User Management", "source": "staff/user_management.php", "icon": "staff"},
  {"path": "/staff/complete-profile", "title": "My Profile", "source": "staff/complete_profile.php", "icon": "profile"},
  {"path": "/staff/change-password", "title": "Change Password", "source": "staff/change_password.php", "icon": "password"},
  {"path": "/staff/address-requests", "title": "Address Requests", "source": "staff/address_requests.php", "icon": "residents"},
  {"path": "/staff/family-requests", "title": "Family & Household Requests", "source": "staff/family_requests.php", "icon": "residents"},
  {"path": "/staff/deletion-requests", "title": "Deletion Requests", "source": "staff/deletion_requests.php", "icon": "trash"},
  {"path": "/staff/deleted-accounts", "title": "Deleted Accounts", "source": "staff/deleted_accounts.php", "icon": "switch", "adminOnly": true},
  {"path": "/staff/residency-records", "title": "Residency Records", "source": "staff/residency_records.php", "icon": "clock", "adminOnly": true},
]

// PHP compatibility stubs are redirects; logout, submit, stats and CSV are API actions.
export const compatibilityRoutes = [
  {"path": "/admin", "to": "/"},
  {"path": "/admin/index.php", "to": "/"},
  {"path": "/resident/login", "to": "/"},
  {"path": "/resident/login.php", "to": "/"},
  {"path": "/staff/login", "to": "/"},
  {"path": "/staff/login.php", "to": "/"},
  {"path": "/staff/statistics", "to": "/staff/dashboard"},
  {"path": "/staff/statistics.php", "to": "/staff/dashboard"},
]
