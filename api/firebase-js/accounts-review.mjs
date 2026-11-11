import { once, apiError, accountStrings, accountId, unlocked, write, query, peopleWrites } from './accounts-store.mjs'
import { buildFullName } from './policy.mjs'
import { lifecycle } from './accounts-lifecycle.mjs'

const collections = { resident: 'nameAddressRequests', staff: 'staffRequests', family: 'familyRequests', deletion: 'deletionRequests' }
const output = (message = '', data = [], extra = {}) => ({ ok: true, data, message, ...extra })

function fullName(profile) {
  return buildFullName(profile.name?.firstName, profile.name?.middleName, profile.name?.lastName, profile.name?.nameExtension)
}

export async function reviewRequest(ctx, input, actorUid) {
  const kind = input.kind, collection = collections[kind]
  if (!collection) apiError('Invalid request.')
  const id = accountId(input.request_id ?? ''), decision = input.decision
  if (!['approve', 'reject'].includes(decision)) apiError('Invalid review action.')
  if (kind === 'deletion' && decision === 'approve') return lifecycle(ctx, 'approveDeletion', { ...input, requestId: id }, actorUid)
  return once(ctx, actorUid, input, async (tx, actor) => {
    if (['staff', 'deletion'].includes(kind) && actor.role !== 'admin') {
      apiError(kind === 'staff' ? 'Only an administrator can review staff address changes.' : 'Only an administrator can approve or reject a deletion request.', 403)
    }
    const request = await ctx.store.get(`${collection}/${id}`, tx)
    const missing = { resident: 'Request not found or already processed.', staff: 'That staff request was not found, or it has already been reviewed.',
      family: 'That request has already been decided.', deletion: 'That request was not found, or it has already been reviewed.' }
    if (!request || request.status !== 'pending') apiError(missing[kind])
    const ownerUid = request.ownerUid
    await unlocked(ctx, ownerUid, tx)
    const user = await ctx.store.get(`users/${ownerUid}`, tx)
    const ownerPath = `${kind === 'staff' ? 'staff' : 'residents'}/${ownerUid}`
    const profile = await ctx.store.get(ownerPath, tx)
    if (!user || !profile) apiError('That request could not be applied. Nothing was changed.')
    const comment = accountStrings(input, ['review_comment']).review_comment
    if (decision === 'reject' && ['staff', 'deletion'].includes(kind) && !comment) apiError('Give a short reason when rejecting a request.')
    if (kind === 'family' && (!request.proposed || typeof request.proposed !== 'object' || Array.isArray(request.proposed))) apiError('That request could not be read and was left pending.')

    const writes = []
    if (decision === 'approve') {
      const next = {}, proposed = request.proposed || {}
      if (kind === 'resident') {
        for (const key of ['permanentAddress', 'temporaryAddress']) if (proposed[key]?.householdNumber) next[key] = proposed[key]
        if (proposed.name?.firstName || proposed.name?.lastName) {
          next.name = { ...proposed.name, gender: profile.name.gender }
          writes.push(write(ctx, `users/${ownerUid}`, { displayName: fullName(next) }, true, ['updatedAt']))
        }
        if (proposed.birthdate) next.birthdate = proposed.birthdate instanceof Date ? proposed.birthdate : new Date(proposed.birthdate)
      } else if (kind === 'staff') next.address = proposed
      else if (kind === 'family') {
        next.household = proposed
        const groups = {}
        for (const [key, path] of [['children', 'children'], ['characterReferences', 'characterReferences']]) {
          const people = await query(ctx, `${collection}/${id}`, path, tx)
          people.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
          groups[key] = people.map(person => person.person)
        }
        writes.push(...await peopleWrites(ctx, ownerPath, groups, tx))
      }
      if (Object.keys(next).length) writes.push(write(ctx, ownerPath, next, true, ['updatedAt']))
    }
    const status = decision === 'approve' ? 'approved' : 'rejected'
    writes.push(write(ctx, `${collection}/${id}`, { status, reviewedByUid: actorUid, reviewedByName: actor.displayName,
      reviewComment: comment }, true, ['reviewedAt']))
    const slotKind = { resident: 'nameAddress', staff: 'staff', family: 'family', deletion: 'deletion' }[kind]
    const pointer = await ctx.store.get(`pendingRequests/${ownerUid}_${slotKind}`, tx)
    if (pointer?.requestId === id) writes.push(ctx.store.remove(`pendingRequests/${ownerUid}_${slotKind}`))

    let message = `Request has been ${status}.`
    if (kind === 'staff') message = `Staff address request has been ${status}.`
    if (kind === 'family') message = decision === 'approve' ? "Family details updated from the resident's request." : 'Family details request rejected. Nothing on the record changed.'
    if (kind === 'deletion') message = 'Request rejected. The record was left untouched.'
    return [writes, output(message, [], { ui: { show_success: kind !== 'family' } })]
  })
}
