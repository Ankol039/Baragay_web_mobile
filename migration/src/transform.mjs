import { TABLES } from './mysql.mjs'
import { text, integer, uid, flag, normalize, timestamp, person, address, household, identity, user, residentProfile, staffProfile } from './model.mjs'
import { digest, requireSafe } from './safety.mjs'
import { pack, savePrivate } from './storage.mjs'
export function groupFor(path) {
  return path.split('/').filter((_, i) => i % 2 === 0).join('/')
}
export function transform(snapshot) {
  requireSafe(snapshot.digest === digest({ tables: snapshot.tables, photos: snapshot.photos || [], warnings: snapshot.warnings || {} }), 'EXPORT_INTEGRITY_MISMATCH')
  const tables = snapshot.tables, records = [], authUsers = [], warnings = { ...snapshot.warnings }, used = new Set(), sourceCounts = {}
  for (const name of TABLES) requireSafe(snapshot.counts[name] === tables[name].length, 'EXPORT_COUNT_MISMATCH')
  const rows = (name, key) => [...tables[name]].sort((a, b) => Number(a[key]) - Number(b[key]))
  const index = (name, key) => new Map(tables[name].map(r => [String(r[key]), r]))
  const residents = index('residents', 'resident_id'), surveys = index('surveys', 'survey_id')
  const questions = index('survey_questions', 'question_id'), choices = index('survey_choices', 'choice_id'), responses = index('responses', 'response_id')
  const userData = new Map(), profiles = new Map(), latestResidency = new Map(), aliasOwners = new Map(), emailOwners = new Set()
  const warn = key => { warnings[key] = (warnings[key] || 0) + 1 }
  function emit(path, data, sourceTable = null) {
    requireSafe(!used.has(path), 'DUPLICATE_DOCUMENT_OR_RELATION')
    used.add(path); records.push({ path, data, sourceTable })
    if (sourceTable) sourceCounts[sourceTable] = (sourceCounts[sourceTable] || 0) + 1
  }
  function alias(kind, identifier, owner, email, createdAt) {
    const normalizedIdentifier = normalize(identifier), key = `${kind}_${digest(normalizedIdentifier)}`
    requireSafe(!aliasOwners.has(key) || aliasOwners.get(key) === owner, 'IDENTIFIER_ALIAS_COLLISION')
    if (aliasOwners.has(key)) return
    aliasOwners.set(key, owner)
    emit(`identifierAliases/${key}`, { kind, normalizedIdentifier, uid: owner, authEmail: email, createdAt })
  }
  for (const kind of ['resident', 'staff']) for (const r of rows(kind === 'resident' ? 'residents' : 'staff', `${kind}_id`)) {
    const d = user(r, kind), ident = identity(r, kind)
    requireSafe(['resident', 'staff', 'admin'].includes(d.role), 'UNSUPPORTED_ACCOUNT_ROLE')
    requireSafe(!emailOwners.has(ident.authEmail), 'CANONICAL_EMAIL_COLLISION'); emailOwners.add(ident.authEmail)
    emit(`users/${d.uid}`, d); userData.set(d.uid, d)
    const profile = kind === 'resident' ? residentProfile(r) : staffProfile(r)
    emit(`${kind === 'resident' ? 'residents' : 'staff'}/${d.uid}`, profile, kind === 'resident' ? 'residents' : 'staff'); profiles.set(d.uid, profile)
    if (!/^[\x20-\x7e]*$/.test(ident.username)) warn('nonAsciiUsernameRequiresCollationReview')
    alias(kind === 'resident' ? 'residentNumber' : 'staffNumber', ident.identifier, d.uid, ident.authEmail, d.createdAt)
    if (ident.username && !/^[RS]-[0-9]{4}-[0-9]{4}$/i.test(ident.username)) alias('username', ident.username, d.uid, ident.authEmail, d.createdAt)
    authUsers.push({ uid: d.uid, email: ident.authEmail, displayName: d.displayName, disabled: !d.isActive || d.deletedAt != null,
      passwordHash: text(r.password), identifier: d.identifier, sourceIsFirstLogin: d.isFirstLogin, sourceFingerprint: digest([d.uid, ident.authEmail, text(r.password), !d.isActive, r.deleted_at]) })
  }
  for (const r of rows('surveys', 'survey_id')) emit(`surveys/${integer(r.survey_id)}`, { title: text(r.title), description: r.description == null ? '' : String(r.description),
    startDate: timestamp(r.start_date, true), endDate: timestamp(r.end_date, true), status: text(r.status), createdByUid: r.created_by ? uid('staff', r.created_by) : null,
    createdAt: timestamp(r.created_at), updatedAt: timestamp(r.created_at), legacyId: integer(r.survey_id) }, 'surveys')
  for (const r of rows('survey_questions', 'question_id')) {
    requireSafe(surveys.has(String(r.survey_id)), 'QUESTION_WITHOUT_SURVEY')
    emit(`surveys/${integer(r.survey_id)}/questions/${integer(r.question_id)}`, { text: String(r.question_text), type: r.question_type, order: Number(r.question_order), legacyId: integer(r.question_id) }, 'survey_questions')
  }
  for (const r of rows('survey_choices', 'choice_id')) {
    const q = questions.get(String(r.question_id)); requireSafe(q, 'CHOICE_WITHOUT_QUESTION')
    emit(`surveys/${integer(q.survey_id)}/questions/${integer(r.question_id)}/choices/${integer(r.choice_id)}`, { text: String(r.choice_text), order: integer(r.choice_id), legacyId: integer(r.choice_id) }, 'survey_choices')
  }
  for (const r of rows('responses', 'response_id')) {
    requireSafe(surveys.has(String(r.survey_id)) && residents.has(String(r.resident_id)), 'RESPONSE_WITHOUT_SURVEY_OR_RESIDENT')
    const answered = rows('survey_results', 'answer_id').filter(a => String(a.response_id) === String(r.response_id))
    requireSafe(answered.length, 'RESPONSE_WITHOUT_ANSWERS')
    emit(`responses/${integer(r.survey_id)}_${uid('resident', r.resident_id)}`, { surveyId: String(r.survey_id), residentUid: uid('resident', r.resident_id),
      surveyTitle: text(surveys.get(String(r.survey_id)).title), firstAnswerId: String(answered[0].question_id), submittedAt: timestamp(r.submitted_at), legacyId: integer(r.response_id) }, 'responses')
  }
  for (const r of rows('survey_results', 'answer_id')) {
    const response = responses.get(String(r.response_id)), q = questions.get(String(r.question_id)), c = r.choice_id ? choices.get(String(r.choice_id)) : null
    requireSafe(response && q && String(q.survey_id) === String(response.survey_id), 'ANSWER_WITHOUT_OWNED_QUESTION')
    requireSafe(!r.choice_id || (c && String(c.question_id) === String(q.question_id)), 'ANSWER_WITHOUT_OWNED_CHOICE')
    emit(`responses/${integer(response.survey_id)}_${uid('resident', response.resident_id)}/answers/${integer(r.question_id)}`, { questionId: String(r.question_id), type: q.question_type,
      questionText: String(q.question_text), choiceId: r.choice_id ? String(r.choice_id) : null, choiceText: c ? String(c.choice_text) : '', rating: r.rating_value == null ? null : Number(r.rating_value),
      text: r.answer_text == null ? '' : String(r.answer_text), order: Number(q.question_order), legacyId: integer(r.answer_id) }, 'survey_results')
  }
  for (const [table, group, key] of [['resident_children', 'children', 'child_id'], ['resident_character_references', 'characterReferences', 'reference_id']]) for (const r of rows(table, key)) {
    requireSafe(residents.has(String(r.resident_id)), 'PERSON_WITHOUT_RESIDENT')
    emit(`residents/${uid('resident', r.resident_id)}/${group}/${integer(r[key])}`, { person: person(r), displayOrder: Number(r.display_order), createdAt: timestamp(r.created_at), legacyId: integer(r[key]) }, table)
  }
  const configs = [['resident_update_requests', 'nameAddressRequests', 'nameAddress', 'resident'], ['resident_family_requests', 'familyRequests', 'family', 'resident'],
    ['staff_update_requests', 'staffRequests', 'staff', 'staff'], ['resident_delete_requests', 'deletionRequests', 'deletion', 'resident']]
  for (const [table, collection, kind, accountKind] of configs) for (const r of rows(table, 'request_id')) {
    const ownerUid = uid(accountKind, r[`${accountKind}_id`]), account = userData.get(ownerUid), id = String(integer(r.request_id))
    if (!account) { warn('historicalRequestOwnersMissing'); if (r.status === 'pending') warn('orphanPendingOwners') }
    const payload = kind === 'family' ? JSON.parse(r.payload) : null
    let proposed, firstReferenceId = null
    if (kind === 'nameAddress') {
      proposed = { name: ['courtesy_title', 'first_name', 'middle_name', 'last_name', 'name_extension'].some(k => text(r[k])) ? person(r) : null,
        birthdate: timestamp(r.birthdate, true), permanentAddress: Object.values(address(r)).some(Boolean) ? address(r) : null,
        temporaryAddress: Object.values(address(r, 'temp_', 'temporary_address')).some(Boolean) ? address(r, 'temp_', 'temporary_address') : null,
        legacyEmail: text(r.email), legacyContact: text(r.contact_number), legacyBarangaySubdivision: text(r.barangay_subdivision) }
    } else if (kind === 'family') {
      requireSafe(payload && typeof payload === 'object' && !Array.isArray(payload), 'INVALID_FAMILY_PAYLOAD')
      proposed = household(payload)
      for (const [source, group] of [['children', 'children'], ['references', 'characterReferences']]) {
        requireSafe(Array.isArray(payload[source] || []), 'INVALID_FAMILY_PAYLOAD')
        for (const [i, row] of (payload[source] || []).entries()) {
          if (group === 'characterReferences' && i === 0) firstReferenceId = String(i + 1)
          emit(`${collection}/${id}/${group}/${i + 1}`, { person: person(row), displayOrder: i, createdAt: timestamp(r.requested_at), legacyId: null })
        }
      }
      if (firstReferenceId == null) warn('familyRequestsWithoutReference')
    } else if (kind === 'staff') proposed = address(r)
    else proposed = { residentNumber: text(r.resident_number) || account?.identifier || '', residentName: text(r.resident_name) || account?.displayName || '' }
    const requestedByUid = kind === 'deletion' && r.requested_by ? uid('staff', r.requested_by) : ownerUid
    emit(`${collection}/${id}`, { kind, ownerUid, ownerIdentifier: text(r[accountKind === 'resident' ? 'resident_number' : 'staff_number']) || account?.identifier || '',
      ownerDisplayName: text(r[accountKind === 'resident' ? 'resident_name' : 'staff_name']) || account?.displayName || '', requestedByUid,
      requestedByName: text(r.requested_by_name) || userData.get(requestedByUid)?.displayName || '', proposed, previousAddress: text(r.previous_address), reason: text(r.reason), firstReferenceId,
      status: text(r.status), requestedAt: timestamp(r.submitted_at || r.requested_at), reviewedAt: timestamp(r.reviewed_at), reviewedByUid: r.reviewed_by ? uid('staff', r.reviewed_by) : null,
      reviewedByName: text(r.reviewed_by_name) || (r.reviewed_by ? userData.get(uid('staff', r.reviewed_by))?.displayName : '') || '', reviewComment: text(r.review_comment), legacyId: integer(r.request_id) }, table)
    if (r.status === 'pending') emit(`pendingRequests/${ownerUid}_${kind}`, { ownerUid, kind, requestId: id })
  }
  for (const r of rows('resident_residency_changes', 'change_id')) {
    const owner = uid('resident', r.resident_id), id = String(integer(r.change_id))
    emit(`residencyRecords/${id}`, { residentUid: owner, fromStatus: text(r.from_status), toStatus: text(r.to_status), reason: text(r.reason), changedByUid: r.changed_by ? uid('staff', r.changed_by) : null,
      changedAt: timestamp(r.changed_at), isReverted: flag(r.is_reverted), previousPermanentAddress: address(r, 'prev_', 'prev_address'),
      previousTemporaryAddress: Object.values(address(r, 'prev_temp_', 'prev_temporary_address')).some(Boolean) ? address(r, 'prev_temp_', 'prev_temporary_address') : null,
      previousResidenceType: text(r.prev_residence_type), legacyId: integer(r.change_id) }, 'resident_residency_changes')
    if (profiles.has(owner)) {
      const time = timestamp(r.changed_at)?.toMillis() ?? 0, previous = latestResidency.get(owner)
      if (!previous || time > previous.time || (time === previous.time && Number(id) > Number(previous.id))) {
        latestResidency.set(owner, { id, time }); profiles.get(owner).lastResidencyRecordId = id
      }
    }
  }
  for (const r of rows('login_history', 'log_id')) {
    requireSafe(['resident', 'staff'].includes(r.user_type), 'UNKNOWN_LOGIN_ACCOUNT_TYPE')
    const actorUid = uid(r.user_type, r.user_id), account = userData.get(actorUid)
    if (!account) warn('historicalAuditActorsMissing')
    const accountRole = text(r.account_role) || (account?.role === 'admin' ? 'Admin' : r.user_type === 'staff' ? 'Staff'
      : residents.get(String(r.user_id))?.residency_status === 'temporary' ? 'Temporary Resident' : 'Permanent Resident')
    emit(`loginHistory/${integer(r.log_id)}`, { actorUid, accountType: r.user_type, accountRole, event: text(r.event) || 'login', at: timestamp(r.login_time),
      ipAddress: r.ip_address == null ? null : String(r.ip_address), legacyId: integer(r.log_id) }, 'login_history')
  }
  for (const photo of snapshot.photos || []) emit(`profileImages/${photo.ownerUid}`, { ownerUid: photo.ownerUid, mimeType: photo.mimeType, base64: photo.base64, updatedAt: timestamp(photo.sourceCreatedAt) })
  const counters = {}
  for (const [kind, name] of [['resident', 'residentNumbers'], ['staff', 'staffNumbers']]) {
    const matching = [...userData.values()].filter(u => (kind === 'resident') === (u.role === 'resident')).sort((a, b) => Number(b.identifier.split('-').at(-1)) - Number(a.identifier.split('-').at(-1)))
    const top = matching[0], value = top ? Number(top.identifier.split('-').at(-1)) : 0
    requireSafe(value < 9999, 'NUMBER_SEQUENCE_EXHAUSTED')
    const data = { value, lastUid: top?.uid || null, updatedAt: top?.createdAt || timestamp('1970-01-01 08:00:00') }
    counters[name] = value; emit(`counters/${name}`, data)
  }
  for (const name of TABLES) requireSafe((sourceCounts[name] || 0) === tables[name].length, 'SOURCE_COVERAGE_MISMATCH')
  const expectedGroups = {}
  for (const r of records) { const group = groupFor(r.path); expectedGroups[group] = (expectedGroups[group] || 0) + 1 }
  return { schemaVersion: 1, snapshotDigest: snapshot.digest, records, authUsers, sourceCounts: snapshot.counts, expectedGroups, counters, warnings }
}
export async function savePlan(snapshot) {
  const plan = transform(snapshot)
  await savePrivate('firestore-plan.json', pack(plan))
  return plan
}
