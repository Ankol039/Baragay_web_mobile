import { accountTransaction, accountId, operationId, hash, phpJson, bounds, apiError, write, filterQuery, admin } from './accounts-store.mjs'

const result = (message = '', data = [], extra = {}) => ({ ok: true, data, message, ...extra })
const rows = async (ctx, collectionId, filters = [], limit = 0, parent = '') => (await ctx.store.query({ parent, collectionId,
  where: filters.map(([field, value]) => ({ field, op: 'EQUAL', value })), ...(limit ? { limit } : {}) })).map(row => ({ id: row.id, ...row.data }))

async function purge(ctx, op, path, actorUid) {
  const id = op.targetUid
  const disabled = await ctx.authAdmin('accounts:update', { localId: id, disableUser: true, validSince: String(Math.floor(Date.now() / 1000)) })
  if (disabled.status !== 200 && disabled.body?.error?.message !== 'USER_NOT_FOUND') throw new Error('Account disable unavailable')
  let done = false
  for (let round = 0; round < 200; round++) {
    done = await accountTransaction(ctx, actorUid, async (tx, actor) => {
      admin(actor)
      const fresh = await ctx.store.get(path, tx)
      if (fresh?.state === 'complete') return [[], true]
      const lock = await ctx.store.get(`accountLocks/${id}`, tx)
      if (lock?.operationPath !== path) apiError('The request could not be completed. Please try again.', 409)
      const writes = [], parent = `${op.kind === 'resident' ? 'residents' : 'staff'}/${id}`
      if (op.kind === 'resident') {
        for (const collection of ['children', 'characterReferences']) {
          for (const child of await rows(ctx, collection, [], 350, parent)) writes.push(ctx.store.remove(`${parent}/${collection}/${child.id}`))
        }
        for (const response of await rows(ctx, 'responses', [['residentUid', id]], 100)) {
          const answers = await rows(ctx, 'answers', [], 350, `responses/${response.id}`)
          for (const answer of answers) writes.push(ctx.store.remove(`responses/${response.id}/answers/${answer.id}`))
          if (answers.length < 350) writes.push(ctx.store.remove(`responses/${response.id}`))
          if (writes.length >= 350) break
        }
        for (const request of await rows(ctx, 'familyRequests', [['ownerUid', id]], 50)) {
          const leaves = []
          for (const collection of ['children', 'characterReferences']) {
            for (const person of await rows(ctx, collection, [], 350, `familyRequests/${request.id}`)) leaves.push(ctx.store.remove(`familyRequests/${request.id}/${collection}/${person.id}`))
          }
          writes.push(...leaves)
          if (!leaves.length) writes.push(ctx.store.remove(`familyRequests/${request.id}`))
          if (writes.length >= 350) break
        }
      }
      for (const alias of await rows(ctx, 'identifierAliases', [['uid', id]], 350)) writes.push(ctx.store.remove(`identifierAliases/${alias.id}`))
      if (writes.length) return [writes.slice(0, 350), false]
      return [[], true]
    })
    if (done) break
  }
  if (!done) apiError('The request could not be completed. Please try again.', 409)
  const removed = await ctx.authAdmin('accounts:delete', { localId: id })
  if (removed.status !== 200 && removed.body?.error?.message !== 'USER_NOT_FOUND') throw new Error('Account removal unavailable')
  return accountTransaction(ctx, actorUid, async (tx, actor) => {
    admin(actor)
    const fresh = await ctx.store.get(path, tx)
    if (fresh?.state === 'complete') return [[], fresh.result]
    const lock = await ctx.store.get(`accountLocks/${id}`, tx)
    if (lock?.operationPath !== path) apiError('The request could not be completed. Please try again.', 409)
    const writes = []
    for (const collection of ['users', 'residents', 'staff', 'profileImages', 'accountLocks']) writes.push(ctx.store.remove(`${collection}/${id}`))
    for (const kind of ['nameAddress', 'family', 'staff', 'deletion']) writes.push(ctx.store.remove(`pendingRequests/${id}_${kind}`))
    writes.push(write(ctx, path, { state: 'complete' }, true, ['updatedAt']))
    return [writes, op.result]
  })
}

export async function lifecycle(ctx, action, input, actorUid) {
  const operation = operationId(input), path = `accountOperations/${await hash(`${actorUid}:${operation}`)}`
  const binding = { ...input }
  delete binding.idToken
  const fingerprint = await hash(phpJson([action, binding]))
  const op = await accountTransaction(ctx, actorUid, async (tx, actor) => {
    const old = await ctx.store.get(path, tx)
    if (old) {
      if ((old.fingerprint ?? '') !== fingerprint) apiError('Invalid request.')
      return [[], old]
    }
    const adminActor = actor.role === 'admin', requestId = input.requestId ?? null
    const request = requestId ? await ctx.store.get(`deletionRequests/${accountId(requestId)}`, tx) : null
    if (action === 'approveDeletion' && (!request || request.status !== 'pending')) apiError('That request was not found, or it has already been reviewed.')
    const id = accountId(request ? request.ownerUid : (input.targetUid ?? input.id ?? ''))
    if (await ctx.store.get(`accountLocks/${id}`, tx)) apiError('The request could not be completed. Please try again.', 409)
    const user = await ctx.store.get(`users/${id}`, tx), isStaffTarget = input.kind === 'staff' && !request
    if ((isStaffTarget || ['archive', 'restore', 'purge', 'approveDeletion'].includes(action)) && !adminActor) {
      const message = action === 'approveDeletion'
        ? 'Only an administrator can approve or reject a deletion request.'
        : isStaffTarget
          ? action === 'toggle' ? 'Only administrators can deactivate staff accounts.' : 'Only administrators can delete a staff account.'
          : action === 'archive'
            ? 'Only an administrator can delete a resident record. Use Request Deletion instead, or deactivate the account to block access without losing their survey history.'
            : 'Access denied.'
      apiError(message, 403)
    }
    if (id === actorUid && isStaffTarget) {
      apiError(({ toggle: 'You cannot deactivate your own account while logged in.', archive: 'You cannot delete the account you are signed in with.',
        purge: 'You cannot permanently delete the account you are signed in with.' })[action] ?? 'Access denied.')
    }
    if (!user || ((user.role !== 'resident') !== isStaffTarget)) {
      if (['restore', 'purge'].includes(action)) {
        const empty = { fingerprint, state: 'complete', result: result(action === 'restore'
          ? 'That account was not found in the archive, or it has already been restored.' : 'That account was not found in the archive.') }
        return [[write(ctx, path, empty, false, ['createdAt', 'updatedAt'])], empty]
      }
      apiError(isStaffTarget ? 'That staff account could not be found.' : 'Resident could not be found.')
    }
    const deleted = user.deletedAt != null
    if (['restore', 'purge'].includes(action) && !deleted) {
      const empty = { fingerprint, state: 'complete', result: result(action === 'restore'
        ? 'That account was not found in the archive, or it has already been restored.' : 'That account was not found in the archive.') }
      return [[write(ctx, path, empty, false, ['createdAt', 'updatedAt'])], empty]
    }
    if (!['restore', 'purge'].includes(action) && deleted) apiError(isStaffTarget ? 'That staff account could not be found.' : 'Resident could not be found.')
    if (isStaffTarget && user.role === 'admin' && (action === 'archive' || (action === 'toggle' && user.isActive))) {
      const admins = await filterQuery(ctx, '', 'users', { role: 'admin' }, tx)
      const others = admins.filter(candidate => candidate.uid !== id && candidate.isActive && candidate.deletedAt == null)
      if (!others.length) apiError('This is the only administrator account left. Promote or create another administrator before deleting this one.')
    }
    if (user.role === 'resident' && ['archive', 'approveDeletion', 'restore'].includes(action)) {
      if ((await filterQuery(ctx, '', 'deletionRequests', { ownerUid: id }, tx)).length > 490) apiError('The request could not be completed. Please try again.')
    }
    if (action === 'restore' && user.role === 'resident') {
      for (const item of await filterQuery(ctx, '', 'deletionRequests', { ownerUid: id }, tx)) {
        if (item.status === 'approved' && !String(item.reviewComment ?? '').includes('[Account later restored.]')) {
          bounds({ reviewComment: `${String(item.reviewComment ?? '').trim()} [Account later restored.]` })
        }
      }
    }
    const active = action === 'toggle' ? !user.isActive : user.isActive
    const next = { isActive: active }
    let message = ''
    if (action === 'toggle') message = isStaffTarget
      ? active ? 'Staff account reactivated.' : 'Staff account deactivated.'
      : active ? 'Resident account reactivated.' : 'Resident account deactivated. Their survey history has been kept.'
    if (['archive', 'approveDeletion'].includes(action)) {
      next.deletedAt = new Date()
      next.deletedByUid = actorUid
      next.deletedByName = actor.displayName
      next.deleteReason = action === 'approveDeletion' ? `Deletion request approved: ${request.ownerDisplayName}`
        : isStaffTarget ? 'Deleted from User Management.' : 'Deleted from the Residents page.'
      message = action === 'approveDeletion'
        ? `Request approved. ${request.ownerDisplayName} was moved to Deleted Accounts and can be restored from there.`
        : isStaffTarget ? `${user.displayName} was moved to Deleted Accounts. You can restore the account from there.`
          : 'Resident moved to Deleted Accounts. Their survey responses were kept, and you can restore the account from there.'
    }
    if (action === 'restore') {
      Object.assign(next, { deletedAt: null, deletedByUid: null, deletedByName: '', deleteReason: '' })
      message = 'Account restored. It can sign in again and its records are back in the lists.'
    }
    if (action === 'purge') message = 'Account permanently deleted. This one cannot be undone.'
    const comment = profileComment(input)
    const operationRecord = { fingerprint, state: 'pending', targetUid: id, kind: isStaffTarget ? 'staff' : 'resident', action,
      next, requestId, reviewComment: comment, actorName: actor.displayName, result: result(message) }
    return [[write(ctx, path, operationRecord, false, ['createdAt', 'updatedAt']),
      write(ctx, `accountLocks/${id}`, { operationPath: path }), write(ctx, `users/${id}`, { isActive: false }, true, ['updatedAt'])], operationRecord]
  })
  if (op.state === 'complete') return op.result
  const id = op.targetUid
  if (action === 'purge') return purge(ctx, op, path, actorUid)
  const isDisabled = !op.next.isActive || op.next.deletedAt != null
  const authResult = await ctx.authAdmin('accounts:update', { localId: id, disableUser: isDisabled,
    validSince: String(Math.floor(Date.now() / 1000)) })
  if (authResult.status !== 200) throw new Error('Account status unavailable')
  return accountTransaction(ctx, actorUid, async (tx, actor) => {
    const fresh = await ctx.store.get(path, tx)
    if (fresh?.state === 'complete') return [[], fresh.result]
    if (op.kind === 'staff' || op.action !== 'toggle') admin(actor)
    const lock = await ctx.store.get(`accountLocks/${id}`, tx)
    if (lock?.operationPath !== path) apiError('The request could not be completed. Please try again.', 409)
    const writes = [write(ctx, `users/${id}`, op.next, true, ['updatedAt']), write(ctx, path, { state: 'complete' }, true, ['updatedAt']), ctx.store.remove(`accountLocks/${id}`)]
    if (op.kind === 'resident') {
      for (const request of await filterQuery(ctx, '', 'deletionRequests', { ownerUid: id }, tx)) {
        if (['archive', 'approveDeletion'].includes(op.action) && request.status === 'pending') {
          writes.push(write(ctx, `deletionRequests/${request.id}`, { status: 'approved', reviewedByUid: actorUid,
            reviewedByName: actor.displayName, reviewComment: request.id === op.requestId ? op.reviewComment
              : op.action === 'archive' ? 'Deleted directly by an administrator.' : 'Resolved by another request for the same resident.' }, true, ['reviewedAt']))
        }
        if (op.action === 'restore' && request.status === 'approved' && !String(request.reviewComment ?? '').includes('[Account later restored.]')) {
          writes.push(write(ctx, `deletionRequests/${request.id}`, { reviewComment: `${String(request.reviewComment ?? '').trim()} [Account later restored.]` }, true))
        }
      }
      if (['archive', 'approveDeletion'].includes(op.action)) {
        const slot = `pendingRequests/${id}_deletion`
        if (await ctx.store.get(slot, tx)) writes.push(ctx.store.remove(slot))
      }
    }
    return [writes, op.result]
  })
}

function profileComment(input) {
  const value = input.review_comment ?? ''
  if (typeof value !== 'string') apiError('Invalid request field: review_comment.')
  return value.trim()
}
