import { HttpError } from './errors.mjs'
import { createStore } from './store.mjs'
import { googleToken, jsonRequest, passwordProof, verifyPasswordProof, sha256 } from './google.mjs'
const invalid = 'Invalid username/Resident Number or password.'
export function accountState(account, { roles = [], ready = true, lifecycle = true } = {}) {
  if (!account || !['resident', 'staff', 'admin'].includes(account.role)) throw new HttpError(invalid, 401)
  if (lifecycle) {
    if (account.deletedAt != null) throw new HttpError(invalid, 401)
    if (!account.isActive) throw new HttpError(account.role === 'resident'
      ? 'This account has been deactivated. Please contact the Barangay Health Center.'
      : 'This account has been deactivated. Please contact the administrator.', 403)
  }
  if ((roles.length && !roles.includes(account.role)) || (ready && (account.isFirstLogin || !account.profileCompleted))) throw new HttpError('Access denied.', 403)
  return account
}
export function createContext(request, env, input = {}, bodySize = 0) {
  const project = env.FIREBASE_PROJECT_ID || 'barangay-survey-1cc7d', local = env.BSS_USE_EMULATORS === 'true'
  if (project !== 'barangay-survey-1cc7d' || (local && env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099')) throw new HttpError('Server configuration unavailable.', 503)
  const authBase = local ? 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1' : 'https://identitytoolkit.googleapis.com/v1'
  const key = local ? 'emulator-only' : env.FIREBASE_WEB_API_KEY
  const store = createStore(env, project)
  let verified
  const ctx = {
    request, env, input, bodySize, project, store, url: new URL(request.url),
    ip: (env.BSS_REMOTE_ADDR || request.headers.get('cf-connecting-ip') || '').slice(0, 50),
    async authClient(method, body) {
      if (!key) throw new HttpError('Server configuration unavailable.', 503)
      return jsonRequest(`${authBase}/accounts:${method}?key=${encodeURIComponent(key)}`, body)
    },
    async authAdmin(suffix, body, method = 'POST') {
      if (!suffix.startsWith('accounts')) suffix = 'accounts:' + suffix
      return jsonRequest(`${authBase}/projects/${project}/${suffix}`, body, await googleToken(env), method)
    },
    async authCreate(body) {
      if (!key) throw new HttpError('Server configuration unavailable.', 503)
      return jsonRequest(`${authBase}/accounts:signUp?key=${encodeURIComponent(key)}`, { ...body, targetProjectId: project }, await googleToken(env))
    },
    passwordProof: (password, operation) => passwordProof(env, password, operation),
    verifyPasswordProof: (password, operation, proof) => verifyPasswordProof(env, password, operation, proof),
    async actor(options = {}) {
      if (!verified) verified = (async () => {
        const token = input.idToken
        if (typeof token !== 'string' || !token) throw new HttpError('Please sign in to continue.', 401)
        const result = await ctx.authClient('lookup', { idToken: token })
        const identity = result.body?.users?.[0]
        if (result.status !== 200 || !identity || identity.disabled) throw new HttpError('Please sign in to continue.', 401)
        let claims
        try { claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) } catch { throw new HttpError('Please sign in to continue.', 401) }
        if (claims.aud !== project || claims.iss !== `https://securetoken.google.com/${project}` || claims.sub !== identity.localId) throw new HttpError('Please sign in to continue.', 401)
        const rows = await store.batchGet([`users/${identity.localId}`, `accountLocks/${identity.localId}`])
        const account = rows.get(`users/${identity.localId}`)
        if (account?.uid !== identity.localId) throw new HttpError(invalid, 401)
        if (rows.get(`accountLocks/${identity.localId}`)) throw new HttpError('Access denied.', 403)
        return { identity, account }
      })()
      const actor = await verified
      accountState(actor.account, options); ctx.identity = actor.identity; ctx.account = actor.account
      return actor
    },
    async actorInTransaction(tx, options = {}) {
      const actor = await ctx.actor({ ready: false, lifecycle: false })
      const paths = [`users/${actor.identity.localId}`, `accountLocks/${actor.identity.localId}`]
      const rows = await store.batchGet(paths, tx), account = rows.get(paths[0])
      if (!account || account.uid !== actor.identity.localId || rows.get(paths[1])) throw new HttpError('Access denied.', 403)
      accountState(account, options)
      return { identity: actor.identity, account }
    },
    async audit(event, actor, extra = {}) {
      const { identity, account } = actor
      const resident = account.role === 'resident', profile = resident ? await store.get('residents/' + identity.localId) : null
      const role = resident ? profile?.residencyStatus === 'temporary' ? 'Temporary Resident' : 'Permanent Resident' : account.role === 'admin' ? 'Admin' : 'Staff'
      const id = extra.operationId ? 'auth_' + await sha256(identity.localId + ':' + event + ':' + extra.operationId) : crypto.randomUUID()
      const path = 'loginHistory/' + id
      if (await store.get(path)) return
      const result = await store.commit([store.write(path, { actorUid: identity.localId, accountType: resident ? 'resident' : 'staff', accountRole: role,
        event, ipAddress: ctx.ip, legacyId: null }, { exists: false, serverTimes: ['at'] })])
      if (result.status !== 200 && result.status !== 409) throw new HttpError('The system is temporarily unavailable. Please try again in a few minutes.', 503)
    },
  }
  return ctx
}
