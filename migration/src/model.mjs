import { Timestamp } from 'firebase-admin/firestore'
import { requireSafe, digest } from './safety.mjs'
export const text = v => v == null ? '' : String(v).trim()
export const integer = v => { const n = Number(v); requireSafe(Number.isSafeInteger(n) && n > 0, 'INVALID_SOURCE_ID'); return n }
export const uid = (kind, id) => `${kind}-${integer(id)}`
export const flag = v => Number(v) === 1
export const normalize = v => text(v).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
export function timestamp(v, dateOnly = false) {
  if (!v || String(v).startsWith('0000-00-00')) return null
  const raw = text(v), iso = dateOnly ? `${raw.slice(0, 10)}T00:00:00.000Z` : `${raw.replace(' ', 'T')}+08:00`
  const d = new Date(iso)
  requireSafe(Number.isFinite(d.getTime()) && (!dateOnly || d.toISOString().slice(0, 10) === raw.slice(0, 10)), 'INVALID_SOURCE_DATE')
  return Timestamp.fromDate(d)
}
export function person(r, prefix = '') {
  let gender = text(r[`${prefix}gender`]); if (gender === 'male') gender = 'man'; if (gender === 'female') gender = 'woman'
  requireSafe(['', 'man', 'woman', 'non_binary', 'prefer_not_to_say'].includes(gender), 'UNSUPPORTED_SOURCE_GENDER')
  return { courtesyTitle: text(r[`${prefix}courtesy_title`]), firstName: text(r[`${prefix}first_name`]), middleName: text(r[`${prefix}middle_name`]),
    lastName: text(r[`${prefix}last_name`]), nameExtension: text(r[`${prefix}name_extension`]), gender }
}
export function address(r, prefix = '', line = `${prefix}address`) {
  return { householdNumber: text(r[`${prefix}household_number`]), purok: text(r[`${prefix}purok`]), streetHighway: text(r[`${prefix}street_highway`]),
    barangay: text(r[`${prefix}barangay`] || r[`${prefix}barangay_subdivision`]), municipality: text(r[`${prefix}municipality`]), postalCode: text(r[`${prefix}postal_code`]),
    province: text(r[`${prefix}province`]), displayLine: text(r[line]) }
}
export function hasAddress(r, prefix = '', line = `${prefix}address`) { return Boolean(text(r[line]) || text(r[`${prefix}household_number`])) }
export function household(r) {
  const relative = who => {
    const p = person(r, `${who}_`)
    return Object.values(p).some(Boolean) ? p : null
  }
  return { occupation: text(r.occupation), hotlineNumber: text(r.hotline_number), isMarried: flag(r.is_married), hasChildren: flag(r.has_children),
    spouse: flag(r.is_married) ? relative('spouse') : null, father: relative('father'), mother: relative('mother') }
}
export function displayName(r, kind) { return kind === 'staff' ? text(r.full_name) : [r.first_name, r.middle_name, r.last_name, r.name_extension].map(text).filter(Boolean).join(' ') }
export function identity(r, kind) {
  const identifier = text(r[kind === 'resident' ? 'resident_number' : 'staff_number']).toUpperCase()
  requireSafe(new RegExp(`^${kind === 'resident' ? 'R' : 'S'}-[0-9]{4}-[0-9]{4}$`).test(identifier), 'INVALID_ACCOUNT_NUMBER')
  const username = kind === 'staff' ? text(r.username) : ''
  const admin = kind === 'staff' && text(r.role).toLowerCase() === 'admin'
  const authEmail = admin ? (normalize(username) === 'admin' ? 'admin@barangay.app' : `u-${digest(normalize(username)).slice(0, 32)}@barangay.app`) : `${identifier.toLowerCase()}@barangay.app`
  return { identifier, username, authEmail }
}
export function user(r, kind) {
  const id = uid(kind, r[`${kind}_id`]), ident = identity(r, kind), createdAt = timestamp(r.created_at)
  requireSafe(createdAt, 'MISSING_CREATION_DATE')
  return { uid: id, role: kind === 'resident' ? 'resident' : text(r.role).toLowerCase(), identifier: ident.identifier, username: ident.username,
    displayName: displayName(r, kind), isActive: r.is_active == null || flag(r.is_active), isFirstLogin: flag(r.is_first_login), profileCompleted: kind === 'resident' || flag(r.profile_completed),
    deletedAt: timestamp(r.deleted_at), deletedByUid: r.deleted_by ? uid('staff', r.deleted_by) : null, deletedByName: text(r.deleted_by_name), deleteReason: text(r.delete_reason),
    createdAt, updatedAt: createdAt, legacyId: integer(r[`${kind}_id`]) }
}
export function residentProfile(r) {
  const createdAt = timestamp(r.created_at)
  return { uid: uid('resident', r.resident_id), name: person(r), contact: { email: text(r.email), number: text(r.contact_number) }, birthdate: timestamp(r.birthdate, true), birthplace: text(r.birthplace),
    permanentAddress: address(r), temporaryAddress: hasAddress(r, 'temp_', 'temporary_address') ? address(r, 'temp_', 'temporary_address') : null,
    residencyStatus: text(r.residency_status) || 'permanent', residencyStartDate: timestamp(r.residency_start_date, true), residenceType: text(r.residence_type), specialCategory: text(r.special_category) || 'none',
    categoryReference: text(r.category_reference), household: household(r), lastResidencyRecordId: null, createdAt, updatedAt: createdAt, legacyId: integer(r.resident_id) }
}
export function staffProfile(r) {
  const createdAt = timestamp(r.created_at)
  return { uid: uid('staff', r.staff_id), name: person(r), position: text(r.position), dateHired: timestamp(r.date_hired, true), contact: { email: text(r.email), number: text(r.contact_number) },
    birthdate: timestamp(r.birthdate, true), licenseNumber: text(r.license_number), address: address(r), emergencyContact: { name: text(r.emergency_contact_name), number: text(r.emergency_contact_number), legacyValue: text(r.emergency_contact) },
    createdByUid: r.created_by ? uid('staff', r.created_by) : null, createdAt, updatedAt: createdAt, legacyId: integer(r.staff_id) }
}
