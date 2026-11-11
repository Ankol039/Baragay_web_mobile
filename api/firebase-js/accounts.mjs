import { HttpError } from './core/errors.mjs'
import { today } from './policy.mjs'
import { accountFields, readAccounts } from './accounts-data.mjs'
import { provision, reset } from './accounts-provision.mjs'
import { mutateResident } from './accounts-residents.mjs'
import { reviewRequest } from './accounts-review.mjs'
import { lifecycle } from './accounts-lifecycle.mjs'
import { staffProfile } from './accounts-profile.mjs'

const fail = (message, status = 400) => { throw new HttpError(message, status) }

function requestError(ctx, input) {
  if (ctx.request.method !== 'POST') fail('Method not allowed.', 405)
  if ((ctx.request.headers.get('content-type') || '').split(';', 1)[0].toLowerCase() !== 'application/json') fail('Unsupported request content type.', 415)
  if (ctx.bodySize > 524288) fail('Invalid request.', 413)
  if (!input || Array.isArray(input) || typeof input !== 'object' || typeof input.action !== 'string') fail('Invalid JSON request.', 400)
}

export async function handleAccounts(ctx, action, input) {
  requestError(ctx, input)
  if (action !== input.action) fail('Not found.', 404)
  if (action === 'registrationFields') return { ok: true, data: { today: today(), fields: accountFields() } }
  if (action === 'registerResident') return provision(ctx, input, null, 'resident', true)

  const { identity } = await ctx.actor({ ready: false })
  const actorUid = identity.localId
  if (action === 'createResident') return provision(ctx, input, actorUid, 'resident', false)
  if (action === 'createStaff') return provision(ctx, input, actorUid, 'staff', false)
  if (action === 'resetResident') return reset(ctx, input, actorUid, 'resident')
  if (action === 'resetStaff') return reset(ctx, input, actorUid, 'staff')
  if (['residents', 'users', 'resident', 'requests', 'deletions', 'archives', 'residencyRecords'].includes(action)) {
    const data = await readAccounts(ctx, action, input, identity)
    return { ok: true, data }
  }
  if (['updateResident', 'requestDeletion', 'promote', 'revert'].includes(action)) return mutateResident(ctx, action, input, actorUid)
  if (['toggle', 'archive', 'restore', 'purge'].includes(action)) return lifecycle(ctx, action, input, actorUid)
  if (action === 'review') return reviewRequest(ctx, input, actorUid)
  if (['staffProfile', 'staffSave', 'staffPhoto', 'staffRemovePhoto'].includes(action)) return staffProfile(ctx, action, input, actorUid)
  fail('Not found.', 404)
}
