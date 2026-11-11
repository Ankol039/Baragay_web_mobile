import { activityMonths, dateKey, dateLabel, residencyMonths, todayKey } from './format.js'

const residences = { AR: 'Apartment Residence', DR: 'Dormitory Residence', BH: 'Boarding House', BS: 'Bedspace', RL: "Relative's House", TR: 'Transient Room' }
export function dashboardData(account, profile, children, references, surveys, responses, history, now) {
  const answered = new Set(responses.map(row => row.surveyId))
  const available = surveys.filter(row => !answered.has(row.id)).sort((a, b) => dateKey(a.endDate).localeCompare(dateKey(b.endDate)))
  const upcoming = available.slice(0, 5).map(row => ({ survey_id: row.id, title: row.title, end_date: dateKey(row.endDate), end_date_label: dateLabel(row.endDate) }))
  const count = responses.length, total = available.length + count, temporary = profile.residencyStatus === 'temporary'
  const start = dateKey(profile.residencyStartDate), months = residencyMonths(start, todayKey(now)), household = []
  if (profile.household?.isMarried) household.push({ label: 'Spouse', value: 1 })
  if (children.length) household.push({ label: 'Children', value: children.length })
  if (references.length) household.push({ label: 'References', value: references.length })
  const permanent = profile.permanentAddress || {}, current = profile.temporaryAddress || {}
  const deadline = upcoming[0]?.end_date || null
  return {
    resident_name: `${profile.name?.firstName || ''} ${profile.name?.lastName || ''}`.trim() || account.displayName,
    available_count: available.length, answered_count: count, assigned_total: total,
    completion_pct: total ? Math.round(count / total * 100) : 0,
    completion: [{ label: 'Completed', value: count }, { label: 'Available', value: available.length }],
    upcoming, me: { address: permanent.displayLine || '', household_number: permanent.householdNumber || '',
      barangay: permanent.barangay || '', municipality: permanent.municipality || '', province: permanent.province || '',
      temporary_address: current.displayLine || '', temp_barangay: current.barangay || '', temp_municipality: current.municipality || '',
      temp_province: current.province || '', residency_start_date: start },
    is_temporary: temporary, residence_code: profile.residenceType || '', residence_name: residences[profile.residenceType] || '',
    activity_months: activityMonths(responses, now), has_activity: count > 0,
    household_rows: household, has_household: household.length > 0,
    residency_months: months, residency_minimum: 6, residency_pct: temporary ? Math.min(100, Math.round(months / 6 * 100)) : 100,
    has_residency_progress: Boolean(start), residency_start_label: start ? dateLabel(start) : null,
    recent_submissions: history.slice(0, 5).map(row => ({ title: row.title, submitted_at: row.submitted_at,
      submitted_at_label: dateLabel(row.instant, { event: true }) })),
    next_deadline: deadline, next_deadline_label: deadline ? dateLabel(deadline) : null,
    days_left: deadline ? Math.floor((new Date(deadline) - new Date(todayKey(now))) / 86400000) : null,
  }
}
