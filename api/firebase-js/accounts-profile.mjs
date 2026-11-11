import { HttpError } from './core/errors.mjs'
import { accountTransaction, apiError, write, filterQuery } from './accounts-store.mjs'
import { PROFILE_ADDRESS, profileMap, profileUnmap, profileStrings, addressFieldNames, profileMetadata,
  genderOptions, withCourtesyTitle, buildAddressLine, today, dateOnly, validDate } from './policy.mjs'

function requestStrings(input, keys) {
  try { return profileStrings(input, keys) }
  catch (error) { if (error instanceof HttpError) apiError(error.message, 422); throw error }
}

function staffAddressFields() {
  const fields = profileMetadata().address
  const examples = ['0444', 'Purok 3', 'Rizal Street', 'Sapang Puke', 'Malolos', '3000', 'Bulacan']
  for (const [index, key] of Object.keys(fields).entries()) {
    fields[key].placeholder = examples[index]
    fields[key].maxlength = key === 'postal_code' ? 4 : null
  }
  return fields
}

function dateLabel(value, pattern = 'Y-m-d H:i:s') {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(d.getTime())) return ''
  const shifted = new Date(d.getTime() + 8 * 3600000)
  const pad = number => String(number).padStart(2, '0')
  const h = shifted.getUTCHours(), months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const values = { Y: shifted.getUTCFullYear(), m: pad(shifted.getUTCMonth() + 1), n: shifted.getUTCMonth() + 1, d: pad(shifted.getUTCDate()),
    j: shifted.getUTCDate(), F: months[shifted.getUTCMonth()], M: months[shifted.getUTCMonth()].slice(0, 3), H: pad(h), G: h, g: h % 12 || 12,
    h: pad(h % 12 || 12), i: pad(shifted.getUTCMinutes()), s: pad(shifted.getUTCSeconds()), A: h < 12 ? 'AM' : 'PM', a: h < 12 ? 'am' : 'pm' }
  return pattern.replace(/\\(.)|[Ymn djFMHGghisAa]/g, (token, escaped) => escaped ?? values[token] ?? token)
}

function acDate(value) {
  if (!validDate(value)) apiError('Please enter a valid date.')
  return new Date(`${value}T00:00:00Z`)
}

function staffData(account, profile, pending, legacyPhoto) {
  const p = profile
  const row = { ...profileUnmap(p.address, PROFILE_ADDRESS), staff_number: account.identifier, username: account.username,
    full_name: account.displayName, courtesy_title: p.name.courtesyTitle, date_hired: dateOnly(p.dateHired), role: account.role,
    contact_number: p.contact.number, email: p.contact.email, birthdate: dateOnly(p.birthdate), gender: p.name.gender,
    license_number: p.licenseNumber, address: p.address.displayLine, emergency_contact_name: p.emergencyContact.name,
    emergency_contact_number: p.emergencyContact.number, is_first_login: account.isFirstLogin, profile_completed: account.profileCompleted,
    display_name: withCourtesyTitle(p.name.courtesyTitle, account.displayName) }
  row.photo_path = p.photoDataUrl ?? (legacyPhoto ? `data:image/jpeg;base64,${legacyPhoto.base64}` : '')
  return { account: row, pending_request: pending ? { address: pending.proposed.displayLine, submitted_at: dateLabel(pending.requestedAt) } : null,
    is_admin: account.role === 'admin', onboarding: account.role !== 'admin' && !account.profileCompleted, today: today(),
    genders: genderOptions(), address_fields: staffAddressFields() }
}

function photoData(input) {
  const data = requestStrings(input, ['photo']).photo
  if (!data) apiError('Please select a photo to upload.')
  const match = data.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/)
  if (!match) apiError('Uploaded file must be a valid image.')
  let bytes
  try { bytes = Uint8Array.from(atob(match[1]), value => value.charCodeAt(0)) }
  catch { apiError('Uploaded file must be a valid image.') }
  if (bytes.byteLength > 60 * 1024) apiError('The selected photo is too large.')
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) apiError('Uploaded file must be a valid image.')
  const starts = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])
  let width = 0, height = 0, offset = 2
  while (offset < bytes.length - 4) {
    if (bytes[offset] !== 0xff) { offset++; continue }
    while (bytes[offset] === 0xff) offset++
    const marker = bytes[offset++]
    if ([0xd8, 0xd9, 0x01, ...Array.from({ length: 8 }, (_, i) => 0xd0 + i)].includes(marker)) continue
    if (offset + 2 > bytes.length) break
    const length = (bytes[offset] << 8) | bytes[offset + 1]
    if (length < 2 || offset + length > bytes.length) break
    if (starts.has(marker)) {
      height = (bytes[offset + 3] << 8) | bytes[offset + 4]
      width = (bytes[offset + 5] << 8) | bytes[offset + 6]
      break
    }
    offset += length
  }
  if (!width || !height) apiError('Uploaded file must be a valid image.')
  if (width > 256 || height > 256 || width !== height) apiError('The selected photo is too large.')
  return data
}

async function currentStaff(ctx, tx, uid) {
  const account = await ctx.store.get(`users/${uid}`, tx)
  const profile = await ctx.store.get(`staff/${uid}`, tx)
  if (!profile) throw new Error('Missing staff profile')
  const pending = account.role === 'admin' ? [] : await filterQuery(ctx, '', 'staffRequests', { ownerUid: uid, status: 'pending' }, tx)
  pending.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt))
  const legacyPhoto = Object.hasOwn(profile, 'photoDataUrl') ? null : await ctx.store.get(`profileImages/${uid}`, tx)
  return { account, profile, pending: pending[0] ?? null, legacyPhoto }
}

export async function staffProfile(ctx, action, input, actorUid) {
  if (action === 'staffProfile') {
    return accountTransaction(ctx, actorUid, async tx => {
      const { account, profile, pending, legacyPhoto } = await currentStaff(ctx, tx, actorUid)
      return [[], staffData(account, profile, pending, legacyPhoto)]
    }, true).then(data => ({ ok: true, data }))
  }
  const result = await accountTransaction(ctx, actorUid, async (tx, account) => {
    const profile = await ctx.store.get(`staff/${actorUid}`, tx)
    if (!profile) throw new Error('Missing staff profile')
    const writes = []
    let outcome = 'normal'
    if (['staffPhoto', 'staffRemovePhoto'].includes(action)) {
      const photo = action === 'staffPhoto' ? photoData(input) : ''
      writes.push(write(ctx, `staff/${actorUid}`, { photoDataUrl: photo }, true, ['updatedAt']), ctx.store.remove(`profileImages/${actorUid}`))
    } else {
      if (account.role === 'admin') apiError('Access denied.', 403)
      const v = requestStrings(input, ['contact_number', 'email', 'birthdate', 'gender', 'license_number', 'emergency_contact_name', 'emergency_contact_number', 'reason', ...addressFieldNames()])
      const onboarding = !account.profileCompleted
      const pending = await filterQuery(ctx, '', 'staffRequests', { ownerUid: actorUid, status: 'pending' }, tx)
      const locked = !onboarding && pending.length > 0
      const address = { ...profileMap(v, PROFILE_ADDRESS), displayLine: buildAddressLine(...addressFieldNames().map(key => v[key])) }
      const changed = !onboarding && !locked && address.displayLine !== profile.address.displayLine
      if (!v.contact_number) apiError('Contact number is required.')
      if (!/^[0-9+()\-\x09-\x0d ]{7,20}$/.test(v.contact_number)) apiError('Enter a contact number using digits, spaces, and + ( ) - only.')
      if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) apiError('Enter a valid email address, or leave the field blank.')
      if (v.birthdate && v.birthdate >= today()) apiError('Birthdate must be in the past.')
      if ([...v.license_number].length > 50) apiError('That license number is too long (50 characters maximum).')
      if (v.license_number && !/^[A-Za-z0-9\-\x09-\x0d /]+$/.test(v.license_number)) apiError('Enter a license number using letters, digits, spaces, and - / only.')
      if (v.emergency_contact_number && !/^[0-9+()\-\x09-\x0d ]{7,20}$/.test(v.emergency_contact_number)) apiError('Enter an emergency contact number using digits, spaces, and + ( ) - only.')
      if (!locked && (!v.household_number || !v.barangay || !v.municipality || !v.province)) apiError('Household Number, Barangay, Municipality/City, and Province are required.')
      if (!locked && v.postal_code && !/^\d{4}$/.test(v.postal_code)) apiError('A Philippine postal code is four digits.')
      if (changed && !v.reason) apiError('Give a short reason for the address change so the administrator can act on it.')
      const name = { ...profile.name, gender: Object.hasOwn(genderOptions(), v.gender) ? v.gender : '' }
      const next = { name, contact: { email: v.email, number: v.contact_number }, birthdate: v.birthdate ? acDate(v.birthdate) : null,
        licenseNumber: v.license_number, emergencyContact: { name: v.emergency_contact_name, number: v.emergency_contact_number,
          legacyValue: `${v.emergency_contact_name}${v.emergency_contact_number ? ` - ${v.emergency_contact_number}` : ''}`.trim() } }
      if (onboarding) { next.address = address; outcome = 'first' }
      else if (changed) {
        const id = crypto.randomUUID().replaceAll('-', '')
        const request = { kind: 'staff', ownerUid: actorUid, ownerIdentifier: account.identifier, ownerDisplayName: account.displayName,
          requestedByUid: actorUid, requestedByName: account.displayName, proposed: address, previousAddress: profile.address.displayLine,
          reason: v.reason, firstReferenceId: null, status: 'pending', reviewedAt: null, reviewedByUid: null, reviewedByName: '',
          reviewComment: '', legacyId: null }
        writes.push(write(ctx, `staffRequests/${id}`, request, false, ['requestedAt']),
          write(ctx, `pendingRequests/${actorUid}_staff`, { ownerUid: actorUid, kind: 'staff', requestId: id }))
        outcome = 'requested'
      }
      writes.push(write(ctx, `staff/${actorUid}`, next, true, ['updatedAt']), write(ctx, `users/${actorUid}`, { profileCompleted: true }, true, ['updatedAt']))
    }
    return [writes, { outcome }]
  }, true)
  return accountTransaction(ctx, actorUid, async tx => {
    const { account, profile, pending, legacyPhoto } = await currentStaff(ctx, tx, actorUid)
    return [[], { ok: true, data: staffData(account, profile, pending, legacyPhoto), ...result }]
  }, true)
}
