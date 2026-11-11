import { HttpError } from './core/errors.mjs'
import { genderOptions, loginTypeLabel } from './policy.mjs'
import { addDays, cmp, countValues, csvRow, csvFilename, dateOnly, label, manilaDay, midnight, phpTrim, round } from './report-format.mjs'

const unavailable = () => new HttpError('The system is temporarily unavailable. Please try again in a few minutes.', 503)
const invalid = () => new HttpError('Invalid request.', 400)
const views = {
  total_surveys: { title: 'Total Surveys', subtitle: 'Every survey ever created, newest first.', unit: 'surveys', admin: false, columns: ['Survey', 'Period', 'Status', 'Responses', ''] },
  active_surveys: { title: 'Active Surveys', subtitle: 'Surveys marked active and currently inside their open period.', unit: 'open surveys', admin: false, columns: ['Survey', 'Closes On', 'Days Left', 'Responses', ''] },
  total_residents: { title: 'Total Residents', subtitle: 'All registered resident accounts.', unit: 'residents', admin: false, columns: ['Resident No.', 'Name', 'Contact', 'Residency', 'Account'] },
  total_responses: { title: 'Survey Responses', subtitle: 'Every response submitted, newest first.', unit: 'responses', admin: false, columns: ['Survey', 'Resident', 'Submitted'] },
  staff_accounts: { title: 'Staff Accounts', subtitle: 'All staff and administrator accounts.', unit: 'accounts', admin: true, columns: ['Name', 'Username', 'Role', 'Account', 'Created'] },
  deactivated_residents: { title: 'Deactivated Residents', subtitle: 'Resident accounts that are currently blocked from logging in.', unit: 'deactivated residents', admin: true, columns: ['Resident No.', 'Name', 'Contact', 'Residency'] },
  deactivated_staff: { title: 'Deactivated Staff', subtitle: 'Staff accounts that are currently blocked from logging in.', unit: 'deactivated staff', admin: true, columns: ['Name', 'Username', 'Role', 'Created'] },
  recent_logins: { title: 'Login Activity', subtitle: 'Sign-ins across both portals, newest first.', unit: 'sign-ins', admin: true, columns: ['User', 'Type', 'Date & Time'] },
}
const time = value => value instanceof Date ? value.getTime() : Date.parse(value ?? '')
const timeSort = (a, b) => (time(a) || 0) - (time(b) || 0)
const latestFirst = (a, b) => timeSort(b, a)
const manilaDate = value => value instanceof Date || (typeof value === 'string' && /[T ]/.test(value)) ? manilaDay(value) : dateOnly(value)
const rowsOf = rows => rows.map(row => ({ id: row.id, ...row.data }))

async function query(ctx, tx, collectionId, select, { parent = '', where = [], limit = 0, orderBy = [], allDescendants = false } = {}) {
  try {
    return rowsOf(await ctx.store.query({ collectionId, ...(parent ? { parent } : {}), select,
      ...(where.length ? { where: where.map(([field, value]) => ({ field, op: 'EQUAL', value })) } : {}),
      ...(limit ? { limit } : {}), ...(orderBy.length ? { orderBy } : {}), ...(allDescendants ? { allDescendants: true } : {}) }, tx))
  } catch { throw unavailable() }
}
async function projectedDocument(ctx, tx, path, fields) {
  const result = await ctx.store.request(':batchGet', { documents: [ctx.store.name(path)], mask: { fieldPaths: fields }, transaction: tx })
  if (result.status !== 200 || !Array.isArray(result.body)) throw unavailable()
  const row = result.body.find(item => item.found)
  return row ? Object.fromEntries(Object.entries(row.found.fields || {}).map(([key, value]) => [key, ctx.store.decode(value)])) : null
}
function indexById(rows) { return Object.fromEntries(rows.map(row => [row.id, row])) }
function phpCompare(a, b) { return cmp(phpTrim(a).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase(), phpTrim(b).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()) }
function dayLabel(day) {
  const d = new Date(Date.parse(day + 'T00:00:00Z'))
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]
  return `${month} ${d.getUTCDate()}`
}
function dateLabel(value, withTime = false, fullMonth = false, padded = false) { return value ? label(value, withTime, fullMonth, padded) : '' }
function dayDiff(a, b) { return Math.floor((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000) }
function dateSpan(from, to) { return Math.min(365, dayDiff(to, from)) }
function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value
}
function trend(responses, input) {
  const to = validDate(input.to) ? input.to : manilaDay()
  const defaultFrom = addDays(to, -29)
  let from = validDate(input.from) ? input.from : defaultFrom
  let end = to
  if (from > end) [from, end] = [end, from]
  const span = dateSpan(from, end)
  const counts = countValues(responses.map(row => manilaDate(row.submittedAt)))
  const output = []
  for (let i = span; i >= 0; i--) {
    const day = addDays(end, -i)
    output.push({ label: dayLabel(day), value: counts.get(day) || 0 })
  }
  return output
}
function openSurvey(survey, today) { return survey.status === 'active' && survey.start_date <= today && survey.end_date >= today }
function delta(now, before) {
  if (!before) return now ? ['up', `+${Math.trunc(now)} new`] : ['flat', 'No change']
  const change = round((now - before) / before * 100)
  return change > 0 ? ['up', `+${change}%`] : change < 0 ? ['down', `${change}%`] : ['flat', 'No change']
}
async function users(ctx, tx) {
  return indexById(await query(ctx, tx, 'users', ['role', 'identifier', 'username', 'displayName', 'isActive', 'deletedAt', 'createdAt']))
}
async function residents(ctx, tx, userMap) {
  const profiles = await query(ctx, tx, 'residents', ['name.firstName', 'name.lastName', 'name.gender', 'contact.number', 'birthdate', 'household.occupation', 'household.isMarried', 'household.hasChildren', 'permanentAddress.purok', 'residencyStatus', 'specialCategory', 'createdAt'])
  const rows = profiles.filter(profile => (userMap[profile.id]?.role || '') === 'resident').map(profile => {
    const user = userMap[profile.id] || {}
    return { resident_id: profile.id, resident_number: user.identifier || '', first_name: profile.name?.firstName || '', last_name: profile.name?.lastName || '',
      gender: profile.name?.gender || '', birthdate: profile.birthdate ? manilaDate(profile.birthdate) : '', contact_number: profile.contact?.number || '',
      residency_status: profile.residencyStatus || 'permanent', special_category: profile.specialCategory || 'none', occupation: profile.household?.occupation || '',
      is_married: Boolean(profile.household?.isMarried), has_children: Boolean(profile.household?.hasChildren), purok: profile.permanentAddress?.purok || '',
      is_active: Number(Boolean(user.isActive)), deleted_at: user.deletedAt ?? null, created_at: profile.createdAt || '' }
  })
  return indexById(rows.map(row => ({ id: row.resident_id, ...row })))
}
async function surveys(ctx, tx) {
  const rows = await query(ctx, tx, 'surveys', ['title', 'description', 'startDate', 'endDate', 'status', 'createdAt', 'createdByUid'])
  rows.sort((a, b) => latestFirst(a.createdAt, b.createdAt) || cmp(a.id, b.id))
  return indexById(rows.map(survey => ({ id: survey.id, survey_id: survey.id, title: survey.title, description: survey.description || '',
    start_date: dateOnly(survey.startDate), end_date: dateOnly(survey.endDate), status: survey.status, created_at: survey.createdAt, created_by: survey.createdByUid ?? null })))
}
async function responses(ctx, tx, surveyId = null) {
  return query(ctx, tx, 'responses', ['surveyId', 'residentUid', 'submittedAt', 'legacyId'], { where: surveyId === null ? [] : [['surveyId', surveyId]] })
}
async function activity(ctx, tx, userMap, residentMap, event = '', stored = true) {
  const rows = await query(ctx, tx, 'loginHistory', ['actorUid', 'accountType', 'accountRole', 'at', 'event', 'legacyId'], {
    where: event ? [['event', event]] : [], limit: event ? 10 : 100, orderBy: [{ field: 'at', direction: 'DESCENDING' }],
  })
  return rows.map(row => {
    const user = userMap[row.actorUid] || {}, resident = residentMap[row.actorUid] || null
    const display = row.accountType === 'resident' && resident
      ? `${resident.first_name} ${resident.last_name}`
      : (user.displayName || `User #${String(row.actorUid || '').replace(/^(?:resident|staff)-(\d+)$/, '$1')}`)
    const item = { user_type: row.accountType, staff_role: user.role || '', residency_status: resident?.residency_status || '', person: display,
      login_time: row.at, login_time_label: dateLabel(row.at, true), time_label: dateLabel(row.at, true) }
    if (stored) item.account_role = row.accountRole || ''
    return { ...item, type_label: loginTypeLabel(item) }
  })
}
function portalBreakdown(rows) {
  const counts = { admin: 0, staff: 0, resident: 0, permanent: 0, temporary: 0 }
  for (const row of rows) {
    const label = loginTypeLabel(row).text
    if (row.user_type === 'staff') {
      if (label === 'Admin') counts.admin++
      else counts.staff++
    } else {
      counts.resident++
      if (label === 'Temporary Resident') counts.temporary++
      else counts.permanent++
    }
  }
  return counts
}
function surveyResponseCounts(responseRows) { return countValues(responseRows.map(row => row.surveyId)) }
function sortRows(rows, compare) { return [...rows].sort(compare) }
function ageOn(birthdate, today) {
  if (!birthdate) return null
  const [by, bm, bd] = birthdate.split('-').map(Number), [ty, tm, td] = today.split('-').map(Number)
  let age = ty - by
  if (tm < bm || (tm === bm && td < bd)) age--
  return age
}
function groupRows(rows, field, labels) {
  const counts = countValues(rows.map(row => row[field] || (field === 'gender' ? 'unstated' : 'none')))
  return Object.entries(labels).filter(([key]) => counts.get(key)).map(([key, label]) => ({ label, value: counts.get(key) }))
}
function topGroups(rows, field, occupation = false) {
  const counts = new Map()
  for (const row of rows) {
    const text = phpTrim(row[field])
    if (!text || (occupation && ['N/A', 'NA', 'NONE'].includes(text.toUpperCase()))) continue
    const key = text.normalize('NFKD').replace(/\p{M}/gu, '').toUpperCase()
    const current = counts.get(key)
    if (current) current.value++
    else counts.set(key, { label: text, value: 1 })
  }
  return sortRows([...counts.values()], (a, b) => b.value - a.value || phpCompare(a.label, b.label)).slice(0, 7)
}
function stats(surveyMap, responseRows, residentMap, typeRows, input, today) {
  const live = Object.values(residentMap).filter(row => row.deleted_at === null)
  const responseCounts = surveyResponseCounts(responseRows), statusCounts = countValues(Object.values(surveyMap).map(row => row.status))
  const typeCounts = countValues(typeRows.map(row => row.type))
  const typeOrder = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])
  const typeLabels = { multiple_choice: 'Multiple Choice', yesno: 'Yes / No', rating: 'Rating Scale', short_answer: 'Short Answer' }
  const ageCounts = [0, 0, 0, 0]
  for (const resident of live) {
    const age = ageOn(resident.birthdate, today)
    if (age !== null) ageCounts[age < 18 ? 0 : age < 35 ? 1 : age < 60 ? 2 : 3]++
  }
  const temporary = live.filter(row => row.residency_status === 'temporary').length
  const married = live.filter(row => row.is_married).length, children = live.filter(row => row.has_children).length
  return {
    responses_per_survey: Object.values(surveyMap).slice(0, 8).map(row => ({ label: row.title, value: responseCounts.get(row.survey_id) || 0 })),
    survey_status: ['active', 'inactive'].filter(key => statusCounts.has(key)).map(key => ({ label: key[0].toUpperCase() + key.slice(1), value: statusCounts.get(key) })),
    response_trend: trend(responseRows, input),
    residency_mix: [{ label: 'Permanent', value: live.length - temporary }, { label: 'Temporary', value: temporary }],
    question_types: typeOrder.map(([key, value]) => ({ label: typeLabels[key] || key.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()), value })),
    age_groups: ['Under 18', '18 - 34', '35 - 59', '60 and over'].map((label, i) => ({ label, value: ageCounts[i] })),
    gender_mix: groupRows(live, 'gender', { ...genderOptions(), unstated: 'Not recorded' }),
    priority_groups: groupRows(live, 'special_category', { pwd: 'PWD', senior_citizen: 'Senior Citizen', pregnant: 'Pregnant', none: 'No priority group' }),
    occupations: topGroups(live, 'occupation', true), purok_mix: topGroups(live, 'purok'),
    household: [{ label: 'Married', value: married }, { label: 'Not married', value: live.length - married }, { label: 'With children', value: children }, { label: 'No children', value: live.length - children }],
  }
}
async function dashboard(ctx, tx, surveyMap, responseRows, residentMap, userMap, isAdmin, input, today) {
  const live = Object.values(residentMap).filter(row => row.deleted_at === null)
  const eligible = live.filter(row => row.is_active).length
  const responseCounts = surveyResponseCounts(responseRows), ranking = countValues(responseRows.map(row => row.residentUid))
  const recentStart = midnight(addDays(today, -7)), previousStart = midnight(addDays(today, -14))
  const recent = responseRows.filter(row => time(row.submittedAt) >= recentStart).length
  const previous = responseRows.filter(row => time(row.submittedAt) >= previousStart && time(row.submittedAt) < recentStart).length
  const [direction, deltaText] = delta(recent, previous)
  const rows = Object.values(surveyMap).map(row => ({ ...row, response_count: responseCounts.get(row.survey_id) || 0 }))
  const completion = sortRows(rows.filter(row => row.status === 'active').map(row => ({ survey_id: row.survey_id, title: row.title, answered: row.response_count,
    pct: eligible ? Math.min(100, Math.round(row.response_count / eligible * 100)) : 0 })), (a, b) => b.answered - a.answered).slice(0, 6)
  const top = []
  for (const [uid, answered] of ranking) if (residentMap[uid]) top.push({ ...residentMap[uid], answered })
  top.sort((a, b) => b.answered - a.answered || phpCompare(a.last_name, b.last_name))
  const latest = responseRows.reduce((max, row) => Math.max(max, time(row.submittedAt) || 0), 0)
  const temporary = live.filter(row => row.residency_status === 'temporary').length
  const pendingAddress = await query(ctx, tx, 'nameAddressRequests', ['status'], { where: [['status', 'pending']] })
  const data = {
    total_surveys: Object.keys(surveyMap).length, active_surveys: Object.values(surveyMap).filter(row => openSurvey(row, today)).length,
    total_residents: live.length, total_responses: responseRows.length, inactive_surveys: Object.values(surveyMap).filter(row => row.status === 'inactive').length,
    closed_surveys: Object.values(surveyMap).filter(row => row.end_date < today).length,
    avg_responses: Object.keys(surveyMap).length ? round(responseRows.length / Object.keys(surveyMap).length, 1) : 0,
    responses_7: recent, responses_prev_7: previous,
    new_residents_30: live.filter(row => time(row.created_at) >= midnight(addDays(today, -30))).length,
    permanent_residents: live.length - temporary, temporary_residents: temporary, eligible_residents: eligible,
    responding_residents: ranking.size, participation: eligible ? Math.min(100, Math.round(ranking.size / eligible * 100)) : 0,
    pending_address_requests: pendingAddress.length, as_of: dateLabel(new Date(), false, true), today,
    trend_from: addDays(today, -29), resp_dir: direction, resp_delta: deltaText,
    latest_response_label: latest ? dateLabel(new Date(latest)) : '—',
    surveys_overview: rows.slice(0, 8), completion_rates: completion,
    top_responders: top.slice(0, 5).map(({ resident_id, resident_number, first_name, last_name, answered }) => ({ resident_id, resident_number, first_name, last_name, answered })),
    demographics_ready: Boolean(live.length), is_admin_view: isAdmin,
  }
  if (isAdmin) {
    const staff = Object.values(userMap).filter(user => ['staff', 'admin'].includes(user.role) && user.deletedAt == null)
    const logins = await activity(ctx, tx, userMap, residentMap, 'login')
    const logouts = await activity(ctx, tx, userMap, residentMap, 'logout')
    const pendingDeletions = await query(ctx, tx, 'deletionRequests', ['status'], { where: [['status', 'pending']] })
    data.admin = {
      total_staff: staff.length, deactivated_staff: staff.filter(user => !user.isActive).length,
      deactivated_residents: live.filter(row => !row.is_active).length, pending_deletion_requests: pendingDeletions.length,
      login_counts: portalBreakdown(logins), logout_counts: portalBreakdown(logouts),
      recent_logins: logins.map(row => ({ person: row.person, type_label: row.type_label, time_label: row.time_label })),
      recent_logouts: logouts.map(row => ({ person: row.person, type_label: row.type_label, time_label: row.time_label })),
    }
  }
  data.surveys_overview = data.surveys_overview.map(({ survey_id, title, start_date, end_date, status, response_count }) => ({ survey_id, title, start_date, end_date, status, response_count }))
  return data
}
async function detail(ctx, tx, key, surveyMap, responseRows, residentMap, userMap, today) {
  const responseCounts = surveyResponseCounts(responseRows)
  let rows = []
  if (['total_surveys', 'active_surveys'].includes(key)) {
    rows = Object.values(surveyMap).filter(row => key === 'total_surveys' || openSurvey(row, today)).map(row => ({ ...row,
      response_count: responseCounts.get(row.survey_id) || 0, days_left: dayDiff(row.end_date, today) }))
    if (key === 'active_surveys') rows.sort((a, b) => cmp(a.end_date, b.end_date))
  } else if (['total_residents', 'deactivated_residents'].includes(key)) {
    rows = Object.values(residentMap).filter(row => row.deleted_at === null && (key === 'total_residents' || !row.is_active))
    rows.sort((a, b) => phpCompare(a.last_name, b.last_name) || (key === 'total_residents' ? phpCompare(a.first_name, b.first_name) : 0))
  } else if (key === 'total_responses') {
    const ordered = sortRows(responseRows, (a, b) => latestFirst(a.submittedAt, b.submittedAt))
    for (const response of ordered) if (surveyMap[response.surveyId]) {
      const resident = residentMap[response.residentUid]
      rows.push({ title: surveyMap[response.surveyId].title, submitted_at: response.submittedAt,
        resident_name: resident ? `${resident.first_name} ${resident.last_name}` : null })
      if (rows.length === 200) break
    }
  } else if (['staff_accounts', 'deactivated_staff'].includes(key)) {
    for (const user of Object.values(userMap)) if (['staff', 'admin'].includes(user.role) && user.deletedAt == null && (key === 'staff_accounts' || !user.isActive))
      rows.push({ full_name: user.displayName, username: user.username, role: user.role, is_active: Number(Boolean(user.isActive)), created_at: user.createdAt })
    rows.sort((a, b) => (key === 'staff_accounts' ? cmp(a.role, b.role) : 0) || phpCompare(a.full_name, b.full_name))
  } else if (key === 'recent_logins') rows = await activity(ctx, tx, userMap, residentMap, '', false)
  const allowed = new Set(['survey_id', 'title', 'start_date', 'end_date', 'status', 'response_count', 'days_left', 'resident_number', 'first_name', 'last_name', 'contact_number', 'residency_status', 'is_active', 'resident_name', 'submitted_at', 'full_name', 'username', 'role', 'created_at', 'person', 'type_label', 'login_time', 'start_date_label', 'end_date_label', 'created_at_label', 'submitted_at_label', 'login_time_label'])
  rows = rows.map(row => {
    const output = { ...row }
    for (const field of ['start_date', 'end_date', 'created_at', 'submitted_at', 'login_time']) if (field in output) output[field + '_label'] = dateLabel(output[field], ['submitted_at', 'login_time'].includes(field))
    return Object.fromEntries(Object.entries(output).filter(([field]) => allowed.has(field)))
  })
  return { ...views[key], view: key, rows, count: rows.length }
}
async function answers(ctx, tx, responsesRows) {
  const all = []
  for (const response of responsesRows) {
    for (const answer of await query(ctx, tx, 'answers', ['questionId', 'choiceId', 'text', 'rating', 'legacyId'], { parent: 'responses/' + response.id }))
      all.push({ ...answer, submitted_at: response.submittedAt, response_id: response.id })
  }
  return all
}
function questionResult(question, choiceRows, answerRows, mode) {
  const own = answerRows.filter(answer => answer.questionId === question.id)
  const base = { question_id: question.id, question_text: question.text, question_type: question.type, question_order: question.order }
  let rows = []
  if (question.type === 'multiple_choice') rows = choiceRows.map(choice => ({ choice_text: choice.text, votes: own.filter(answer => answer.choiceId === choice.id).length }))
  else if (question.type === 'yesno') {
    const options = mode === 'csv' ? ['No', 'Yes'] : ['Yes', 'No']
    rows = options.map(text => ({ choice_text: text, votes: own.filter(answer => (answer.text || '') === text).length })).filter(row => mode !== 'csv' || row.votes)
  } else if (question.type === 'rating') {
    const ratings = own.map(answer => answer.rating).filter(value => value !== null && value !== undefined)
    const counts = countValues(ratings), sum = ratings.reduce((total, value) => total + value, 0)
    base.avg_rating = ratings.length ? round(sum / ratings.length, 2) : 0
    base.rating_n = ratings.length
    const keys = mode === 'report' ? [1, 2, 3, 4, 5] : [...new Set([1, 2, 3, 4, 5, ...counts.keys()])].sort((a, b) => a - b)
    rows = keys.filter(value => mode !== 'csv' || counts.has(value)).map(value => mode === 'results'
      ? { rating_value: value, votes: counts.get(value) || 0 }
      : { choice_text: `${value} star(s)`, votes: counts.get(value) || 0 })
  } else {
    let ownText = own.filter(answer => (answer.text || '') !== '')
    if (mode === 'results') ownText = sortRows(ownText, (a, b) => a.legacyId != null && b.legacyId != null
      ? Number(b.legacyId) - Number(a.legacyId) : latestFirst(a.submitted_at, b.submitted_at) || cmp(b.response_id, a.response_id)).slice(0, 200)
    else ownText = sortRows(ownText, (a, b) => Number(a.legacyId ?? Number.MAX_SAFE_INTEGER) - Number(b.legacyId ?? Number.MAX_SAFE_INTEGER)
      || timeSort(a.submitted_at, b.submitted_at) || cmp(a.response_id, b.response_id))
    rows = ownText.map(answer => ({ answer_text: answer.text, submitted_at: answer.submitted_at, submitted_at_label: dateLabel(answer.submitted_at) }))
  }
  if (mode !== 'results') return { ...base, rows, answered_here: question.type === 'short_answer' ? rows.length : rows.reduce((sum, row) => sum + (row.votes || 0), 0) }
  if (question.type === 'short_answer') return { ...base, answers: rows }
  const total = rows.reduce((sum, row) => sum + row.votes, 0), max = Math.max(0, ...rows.map(row => row.votes))
  return { ...base, total_votes: total, breakdown: rows.map(row => ({ ...row, percent: total ? Math.round(row.votes / total * 100) : 0, winning: row.votes === max && max > 0 })) }
}
async function results(ctx, tx, surveyId, mode, surveyMap) {
  let survey = surveyMap[surveyId] || null, questionRows = [], responseRows = []
  if (survey) {
    responseRows = await responses(ctx, tx, surveyId)
    const answerRows = await answers(ctx, tx, responseRows)
    const questions = await query(ctx, tx, 'questions', ['text', 'type', 'order', 'legacyId'], { parent: 'surveys/' + surveyId })
    questions.sort((a, b) => Number(a.order) - Number(b.order) || Number(a.legacyId ?? Number.MAX_SAFE_INTEGER) - Number(b.legacyId ?? Number.MAX_SAFE_INTEGER) || cmp(a.id, b.id))
    for (const question of questions) {
      const choices = question.type === 'multiple_choice'
        ? await query(ctx, tx, 'choices', ['text', 'order', 'legacyId'], { parent: `surveys/${surveyId}/questions/${question.id}` }) : []
      choices.sort((a, b) => Number(a.legacyId ?? a.order) - Number(b.legacyId ?? b.order) || cmp(a.id, b.id))
      questionRows.push(questionResult(question, choices, answerRows, mode))
    }
    const creator = mode === 'report' && survey.created_by ? await projectedDocument(ctx, tx, 'users/' + survey.created_by, ['displayName']) : null
    const { survey_id, title, description, start_date, end_date, status } = survey
    survey = { survey_id, title, description, start_date, end_date, status,
      period_label: `${dateLabel(start_date, false, false, true)} — ${dateLabel(end_date, false, false, true)}` }
    if (mode === 'report') survey.created_by_name = creator?.displayName ?? null
  }
  const outputSurveyList = Object.values(surveyMap).map(row => ({ survey_id: row.survey_id, title: row.title }))
  const generated = dateLabel(new Date(), true, true).replace(/ (\d{1,2}:\d{2} [AP]M)$/, ' at $1')
  return { surveys: outputSurveyList, survey_id: surveyId === '0' || surveyId === '' ? 0 : surveyId, survey,
    questions: questionRows, total_respondents: responseRows.length,
    generated_on: generated }
}
function csv(data) {
  if (!data.survey) return { ok: true, data: null, redirect: '/staff/reports' }
  const survey = data.survey, lines = [
    csvRow(['Barangay Health Center - Survey Report']), csvRow(['Survey Title', survey.title]), csvRow(['Period', `${survey.start_date} to ${survey.end_date}`]), csvRow([]),
  ]
  for (const question of data.questions) {
    lines.push(csvRow(['Question', question.question_text]), csvRow(['Option', 'Count']))
    for (const row of question.rows) lines.push(csvRow(question.question_type === 'short_answer' ? ['Response', row.answer_text] : [row.choice_text, row.votes]))
    lines.push(csvRow([]))
  }
  return { ok: true, data: { filename: csvFilename(survey.title), csv: lines.join('') } }
}
export async function handleReports(ctx, action, input) {
  if (ctx.request.method !== 'POST') throw new HttpError('Method not allowed.', 405)
  if (ctx.bodySize > 16384) throw new HttpError('Invalid request.', 413)
  if (typeof input.idToken !== 'string' || typeof input.action !== 'string') throw invalid()
  const actor = await ctx.actor({ roles: ['staff', 'admin'] })
  if (!['dashboard', 'trend', 'detail', 'results', 'report', 'csv'].includes(action)) throw new HttpError('Not found.', 404)
  const view = input.view ?? ''
  if (action === 'detail' && (typeof view !== 'string' || !views[view] || (views[view].admin && actor.account.role !== 'admin')))
    return { ok: true, data: null, redirect: '/staff/dashboard' }
  const rawSurveyId = input.survey_id ?? '0'
  if (typeof rawSurveyId !== 'string' && !Number.isInteger(rawSurveyId)) throw invalid()
  const surveyId = String(rawSurveyId)
  if (surveyId !== '' && !/^[A-Za-z0-9_-]{1,128}$/.test(surveyId)) throw invalid()
  let tx
  try { tx = await ctx.store.begin(true) } catch { throw unavailable() }
  try {
    const currentActor = await ctx.actorInTransaction(tx, { roles: ['staff', 'admin'] })
    if (action === 'detail' && views[view].admin && currentActor.account.role !== 'admin') return { ok: true, data: null, redirect: '/staff/dashboard' }
    const today = manilaDay()
    if (action === 'trend') return { ok: true, data: { response_trend: trend(await responses(ctx, tx), input) } }
    if (['results', 'report', 'csv'].includes(action)) {
      const data = await results(ctx, tx, surveyId, action, await surveys(ctx, tx))
      return action === 'csv' ? csv(data) : { ok: true, data }
    }
    const surveyMap = action === 'dashboard' || ['total_surveys', 'active_surveys', 'total_responses'].includes(view) ? await surveys(ctx, tx) : {}
    const responseRows = action === 'dashboard' || ['total_surveys', 'active_surveys', 'total_responses'].includes(view) ? await responses(ctx, tx) : []
    const needPeople = action === 'dashboard' || ['total_residents', 'deactivated_residents', 'total_responses', 'recent_logins', 'staff_accounts', 'deactivated_staff'].includes(view)
    const userMap = needPeople ? await users(ctx, tx) : {}
    const residentMap = needPeople && !['staff_accounts', 'deactivated_staff'].includes(view) ? await residents(ctx, tx, userMap) : {}
    if (action === 'detail') return { ok: true, data: await detail(ctx, tx, view, surveyMap, responseRows, residentMap, userMap, today) }
    const data = await dashboard(ctx, tx, surveyMap, responseRows, residentMap, userMap, currentActor.account.role === 'admin', input, today)
    data.charts = stats(surveyMap, responseRows, residentMap, await query(ctx, tx, 'questions', ['type'], { allDescendants: true }), input, today)
    return { ok: true, data }
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw unavailable()
  } finally { await ctx.store.rollback(tx).catch(() => {}) }
}
