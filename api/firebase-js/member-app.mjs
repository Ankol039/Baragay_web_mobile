// MIT App Inventor adapter. Existing account/profile handlers remain authoritative.
import { HttpError } from './core/errors.mjs'
import { createContext } from './core/context.mjs'
import { handleAuth } from './auth.mjs'
import { provision } from './accounts-provision.mjs'
import { handleResidentProfile } from './resident-profile.mjs'
import { PROFILE_PERSON, PROFILE_ADDRESS, profileUnmap } from './policy.mjs'
import { jsonRequest } from './core/google.mjs'
const database = 'https://barangay-survey-1cc7d-default-rtdb.firebaseio.com'
const fail = (message, status = 422) => { throw new HttpError(message, status) }
const fork = (ctx, input) => createContext(ctx.request, ctx.env, input, JSON.stringify(input).length)
const date = value => value instanceof Date ? value.toISOString().slice(0, 10) : value || ''
export function memberValues(member) {
  const m = member || {}, h = m.household || {}, values = {
    ...profileUnmap(m.name, PROFILE_PERSON), ...profileUnmap(m.permanentAddress, PROFILE_ADDRESS),
    email: m.contact?.email || '', contact_number: m.contact?.number || '',
    birthdate: date(m.birthdate), birthplace: m.birthplace || '', residency_status: m.residencyStatus || 'permanent',
    residency_start_date: date(m.residencyStartDate), residence_type: m.residenceType || '',
    special_category: m.specialCategory || 'none', category_reference: m.categoryReference || '',
    occupation: h.occupation || '', hotline_number: h.hotlineNumber || '',
    is_married: h.isMarried ? '1' : '0', has_children: h.hasChildren ? '1' : '0',
  }
  for (const [key, value] of Object.entries(profileUnmap(m.temporaryAddress, PROFILE_ADDRESS))) values['temp_' + key] = value
  for (const who of ['spouse', 'father', 'mother']) for (const [key, value] of Object.entries(profileUnmap(h[who], PROFILE_PERSON))) values[who + '_' + key] = value
  for (const [key, collection] of [['children', 'children'], ['references', 'characterReferences']]) {
    values[key] = Object.values(m[collection] || {}).sort((a,b) => a.displayOrder - b.displayOrder).map(row => profileUnmap(row.person, PROFILE_PERSON))
  }
  return values
}
async function snapshot(ctx, mirror = true) {
  const { identity, account } = await ctx.actor({ roles: ['resident'], ready: false })
  const uid = identity.localId, profile = await ctx.store.get('residents/' + uid)
  if (!profile) fail('Resident profile not found.', 404)
  const member = { ...profile, identifier: account.identifier, displayName: account.displayName,
    isActive: account.isActive, isFirstLogin: account.isFirstLogin, profileCompleted: account.profileCompleted,
    createdAt: account.createdAt, uid }
  for (const collection of ['children', 'characterReferences']) {
    const rows = await ctx.store.list(`residents/${uid}/${collection}`)
    member[collection] = Object.fromEntries(rows.map(row => [row.id, row.data]))
  }
  let realtime = 'Profile copying disabled until owner-only database rules are approved'
  if (mirror && ctx.env.MEMBER_APP_REALTIME_ENABLED === 'true' && !account.isFirstLogin && account.profileCompleted) {
    try {
      const token = ctx.input.idToken
      const result = await jsonRequest(`${database}/Members/${encodeURIComponent(uid)}.json?auth=${encodeURIComponent(token)}`, member, null, 'PUT')
      realtime = result.status === 200 ? 'Connected' : 'Unavailable: check Realtime Database rules'
    } catch { realtime = 'Unavailable: connection failed' }
  }
  return { member, realtime }
}
export async function handleMemberApp(ctx, action, input) {
  if (ctx.request.method !== 'POST') fail('Method not allowed.', 405)
  if (ctx.bodySize > 524288) fail('Invalid request.', 413)
  if (action === 'register') {
    const values = memberValues(input.member)
    values.password = input.password; values.confirm_password = input.confirm_password
    return provision(ctx, { values, operationId: input.operationId }, null, 'resident', true)
  }
  if (action === 'login') {
    const resolved = await handleAuth(ctx, 'resolve', { identifier: input.identifier, password: input.password })
    const auth = await ctx.authClient('signInWithPassword', { email: resolved.data.email, password: input.password, returnSecureToken: true })
    if (auth.status !== 200) fail('Invalid Resident Number or password.', 401)
    const session = auth.body
    const active = fork(ctx, { idToken: session.idToken })
    const data = await snapshot(active)
    await active.audit('login', await active.actor({ roles: ['resident'], ready: false }))
    return { ok: true, data: { ...data, idToken: session.idToken, refreshToken: session.refreshToken } }
  }
  if (action === 'refresh') {
    if (typeof input.refreshToken !== 'string' || !input.refreshToken) fail('Please sign in again.', 401)
    const local = ctx.env.BSS_USE_EMULATORS === 'true'
    const key = local ? 'emulator-only' : ctx.env.FIREBASE_WEB_API_KEY
    const tokenBase = local ? 'http://127.0.0.1:9099/securetoken.googleapis.com' : 'https://securetoken.googleapis.com'
    const response = await fetch(`${tokenBase}/v1/token?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: input.refreshToken }),
    })
    const session = await response.json()
    if (!response.ok || !session.id_token) fail('Your session expired. Please log in again.', 401)
    const data = await snapshot(fork(ctx, { idToken: session.id_token }))
    return { ok: true, data: { ...data, idToken: session.id_token, refreshToken: session.refresh_token } }
  }
  const { identity, account } = await ctx.actor({ roles: ['resident'], ready: false })
  if (action === 'password') {
    const result = await handleAuth(ctx, 'password', input)
    return { ...result, message: result.message + ' Log out and sign in with the new password.' }
  }
  if (action === 'logout') {
    await ctx.audit('logout', { identity, account })
    return { ok: true }
  }
  await ctx.actor({ roles: ['resident'] })
  if (action === 'profile' || action === 'connection') {
    const data = await snapshot(ctx)
    if (action === 'connection' && ctx.env.MEMBER_APP_REALTIME_ENABLED !== 'true') {
      try {
        const result = await jsonRequest(`${database}/Members/${encodeURIComponent(identity.localId)}/identifier.json?auth=${encodeURIComponent(input.idToken)}`)
        data.realtime = result.status === 200 ? 'Connected (profile copying disabled)' : 'Unavailable: access denied'
      } catch { data.realtime = 'Unavailable: connection failed' }
    }
    return { ok: true, data }
  }
  if (action === 'photo' || action === 'removePhoto') {
    await handleResidentProfile(ctx, action, input)
    return { ok: true, data: await snapshot(ctx), message: 'Profile photo updated.' }
  }
  if (action === 'save') {
    const old = (await snapshot(ctx, false)).member
    const oldValues = memberValues(old), values = memberValues(input.member)
    // Only fields displayed by the edit screen are accepted. Sensitive account fields never come from the client.
    const nameKeys = ['first_name','middle_name','last_name','name_extension']
    const addressKeys = Object.keys(profileUnmap(old.permanentAddress, PROFILE_ADDRESS))
    const changedIdentity = [...nameKeys, ...addressKeys].some(key => values[key] !== oldValues[key])
    const changedFamily = ['occupation', 'hotline_number'].some(key => values[key] !== oldValues[key])
    if (changedIdentity && changedFamily) fail('Submit name/address changes separately from household changes. Contact information can be saved with either request.')
    const authoritative = { ...oldValues }
    for (const key of [...nameKeys, ...addressKeys, 'email','contact_number','occupation','hotline_number']) if (key in values) authoritative[key] = values[key]
    if (changedIdentity || changedFamily) {
      const requestedAction = changedIdentity ? 'nameAddress' : 'family'
      const request = { ...authoritative, action: requestedAction, idToken: input.idToken }
      await handleResidentProfile(fork(ctx, request), requestedAction, request)
    }
    if (values.email !== oldValues.email || values.contact_number !== oldValues.contact_number) {
      const contact = { action: 'contact', idToken: input.idToken, email: values.email, contact_number: values.contact_number }
      await handleResidentProfile(fork(ctx, contact), 'contact', contact)
    }
    return { ok: true, data: await snapshot(ctx), message: changedIdentity || changedFamily ? 'Your change request was sent to barangay staff for review. Contact changes were saved.' : 'Contact information saved.' }
  }
  fail('Not found.', 404)
}
