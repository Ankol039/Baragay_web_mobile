import { TABLES } from '../src/mysql.mjs'
import { digest } from '../src/safety.mjs'
export function seal(s) {
  s.counts = Object.fromEntries(TABLES.map(t => [t, s.tables[t].length]))
  s.digest = digest({ tables: s.tables, photos: s.photos, warnings: s.warnings })
  return s
}
export function fixture() {
  const tables = Object.fromEntries(TABLES.map(t => [t, []]))
  const when = '2026-01-01 08:00:00', hash = '$2y$10$' + 'A'.repeat(53)
  tables.residents = [{ resident_id: 1, resident_number: 'R-2026-0009', first_name: 'Example', last_name: 'Resident', gender: 'male', password: hash,
    is_active: 1, is_first_login: 0, created_at: when, birthdate: '2000-01-01', residency_start_date: '2020-01-01', residency_status: 'permanent', special_category: 'none' }]
  tables.staff = [{ staff_id: 2, staff_number: 'S-2024-0012', username: 'Admin', full_name: 'Example Employee', password: hash, role: 'admin', created_at: when,
    is_active: 1, is_first_login: 0, profile_completed: 1 }]
  tables.surveys = [{ survey_id: 10, title: 'Example survey', description: '', start_date: '2026-01-01', end_date: '2026-12-31', status: 'active', created_by: 2, created_at: when }]
  tables.survey_questions = [{ question_id: 20, survey_id: 10, question_text: 'Example question', question_type: 'multiple_choice', question_order: 1 }]
  tables.survey_choices = [{ choice_id: 30, question_id: 20, choice_text: 'Example choice' }]
  tables.responses = [{ response_id: 40, resident_id: 1, survey_id: 10, submitted_at: when }]
  tables.survey_results = [{ answer_id: 50, response_id: 40, question_id: 20, choice_id: 30, rating_value: null, answer_text: null }]
  const name = { resident_id: 1, first_name: 'Example', last_name: 'Person', gender: 'female', display_order: 0, created_at: when }
  tables.resident_children = [{ ...name, child_id: 60 }]
  tables.resident_character_references = [{ ...name, reference_id: 61 }]
  tables.resident_update_requests = [{ request_id: 70, resident_id: 1, birthdate: '1999-01-01', status: 'pending', submitted_at: when }]
  tables.resident_family_requests = [{ request_id: 71, resident_id: 1, payload: JSON.stringify({ is_married: 0, has_children: 1, children: [name], references: [name] }), reason: 'Example reason', status: 'pending', requested_at: when }]
  tables.staff_update_requests = [{ request_id: 72, staff_id: 2, staff_number: 'S-2024-0012', staff_name: 'Example Employee', address: 'Example address', status: 'approved', submitted_at: when, reviewed_at: when, reviewed_by: 2 }]
  tables.resident_delete_requests = [{ request_id: 73, resident_id: 1, resident_number: 'R-2026-0009', resident_name: 'Example Resident', requested_by: 2, requested_by_name: 'Example Employee', reason: 'Example reason', status: 'rejected', requested_at: when, reviewed_at: when, reviewed_by: 2 }]
  tables.resident_residency_changes = [{ change_id: 74, resident_id: 1, from_status: 'temporary', to_status: 'permanent', changed_by: 2, changed_at: when, is_reverted: 0 }]
  tables.login_history = [{ log_id: 75, user_type: 'resident', user_id: 1, event: 'login', account_role: 'Permanent Resident', login_time: when, ip_address: null }]
  return seal({ schemaVersion: 1, capturedAt: '2026-01-01T00:00:00Z', tables, photos: [], warnings: {} })
}
