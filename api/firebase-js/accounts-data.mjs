import { accountTransaction, admin, apiError, query, filterQuery, accountId } from './accounts-store.mjs'
import {
  PROFILE_PERSON, PROFILE_ADDRESS, profileUnmap, withCourtesyTitle, getResidentAgeLabel,
  genderLabel, courtesyTitles, profileMetadata, genderOptions, formatPersonName,
  personFieldDisplay, residenceTypes, categoryReferenceFields, permanentResidencyMinMonths,
  dateTime, dateOnly, today,
} from './policy.mjs'

const sorted = (rows, compare) => rows.sort(compare)
const timeValue = value => value instanceof Date ? value.getTime() : new Date(value || 0).getTime()
const compareDateDesc = (a, b) => timeValue(b) - timeValue(a)
const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0

export function accountFields() {
  return { ...profileMetadata(), genders: genderOptions(), residence_types: residenceTypes(),
    category_references: categoryReferenceFields(), min_months: permanentResidencyMinMonths() }
}

function dateLabel(value) { return value ? dateTime(value, 'M j, Y g:i A') : '' }
function requestRow(row) {
  const proposed = row.proposed || {}
  return {
    request_id: row.id,
    name: proposed.name?.firstName ? `${proposed.name.firstName} ${proposed.name.lastName || ''}`.trim() : row.ownerDisplayName,
    staff_name: row.ownerDisplayName,
    staff_number: row.ownerIdentifier,
    resident_number: row.ownerIdentifier,
    resident_name: row.ownerDisplayName,
    resident_id: row.ownerUid,
    previous_address: row.previousAddress ?? '',
    address: proposed.permanentAddress?.displayLine ?? proposed.displayLine ?? '',
    birthdate: dateOnly(proposed.birthdate),
    status: row.status,
    reason: row.reason ?? '',
    submitted_at: row.requestedAt ? dateTime(row.requestedAt, 'Y-m-d H:i:s') : '',
    requested_at: row.requestedAt ? dateTime(row.requestedAt, 'Y-m-d H:i:s') : '',
    requested_by_name: row.requestedByName ?? '',
    reviewed_at: dateLabel(row.reviewedAt),
    reviewed_by_name: row.reviewedByName ?? '',
    review_comment: row.reviewComment ?? '',
  }
}

async function sortedRequests(ctx, collection, tx) {
  const rows = await query(ctx, '', collection, tx)
  return sorted(rows, (a, b) => Number(b.status === 'pending') - Number(a.status === 'pending')
    || compareDateDesc(a.requestedAt, b.requestedAt) || compareText(String(b.id), String(a.id)))
}

async function residentDetail(ctx, uid, user, tx) {
  const profile = await ctx.store.get(`residents/${uid}`, tx)
  if (!profile) throw new Error('Resident profile unavailable')
  const household = profile.household || {}
  const row = { ...profileUnmap(profile.name, PROFILE_PERSON), ...profileUnmap(profile.permanentAddress, PROFILE_ADDRESS) }
  for (const [key, value] of Object.entries(profileUnmap(profile.temporaryAddress, PROFILE_ADDRESS))) row[`temp_${key}`] = value
  Object.assign(row, {
    resident_id: uid, resident_number: user.identifier, email: profile.contact?.email ?? '', contact_number: profile.contact?.number ?? '',
    birthdate: dateOnly(profile.birthdate), birthplace: profile.birthplace ?? '', special_category: profile.specialCategory ?? 'none',
    category_reference: profile.categoryReference ?? '', residency_start_date: dateOnly(profile.residencyStartDate),
    address: profile.permanentAddress?.displayLine ?? '', temporary_address: profile.temporaryAddress?.displayLine ?? '',
    residency_status: profile.residencyStatus ?? '', residence_type: profile.residenceType ?? '',
    occupation: household.occupation ?? '', hotline_number: household.hotlineNumber ?? '',
    is_married: household.isMarried ? '1' : '0', has_children: household.hasChildren ? '1' : '0',
  })
  for (const who of ['spouse', 'father', 'mother']) {
    for (const [key, value] of Object.entries(profileUnmap(household[who], PROFILE_PERSON))) row[`${who}_${key}`] = value
  }
  for (const [key, collection] of [['children', 'children'], ['references', 'characterReferences']]) {
    const children = await query(ctx, `residents/${uid}`, collection, tx)
    children.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    row[key] = children.map(person => profileUnmap(person.person, PROFILE_PERSON))
  }
  return row
}

async function readResident(ctx, input, actor, tx, user) {
  const id = accountId(input.id ?? '')
  const resident = user ?? await ctx.store.get(`users/${id}`, tx)
  if (!resident || resident.role !== 'resident' || resident.deletedAt != null) apiError('The selected resident could not be loaded.', 404)
  const row = await residentDetail(ctx, id, resident, tx)
  let restoreAddress = null
  if (actor.role === 'admin') {
    const logs = await filterQuery(ctx, '', 'residencyRecords', { residentUid: id }, tx)
    logs.sort((a, b) => compareDateDesc(a.changedAt, b.changedAt) || compareText(String(b.id), String(a.id)))
    for (const log of logs) if (log.toStatus === 'permanent' && !log.isReverted) {
      restoreAddress = log.previousPermanentAddress?.displayLine ?? ''
      break
    }
  }
  return { resident: row, restore_address: restoreAddress }
}

async function readRequests(ctx, tx, actor) {
  const residentRequests = await sortedRequests(ctx, 'nameAddressRequests', tx)
  const staffRequests = [], family = []
  const familyRequests = actor.role === 'admin' ? await sortedRequests(ctx, 'familyRequests', tx) : []
  const residentUids = [...new Set([...residentRequests, ...familyRequests]
    .map(request => request.ownerUid).filter(uid => typeof uid === 'string' && uid.length > 0 && !uid.includes('/')))]
  const profiles = residentUids.length
    ? await ctx.store.batchGet(residentUids.map(uid => `residents/${uid}`), tx)
    : new Map()
  const familyUids = [...new Set(familyRequests
    .map(request => request.ownerUid).filter(uid => typeof uid === 'string' && uid.length > 0 && !uid.includes('/')))]
  const users = familyUids.length
    ? await ctx.store.batchGet(familyUids.map(uid => `users/${uid}`), tx)
    : new Map()

  const residents = []
  for (const request of residentRequests) {
    const uid = request.ownerUid
    if (typeof uid !== 'string' || !uid || uid.includes('/')) continue
    const profile = profiles.get(`residents/${uid}`)
    if (!profile) continue
    const row = requestRow(request)
    row.name = `${request.proposed?.name?.firstName ?? ''} ${request.proposed?.name?.lastName ?? ''}`.trim()
      || `${profile.name?.firstName ?? ''} ${profile.name?.lastName ?? ''}`.trim()
    residents.push(row)
  }
  if (actor.role === 'admin') {
    for (const request of await sortedRequests(ctx, 'staffRequests', tx)) staffRequests.push(requestRow(request))
    for (const request of familyRequests) {
      const uid = request.ownerUid
      if (typeof uid !== 'string' || !uid || uid.includes('/')) continue
      const user = users.get(`users/${uid}`)
      if (!user) continue
      const profile = profiles.get(`residents/${uid}`)
      if (!profile) continue
      const row = requestRow(request)
      row.name = `${profile.name?.firstName ?? ''} ${profile.name?.middleName ?? ''} ${profile.name?.lastName ?? ''}`.trim()
      const proposed = request.proposed || {}
      const payload = { occupation: proposed.occupation ?? '', hotline_number: proposed.hotlineNumber ?? '', is_married: proposed.isMarried ? '1' : '0' }
      for (const who of ['spouse', 'father', 'mother']) {
        for (const [key, value] of Object.entries(profileUnmap(proposed[who], PROFILE_PERSON))) payload[`${who}_${key}`] = value
      }
      for (const [key, collection] of [['children', 'children'], ['references', 'characterReferences']]) {
        const people = await query(ctx, `familyRequests/${request.id}`, collection, tx)
        people.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
        payload[key] = people.map(person => profileUnmap(person.person, PROFILE_PERSON))
      }
      row.details = familyDetails(payload)
      row.requested_at = dateLabel(request.requestedAt)
      family.push(row)
    }
  }
  return { is_admin: actor.role === 'admin', resident: residents, staff: staffRequests, family }
}

function familyDetails(payload) {
  const rows = [['Occupation', personFieldDisplay('occupation', payload.occupation)],
    ['Hotline Number', personFieldDisplay('hotline_number', payload.hotline_number)],
    ['Marital Status', payload.is_married === '1' ? 'Married' : 'Not married']]
  const people = []
  for (const [prefix, label] of [['spouse', 'Spouse'], ['father', 'Father'], ['mother', 'Mother']]) {
    if (prefix === 'spouse' && payload.is_married !== '1') continue
    people.push([label, Object.fromEntries(Object.keys(PROFILE_PERSON).map(key => [key, payload[`${prefix}_${key}`] ?? '']))])
  }
  for (const [key, label] of [['children', 'Child'], ['references', 'Character Reference']]) {
    for (const [index, person] of (payload[key] ?? []).entries()) people.push([`${label} ${index + 1}`, person])
  }
  for (const [label, person] of people) {
    const name = formatPersonName(person)
    if (name) rows.push([label, name + (person.gender ? ` · ${personFieldDisplay('gender', person.gender)}` : '')])
  }
  return rows
}

async function readDeletions(ctx, tx, actor) {
  const rows = []
  for (const request of await sortedRequests(ctx, 'deletionRequests', tx)) {
    const row = requestRow(request)
    const user = await ctx.store.get(`users/${request.ownerUid}`, tx)
    const comment = row.review_comment
    row.was_restored = comment.includes('[Account later restored.]') || Boolean(user && user.deletedAt == null && request.status === 'approved')
    row.currently_deleted = Boolean(user && user.deletedAt != null)
    row.review_comment = comment.replaceAll('[Account later restored.]', '').trim()
    rows.push(row)
  }
  return { is_admin: actor.role === 'admin', requests: rows }
}

async function readResidencyRecords(ctx, input, tx) {
  const filter = ['permanent', 'temporary'].includes(input.filter) ? input.filter : ''
  const logs = await query(ctx, '', 'residencyRecords', tx)
  logs.sort((a, b) => compareDateDesc(a.changedAt, b.changedAt))
  let promotions = 0, reversions = 0
  const changes = []
  for (const log of logs) {
    if (log.toStatus === 'permanent') promotions++
    else reversions++
    const user = await ctx.store.get(`users/${log.residentUid}`, tx)
    const resident = user ? await ctx.store.get(`residents/${log.residentUid}`, tx) : null
    const changedBy = log.changedByUid ? await ctx.store.get(`users/${log.changedByUid}`, tx) : null
    changes.push({ change_id: log.id, resident_id: log.residentUid, from_status: log.fromStatus, to_status: log.toStatus,
      prev_address: log.previousPermanentAddress?.displayLine ?? '', prev_temporary_address: log.previousTemporaryAddress?.displayLine ?? '',
      reason: log.reason, changed_at: dateLabel(log.changedAt), is_reverted: Number(Boolean(log.isReverted)), resident_number: user?.identifier ?? null,
      name: resident ? `${resident.name?.firstName ?? ''} ${resident.name?.lastName ?? ''}`.trim() : `Deleted resident #${log.residentUid}`,
      residency_status: resident?.residencyStatus ?? null, changed_by_name: log.changedByName ?? changedBy?.displayName ?? '' })
  }
  return { filter, promotions, reversions, changes: filter ? changes.filter(row => row.to_status === filter) : changes }
}

async function readLists(ctx, action, actor, tx, actorUid) {
  const users = await query(ctx, '', 'users', tx)
  const pending = await filterQuery(ctx, '', 'deletionRequests', { status: 'pending' }, tx)
  const pendingUids = new Set(pending.map(row => row.ownerUid))
  const residents = [], staff = []
  for (const user of users) {
    const deleted = user.deletedAt != null
    if ((action === 'archives') !== deleted) continue
    const id = user.uid
    const isResident = user.role === 'resident'
    if (!isResident && actor.role !== 'admin') continue
    const profile = await ctx.store.get(`${isResident ? 'residents' : 'staff'}/${id}`, tx)
    if (!profile) continue
    const name = isResident ? `${profile.name?.firstName ?? ''} ${profile.name?.lastName ?? ''}`.trim() : user.displayName
    const base = { full_name: name, name: withCourtesyTitle(profile.name?.courtesyTitle, name), sortName: `${profile.name?.lastName ?? ''} ${profile.name?.firstName ?? ''}`,
      searchText: `${user.identifier} ${name}`, is_active: Boolean(user.isActive), is_first_login: Boolean(user.isFirstLogin), deleted_at: dateLabel(user.deletedAt),
      deleted_by_name: user.deletedByName ?? '', delete_reason: user.deleteReason ?? '', _deletedAt: user.deletedAt }
    if (isResident) {
      const status = profile.residencyStatus === 'temporary' ? 'temporary' : 'permanent'
      Object.assign(base, { resident_id: id, resident_number: user.identifier, residency_status: status,
        age: getResidentAgeLabel(dateOnly(profile.birthdate)), gender_label: genderLabel(profile.name?.gender),
        category_label: ({ none: 'N/A', pwd: 'PWD', senior_citizen: 'Senior Citizen', pregnant: 'Pregnant' })[profile.specialCategory] ?? 'N/A',
        category_reference: profile.categoryReference ?? '', contact_number: profile.contact?.number ?? '', address: profile.permanentAddress?.displayLine ?? '',
        filter: `${status}${user.isFirstLogin ? ' pending-login' : ''}${user.isActive ? '' : ' deactivated'}`,
        pending_delete: pendingUids.has(id), self_registered: Boolean(user.selfRegistered) })
      if (action === 'archives') base.response_count = (await filterQuery(ctx, '', 'responses', { residentUid: id }, tx)).length
      residents.push(base)
    } else {
      Object.assign(base, { staff_id: id, staff_number: user.identifier, username: user.username ?? '', role: user.role,
        date_hired: dateOnly(profile.dateHired), is_me: id === actorUid, can_delete: id !== actorUid,
        can_toggle: id !== actorUid, can_reset: id !== actorUid,
        display_name: withCourtesyTitle(profile.name?.courtesyTitle, name), profile_completed: Boolean(user.profileCompleted) })
      staff.push(base)
    }
  }
  residents.sort((a, b) => action === 'residents' ? compareText(String(a.resident_number), String(b.resident_number)) : compareText(a.sortName, b.sortName))
  staff.sort((a, b) => compareText(String(b.role), String(a.role)) || compareText(a.full_name, b.full_name))
  for (const row of [...residents, ...staff]) delete row.sortName
  if (action === 'archives') {
    residents.sort((a, b) => compareDateDesc(a._deletedAt, b._deletedAt))
    staff.sort((a, b) => compareDateDesc(a._deletedAt, b._deletedAt))
  }
  for (const row of [...residents, ...staff]) delete row._deletedAt
  return { residents, staff, can_delete: actor.role === 'admin', is_admin: actor.role === 'admin', pending_deletions: pending.length,
    titles: courtesyTitles(), today: today(), fields: accountFields() }
}

export async function readAccounts(ctx, action, input, identity) {
  return accountTransaction(ctx, identity.localId, async (tx, actor) => {
    if (['archives', 'residencyRecords'].includes(action)) admin(actor)
    if (action === 'resident') return [[], await readResident(ctx, input, actor, tx)]
    if (action === 'requests') return [[], await readRequests(ctx, tx, actor)]
    if (action === 'deletions') return [[], await readDeletions(ctx, tx, actor)]
    if (action === 'residencyRecords') return [[], await readResidencyRecords(ctx, input, tx)]
    return [[], await readLists(ctx, action, actor, tx, identity.localId)]
  })
}

export async function loadResidentForUpdate(ctx, uid, tx) {
  const id = accountId(uid)
  const user = await ctx.store.get(`users/${id}`, tx)
  if (!user || user.role !== 'resident' || user.deletedAt != null) apiError('Resident not found.')
  const profile = await ctx.store.get(`residents/${id}`, tx)
  if (!profile) apiError('Resident not found.')
  return { id, user, profile }
}
