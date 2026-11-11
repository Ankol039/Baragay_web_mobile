import { fail, HttpError } from './core/errors.mjs'
import {
  PROFILE_PERSON, PROFILE_ADDRESS, addressFieldNames, addressFieldLabels, requiredAddressFields,
  personFieldKeys, profileMap, profileUnmap, profileStrings, profileMetadata, profilePerson,
  validContactNumber, overlongAddressFields, resolveCourtesyTitle, buildAddressLine,
  buildFullName, withCourtesyTitle, genderLabel, getResidentAgeLabel, residenceTypeLabel,
  collectPersonRows, personRowsErrors, hotlineNumberPattern, hotlineFormatHint,
  today, dateOnly, validDate,
} from './policy.mjs'

const requestCollections = ['nameAddressRequests', 'familyRequests']
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key)
const personDisplay = row => profilePerson(row)

function validObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function profileEncodeBounds(data) {
  const limits = { email: 100, number: 20, courtesyTitle: 20, firstName: 50, middleName: 50, lastName: 50,
    nameExtension: 20, gender: 20, occupation: 100, hotlineNumber: 30, displayLine: 255,
    previousAddress: 255, reason: 255 }
  for (const [key, value] of Object.entries(data)) {
    if (validObject(value)) profileEncodeBounds(value)
    else if (typeof value === 'string' && limits[key] && [...value].length > limits[key]) throw new Error('Field too large')
  }
}
function profileWrite(ctx, path, data, mask = null, serverTimes = []) {
  profileEncodeBounds(data)
  return ctx.store.write(path, data, { ...(mask ? { mask } : {}), ...(serverTimes.length ? { serverTimes } : {}) })
}
function query(ctx, parent, collectionId, tx = null, where = []) {
  return ctx.store.query({ parent, collectionId, ...(where.length ? { where: where.map(([field, value]) => ({ field, op: 'EQUAL', value })) } : {}) }, tx)
}
function queryData(rows) { return rows.map(row => ({ id: row.id, ...row.data })) }
async function pendingRequests(ctx, uid, tx = null) {
  const where = [['ownerUid', uid], ['status', 'pending']]
  return Promise.all(requestCollections.map(collection => query(ctx, '', collection, tx, where).then(queryData)))
}

function dayLabel(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}
function dateTimeLabel(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}
function personRow(row) { return profileUnmap(row?.person, PROFILE_PERSON) }
async function profileData(ctx, uid, account) {
  const resident = await ctx.store.get('residents/' + uid)
  if (!resident) throw new Error('Missing resident')
  const household = resident.household || {}
  const person = profileUnmap(resident.name, PROFILE_PERSON)
  const address = profileUnmap(resident.permanentAddress, PROFILE_ADDRESS)
  const temporary = profileUnmap(resident.temporaryAddress, PROFILE_ADDRESS)
  const form = { ...person, ...address }
  for (const [key, value] of Object.entries(temporary)) form['temp_' + key] = value
  Object.assign(form, {
    resident_number: account.identifier,
    email: resident.contact?.email || '',
    contact_number: resident.contact?.number || '',
    birthdate: dateOnly(resident.birthdate),
    address: resident.permanentAddress?.displayLine || '',
    temporary_address: resident.temporaryAddress?.displayLine || '',
    residency_status: resident.residencyStatus || '',
    residence_type: resident.residenceType || '',
    occupation: household.occupation || '',
    hotline_number: household.hotlineNumber || '',
    is_married: household.isMarried ? '1' : '0',
    has_children: household.hasChildren ? '1' : '0',
  })
  const displayName = withCourtesyTitle(person.courtesy_title,
    buildFullName(person.first_name, person.middle_name, person.last_name, person.name_extension))
  const display = {
    full_name: displayName,
    gender: genderLabel(person.gender),
    age: getResidentAgeLabel(resident.birthdate),
    birthdate: dayLabel(resident.birthdate),
    residence_type: residenceTypeLabel(resident.residenceType || ''),
  }
  for (const key of ['spouse', 'father', 'mother']) {
    const row = profileUnmap(household[key], PROFILE_PERSON)
    for (const [field, value] of Object.entries(row)) form[key + '_' + field] = value
    display[key] = personDisplay(row)
  }
  for (const [key, collection] of [['children', 'children'], ['references', 'characterReferences']]) {
    const rows = queryData(await query(ctx, 'residents/' + uid, collection))
    rows.sort((a, b) => (a.displayOrder - b.displayOrder) || ((a.createdAt?.getTime?.() || 0) - (b.createdAt?.getTime?.() || 0)) || a.id.localeCompare(b.id))
    form[key] = rows.map(personRow)
    display[key] = form[key].map(personDisplay)
  }
  const legacy = own(resident, 'photoDataUrl') ? null : await ctx.store.get('profileImages/' + uid)
  form.photo_path = resident.photoDataUrl ?? (legacy ? 'data:image/jpeg;base64,' + legacy.base64 : '')
  const [nameAddressPending, familyPending] = await pendingRequests(ctx, uid)
  familyPending.sort((a, b) => (b.requestedAt?.getTime?.() || 0) - (a.requestedAt?.getTime?.() || 0))
  const latest = familyPending[0]
  const pendingFamily = latest ? { request_id: latest.id, requested_at: latest.requestedAt,
    requested_at_label: dateTimeLabel(latest.requestedAt) } : null
  return {
    resident: form, display,
    pending_request: Boolean(nameAddressPending.length || familyPending.length), pending_family_request: pendingFamily,
    today: today(), fields: profileMetadata(),
  }
}

function contactValues(input) {
  const values = profileStrings(input, ['email', 'contact_number'])
  if (!values.email && !values.contact_number) fail('Please provide your email or contact number to update.')
  if (!validContactNumber(values.contact_number)) fail('A contact number can only contain digits, spaces, +, -, and brackets.')
  return { email: values.email, number: values.contact_number }
}
function birthdateProposal(input, resident, pending) {
  const date = profileStrings(input, ['birthdate']).birthdate
  if (pending) fail('You already have a pending request under review.')
  if (!date) fail('Choose the corrected birthdate.')
  if (date >= today()) fail('Birthdate must be in the past.')
  if (date === dateOnly(resident.birthdate)) fail('That is the birthdate already on record.')
  if (!validDate(date)) fail('Choose the corrected birthdate.')
  return { name: null, birthdate: new Date(date + 'T00:00:00.000Z'), permanentAddress: null,
    temporaryAddress: null, legacyEmail: '', legacyContact: '', legacyBarangaySubdivision: '' }
}
function nameAddressProposal(input, resident, pending) {
  const keys = [...new Set(['courtesy_title_other', ...personFieldKeys().filter(key => key !== 'gender'), ...addressFieldNames(), ...addressFieldNames().map(key => 'temp_' + key)])]
  const values = profileStrings(input, keys)
  values.courtesy_title = resolveCourtesyTitle(values.courtesy_title, values.courtesy_title_other)
  const parts = Object.fromEntries(addressFieldNames().map(key => [key, values[key]]))
  const temp = Object.fromEntries(addressFieldNames().map(key => [key, resident.residencyStatus === 'temporary' ? values['temp_' + key] : '']))
  const old = { ...profileUnmap(resident.name, PROFILE_PERSON), ...profileUnmap(resident.permanentAddress, PROFILE_ADDRESS) }
  let changed = [...personFieldKeys().filter(key => key !== 'gender'), ...addressFieldNames()].some(key => values[key] !== String(old[key] || '').trim())
  if (resident.residencyStatus === 'temporary') {
    const oldTemporary = profileUnmap(resident.temporaryAddress, PROFILE_ADDRESS)
    changed ||= addressFieldNames().some(key => temp[key] !== String(oldTemporary[key] || '').trim())
  }
  const missing = requiredAddressFields().filter(key => !parts[key]).map(key => addressFieldLabels()[key])
  if (pending) fail('You already have a pending name/address request under review.')
  if (!values.first_name || !values.last_name) fail('First name and last name cannot be blank.')
  if (missing.length) fail('Please fill in: ' + missing.join(', ') + '.')
  if (parts.postal_code && !/^\d{4}$/.test(parts.postal_code)) fail('A Philippine postal code is four digits.')
  const over = overlongAddressFields(parts).length ? overlongAddressFields(parts) : overlongAddressFields(temp, 'Temporary ')
  if (over.length) fail('These entries are too long: ' + over.join(', ') + '.')
  if (!changed) fail('Nothing has changed yet. Edit a name or address field before sending the request.')
  return {
    name: profileMap({ ...values, gender: resident.name.gender }, PROFILE_PERSON),
    birthdate: null,
    permanentAddress: { ...profileMap(parts, PROFILE_ADDRESS), displayLine: buildAddressLine(...Object.values(parts)) },
    temporaryAddress: resident.residencyStatus === 'temporary' ? { ...profileMap(temp, PROFILE_ADDRESS), displayLine: buildAddressLine(...Object.values(temp)) } : null,
    legacyEmail: '', legacyContact: '', legacyBarangaySubdivision: '',
  }
}
function familyProposal(input, pending) {
  const keys = ['occupation', 'hotline_number', 'is_married', 'has_children', 'family_reason']
  for (const who of ['spouse', 'father', 'mother']) for (const key of [...personFieldKeys(), 'courtesy_title_other']) keys.push(who + '_' + key)
  const values = profileStrings(input, keys)
  const household = { occupation: values.occupation, hotlineNumber: values.hotline_number,
    isMarried: values.is_married === '1', hasChildren: values.has_children === '1' }
  for (const who of ['spouse', 'father', 'mother']) {
    const person = Object.fromEntries(personFieldKeys().map(key => [key, values[who + '_' + key]]))
    person.courtesy_title = resolveCourtesyTitle(person.courtesy_title, values[who + '_courtesy_title_other'])
    household[who] = who === 'spouse' && !household.isMarried ? null : profileMap(person, PROFILE_PERSON)
  }
  const people = {}
  for (const key of ['children', 'references']) {
    if (!Array.isArray(input[key] ?? [])) fail('Invalid request field: ' + key + '.')
    const rows = (input[key] || []).map(row => {
      if (!validObject(row)) fail('Invalid request field: ' + key + '.')
      return profileStrings(row, [...personFieldKeys(), 'courtesy_title_other'])
    })
    people[key] = key === 'children' && !household.hasChildren ? [] : collectPersonRows(rows)
  }
  const problems = [...personRowsErrors(people.children, 'Child'), ...personRowsErrors(people.references, 'Character reference')]
  if (!values.family_reason) problems.push('Give a short reason so staff know what you are correcting.')
  if (household.isMarried && !household.spouse.firstName) problems.push('Enter your spouse\'s first name, or answer No to "Are you married?".')
  if (!people.references.length) problems.push('At least one character reference is required.')
  if (household.hotlineNumber && !new RegExp(hotlineNumberPattern()).test(household.hotlineNumber)) problems.push('Check the hotline number. ' + hotlineFormatHint())
  if (pending) problems.push('You already have a change waiting for review. Staff will look at that one first.')
  if (problems.length) fail(problems[0])
  return { proposal: household, people, reason: values.family_reason }
}

function jpegDimensions(data) {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])
  let offset = 2
  while (offset < data.length) {
    while (data[offset] === 0xff) offset++
    const marker = data[offset++]
    if (marker == null || marker === 0xd9 || marker === 0xda) break
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (offset + 2 > data.length) return null
    const length = (data[offset] << 8) | data[offset + 1]
    if (length < 2 || offset + length > data.length) return null
    if (sof.has(marker)) {
      if (length < 7) return null
      return { height: (data[offset + 3] << 8) | data[offset + 4], width: (data[offset + 5] << 8) | data[offset + 6] }
    }
    offset += length
  }
  return null
}
function photoValue(input) {
  const data = profileStrings(input, ['photo']).photo
  if (!data) fail('Please select a photo to upload.')
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(data)
  if (!match) fail('Uploaded file must be a valid image.')
  let bytes
  try { bytes = Uint8Array.from(atob(match[1]), character => character.charCodeAt(0)) }
  catch { fail('Uploaded file must be a valid image.') }
  const dimensions = jpegDimensions(bytes)
  if (!dimensions) fail('Uploaded file must be a valid image.')
  if (bytes.length > 60 * 1024 || dimensions.width > 256 || dimensions.height > 256 || dimensions.width !== dimensions.height) fail('The selected photo is too large.')
  return data
}

function validateFamilyObjectShape(input) {
  for (const key of ['children', 'references']) {
    if (!Array.isArray(input[key] ?? [])) fail('Invalid request field: ' + key + '.')
    for (const row of input[key] || []) if (!validObject(row)) fail('Invalid request field: ' + key + '.')
  }
}
const uidPath = uid => 'residents/' + uid

export async function handleResidentProfile(ctx, action, input) {
  if (ctx.request.method !== 'POST') fail('Method not allowed.', 405)
  if (ctx.bodySize > 524288) fail('Invalid request.', 413)
  if (typeof input.idToken !== 'string' || typeof input.action !== 'string') fail('Invalid request.', 400)
  const { identity, account } = await ctx.actor({ roles: ['resident'] })
  const uid = identity.localId
  if (action === 'get') return { ok: true, data: await profileData(ctx, uid, account) }
  if (!['contact', 'birthdate', 'nameAddress', 'family', 'photo', 'removePhoto'].includes(action)) fail('Not found.', 404)
  if (action === 'family') validateFamilyObjectShape(input)
  const photo = action === 'photo' ? photoValue(input) : ''
  for (let attempt = 0; attempt < 5; attempt++) {
    const tx = await ctx.store.begin()
    try {
      const current = await ctx.actorInTransaction(tx, { roles: ['resident'] })
      const paths = [
        'users/' + uid, uidPath(uid),
        'pendingRequests/' + uid + '_nameAddress', 'pendingRequests/' + uid + '_family',
        'accountLocks/' + uid,
      ]
      const read = await ctx.store.batchGet(paths, tx)
      const freshAccount = read.get(paths[0]) || current.account
      const resident = read.get(paths[1])
      if (!resident) throw new Error('Profile unavailable')
      const writes = []
      let message
      if (action === 'contact') {
        writes.push(profileWrite(ctx, paths[1], { contact: contactValues(input) }, ['contact'], ['updatedAt']))
        message = 'Your email and contact information have been updated successfully.'
      } else if (action === 'photo' || action === 'removePhoto') {
        writes.push(profileWrite(ctx, paths[1], { photoDataUrl: photo }, ['photoDataUrl'], ['updatedAt']))
        writes.push(ctx.store.remove('profileImages/' + uid))
        message = action === 'photo' ? 'Profile photo uploaded successfully.' : 'Profile photo removed. Your initial is shown instead.'
      } else {
        const [pendingNames, pendingFamily] = await pendingRequests(ctx, uid, tx)
        const pending = Boolean(pendingNames.length || pendingFamily.length || read.get(paths[2]) || read.get(paths[3]))
        let proposed, people = {}, reason = ''
        if (action === 'family') {
          const result = familyProposal(input, pending)
          proposed = result.proposal; people = result.people; reason = result.reason
          message = 'Your family details change was sent to barangay staff for review.'
        } else if (action === 'birthdate') {
          proposed = birthdateProposal(input, resident, pending)
          message = 'Your birthdate correction has been sent to staff for review.'
        } else {
          proposed = nameAddressProposal(input, resident, pending)
          message = 'Your name and address update request has been sent to staff for review.'
        }
        const kind = action === 'family' ? 'family' : 'nameAddress'
        const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
        const path = (kind === 'family' ? 'familyRequests/' : 'nameAddressRequests/') + id
        const request = {
          kind, ownerUid: uid, ownerIdentifier: freshAccount.identifier, ownerDisplayName: freshAccount.displayName,
          requestedByUid: uid, requestedByName: freshAccount.displayName, proposed,
          previousAddress: action === 'nameAddress' ? resident.permanentAddress?.displayLine || '' : '', reason,
          firstReferenceId: kind === 'family' ? 'reference-0' : null,
          status: 'pending', reviewedAt: null, reviewedByUid: null, reviewedByName: '', reviewComment: '', legacyId: null,
        }
        writes.push(profileWrite(ctx, path, request, null, ['requestedAt']))
        writes.push(profileWrite(ctx, 'pendingRequests/' + uid + '_' + kind, { ownerUid: uid, kind, requestId: id }))
        for (const [key, rows] of Object.entries(people)) {
          const collection = key === 'references' ? 'characterReferences' : 'children'
          for (const [order, person] of rows.entries()) {
            const personId = (key === 'references' ? 'reference-' : 'child-') + order
            writes.push(profileWrite(ctx, path + '/' + collection + '/' + personId,
              { person: profileMap(person, PROFILE_PERSON), displayOrder: order, legacyId: null }, null, ['createdAt']))
          }
        }
      }
      if (writes.length > 500) throw new Error('Too many people')
      const committed = await ctx.store.commit(writes, tx)
      if (committed.status === 409) { await ctx.store.rollback(tx); continue }
      if (committed.status !== 200) throw new Error('Profile save unavailable')
      return { ok: true, data: await profileData(ctx, uid, freshAccount), message }
    } catch (error) {
      await ctx.store.rollback(tx).catch(() => {})
      if (error instanceof HttpError) throw error
      throw error
    }
  }
  throw new Error('Profile changed; retry')
}
