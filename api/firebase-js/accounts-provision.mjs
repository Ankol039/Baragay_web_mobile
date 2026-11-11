import { accountTransaction, apiError, accountStrings, operationId, bounds, hash, phpJson, write, query, admin, peopleWrites, accountId, randomId } from './accounts-store.mjs'
import { residentValues, accountDate } from './accounts-validation.mjs'
import { personFieldKeys, resolveCourtesyTitle, PROFILE_PERSON, PROFILE_ADDRESS, profileMap, buildFullName, withCourtesyTitle, passwordPolicyErrors, today } from './policy.mjs'
const full = profile => buildFullName(...['firstName','middleName','lastName','nameExtension'].map(key => profile.name[key] || ''))
function provisionResult(op, display, title) {
  return op.kind === 'staff' ? { ok: true, data: { uid: op.uid, new_staff: { full_name: withCourtesyTitle(title, display), staff_number: op.identifier } }, message: 'Staff account created for ' + display + '.' }
    : { ok: true, data: { uid: op.uid, resident_id: op.uid, resident_number: op.identifier }, message: op.public ? 'Account created successfully.' : 'Resident added successfully. Their auto-generated Resident Number (and default password) is: ' }
}
export async function provision(ctx, input, actor, kind, isPublic) {
  if (actor) await accountTransaction(ctx, actor, async (_tx, a) => { if (kind === 'staff' && a.role !== 'admin') apiError('Only administrators can create staff accounts.', 403); return [[], []] })
  const operation = operationId(input), original = input.values
  if (!original || typeof original !== 'object' || Array.isArray(original)) apiError('Invalid request.')
  const values = { ...original }, chosenPassword = isPublic ? (values.password || '') : ''
  if (typeof chosenPassword !== 'string') apiError('Invalid request.')
  delete values.password; delete values.confirm_password
  if (isPublic) {
    const errors = passwordPolicyErrors(chosenPassword)
    if (errors.length) apiError('Your new password does not meet the requirements: ' + errors.join('; ') + '.')
    if (chosenPassword !== original.confirm_password) apiError('New password and confirmation do not match.')
  }
  let profile, people
  if (kind === 'resident') [profile, people] = residentValues(values)
  else {
    const v = accountStrings(values, [...personFieldKeys(), 'courtesy_title_other', 'date_hired'])
    if (!v.first_name || !v.last_name || !v.date_hired) apiError('First name, last name, and date hired are required.')
    if (v.date_hired > today()) apiError('Date hired cannot be in the future.')
    v.courtesy_title = resolveCourtesyTitle(v.courtesy_title, v.courtesy_title_other)
    profile = { name: profileMap(v, PROFILE_PERSON), position: '', dateHired: accountDate(v.date_hired), contact: { email: '', number: '' }, birthdate: null, licenseNumber: '', address: { ...profileMap({}, PROFILE_ADDRESS), displayLine: '' }, emergencyContact: { name: '', number: '', legacyValue: '' }, createdByUid: actor }
    people = {}
  }
  bounds(profile); bounds(people)
  if (kind === 'staff' && [...full(profile)].length > 100) apiError('The request could not be completed. Please try again.')
  if (4 + Object.values(people).reduce((n, rows) => n + rows.length, 0) > 500) apiError('The request could not be completed. Please try again.')
  const display = full(profile), fingerprint = await hash(phpJson([kind, isPublic, values], true)), path = 'accountOperations/' + await hash((actor || 'public') + ':' + operation)
  const op = await accountTransaction(ctx, actor, async (tx, a) => {
    if (kind === 'staff') admin(a)
    const old = await ctx.store.get(path, tx)
    if (old) {
      if (old.fingerprint !== fingerprint || (isPublic && !(await ctx.verifyPasswordProof(chosenPassword, operation, old.passwordProof || '')))) apiError('Invalid registration continuation.', 403)
      return [[], old]
    }
    const counterPath = 'counters/' + (kind === 'resident' ? 'residentNumbers' : 'staffNumbers'), counter = await ctx.store.get(counterPath, tx)
    let max = Number(counter?.value || 0)
    if (!counter) for (const u of await query(ctx, '', 'users', tx)) if ((u.role === 'resident') === (kind === 'resident')) max = Math.max(max, Number(u.identifier.slice(-4)) || 0)
    if (max >= 9999) apiError('The account number sequence is exhausted. Please contact the administrator.')
    const number = (kind === 'resident' ? 'R-' : 'S-') + today().slice(0,4) + '-' + String(max + 1).padStart(4, '0'), uid = kind + '-' + randomId()
    const aliasPath = 'identifierAliases/' + (kind === 'resident' ? 'residentNumber' : 'staffNumber') + '_' + await hash(number.toLowerCase())
    if (await ctx.store.get(aliasPath, tx)) throw new Error('Counter/alias mismatch')
    const reserved = { uid, identifier: number, kind, actorUid: actor, fingerprint, public: isPublic, passwordProof: isPublic ? await ctx.passwordProof(chosenPassword, operation) : '', state: 'reserved' }
    return [[write(ctx, counterPath, { value: max + 1, lastUid: uid }, false, ['updatedAt']), write(ctx, path, reserved, false, ['createdAt', 'updatedAt'])], reserved]
  })
  if (op.state === 'complete') return provisionResult(op, display, profile.name.courtesyTitle)
  const uid = op.uid, number = op.identifier, email = number.toLowerCase() + '@barangay.app', password = isPublic ? chosenPassword : number
  const created = await ctx.authCreate({ localId: uid, email, password, displayName: display, disabled: true })
  if (created.status !== 200) { const lookup = await ctx.authAdmin('accounts:lookup', { localId: [uid] }); if (lookup.status !== 200 || lookup.body.users?.[0]?.email !== email) throw new Error('Account creation unavailable') }
  await accountTransaction(ctx, actor, async (tx, a) => {
    if (kind === 'staff') admin(a)
    const fresh = await ctx.store.get(path, tx)
    if (fresh.state === 'complete' || await ctx.store.get('users/' + uid, tx)) return [[], []]
    const user = { uid, role: kind, identifier: number, username: kind === 'staff' ? number : '', displayName: display, isActive: false, isFirstLogin: !isPublic, profileCompleted: kind === 'resident', deletedAt: null, deletedByUid: null, deletedByName: '', deleteReason: '', legacyId: null }
    if (kind === 'resident') user.selfRegistered = isPublic
    const aliasKind = kind === 'resident' ? 'residentNumber' : 'staffNumber'
    const writes = [write(ctx, 'users/' + uid, user, false, ['createdAt','updatedAt']), write(ctx, (kind === 'resident' ? 'residents/' : 'staff/') + uid, { ...profile, uid, legacyId: null }, false, ['createdAt','updatedAt']), write(ctx, 'identifierAliases/' + aliasKind + '_' + await hash(number.toLowerCase()), { kind: aliasKind, normalizedIdentifier: number.toLowerCase(), uid, authEmail: email }, false, ['createdAt']), write(ctx, path, { state: 'profileReady' }, true, ['updatedAt'])]
    return [[...writes, ...await peopleWrites(ctx, (kind === 'resident' ? 'residents/' : 'staff/') + uid, people)], []]
  })
  if ((await ctx.authAdmin('accounts:update', { localId: uid, disableUser: false })).status !== 200) throw new Error('Account activation unavailable')
  await accountTransaction(ctx, actor, async (tx, a) => { if (kind === 'staff') admin(a); const fresh = await ctx.store.get(path, tx); return fresh.state === 'complete' ? [[], []] : [[write(ctx, 'users/' + uid, { isActive: true }, true, ['updatedAt']), write(ctx, path, { state: 'complete' }, true, ['updatedAt'])], []] })
  return provisionResult(op, display, profile.name.courtesyTitle)
}
export async function reset(ctx, input, actor, kind) {
  const id = accountId(input.targetUid), operation = operationId(input), path = 'accountOperations/' + await hash(actor + ':' + operation)
  const op = await accountTransaction(ctx, actor, async (tx, a) => {
    if (kind === 'staff') { if (a.role !== 'admin') apiError('Only administrators can reset a staff password.', 403); if (id === actor) apiError('Use Change Password to update your own password.') }
    const u = await ctx.store.get('users/' + id, tx)
    if (!u || ((u.role === 'resident') !== (kind === 'resident')) || u.deletedAt != null) apiError('That ' + kind + ' account could not be found.')
    const old = await ctx.store.get(path, tx)
    if (old) { if (old.targetUid !== id || old.kind !== kind || old.type !== 'reset') apiError('Invalid request.'); return [[], old] }
    if (await ctx.store.get('accountLocks/' + id, tx)) apiError('The request could not be completed. Please try again.', 409)
    const pending = { type: 'reset', targetUid: id, kind, identifier: u.identifier, wasActive: u.isActive, state: 'pending' }
    return [[write(ctx, path, pending, false, ['createdAt','updatedAt']), write(ctx, 'accountLocks/' + id, { operationPath: path }), write(ctx, 'users/' + id, { isActive: false, isFirstLogin: true }, true, ['updatedAt'])], pending]
  })
  if (op.state !== 'complete') {
    if ((await ctx.authAdmin('accounts:update', { localId: id, password: op.identifier, disableUser: !op.wasActive, validSince: String(Math.floor(Date.now()/1000)) })).status !== 200) throw new Error('Password reset unavailable')
    await accountTransaction(ctx, actor, async (tx, a) => {
      if (kind === 'staff') admin(a)
      const fresh = await ctx.store.get(path, tx); if (fresh.state === 'complete') return [[], []]
      const target = await ctx.store.get('users/' + id, tx), lock = await ctx.store.get('accountLocks/' + id, tx)
      if (!target || target.deletedAt != null || lock?.operationPath !== path) apiError('The request could not be completed. Please try again.', 409)
      return [[write(ctx, 'users/' + id, { isActive: op.wasActive, isFirstLogin: true }, true, ['updatedAt']), write(ctx, path, { state: 'complete' }, true, ['updatedAt']), ctx.store.remove('accountLocks/' + id)], []]
    })
  }
  return { ok: true, data: [], message: kind === 'resident' ? 'Password reset to default (resident number).' : 'Password reset to the Staff Number (' + op.identifier + '). They will be asked to set a new one at their next login.' }
}
