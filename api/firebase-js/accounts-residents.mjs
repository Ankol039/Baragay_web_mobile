import { unlocked, once, apiError, accountStrings, filterQuery, write, randomId, peopleWrites } from './accounts-store.mjs'
import { residentValues } from './accounts-validation.mjs'
import { buildFullName, residencyDuration, formatResidencyDuration, permanentResidencyMinMonths, residenceTypes } from './policy.mjs'
import { loadResidentForUpdate } from './accounts-data.mjs'

const result = (message = '', data = [], extra = {}) => ({ ok: true, data, message, ...extra })
const fullName = profile => buildFullName(profile.name.firstName, profile.name.middleName, profile.name.lastName, profile.name.nameExtension)
const filtered = (ctx, collection, filters, tx) => filterQuery(ctx, '', collection, filters, tx)

async function mutateResident(ctx, action, input, actorUid) {
  const id = String(input.resident_id ?? '')
  return once(ctx, actorUid, input, async (tx, actor) => {
    await unlocked(ctx, id, tx)
    const { user, profile } = await loadResidentForUpdate(ctx, id, tx)
    if (action === 'updateResident') {
      const values = input.values && typeof input.values === 'object' && !Array.isArray(input.values) ? { ...input.values } : {}
      delete values.resident_id
      values.residency_status = profile.residencyStatus
      const [next, people] = residentValues(values, profile)
      delete next.lastResidencyRecordId
      return [[write(ctx, `residents/${id}`, next, true, ['updatedAt']),
        write(ctx, `users/${id}`, { displayName: fullName(next) }, true, ['updatedAt']),
        ...await peopleWrites(ctx, `residents/${id}`, people, tx)], result('Resident updated successfully.')]
    }
    if (action === 'requestDeletion') {
      const reason = accountStrings(input, ['reason']).reason
      if (!reason) apiError('Give a reason so the administrator can act on the request.')
      const pending = await filtered(ctx, 'deletionRequests', { ownerUid: id, status: 'pending' }, tx)
      if (pending.length) return [[], result('A deletion request for this resident is already waiting for the administrator.')]
      const name = `${profile.name.firstName} ${profile.name.lastName}`.trim(), requestId = randomId()
      const request = { kind: 'deletion', ownerUid: id, ownerIdentifier: user.identifier, ownerDisplayName: name,
        requestedByUid: actorUid, requestedByName: actor.displayName, reason,
        proposed: { residentNumber: user.identifier, residentName: name }, previousAddress: '', firstReferenceId: null,
        status: 'pending', reviewedAt: null, reviewedByUid: null, reviewedByName: '', reviewComment: '', legacyId: null }
      return [[write(ctx, `deletionRequests/${requestId}`, request, false, ['requestedAt'])],
        result(`Deletion request sent to the administrator for ${name}. The account is untouched until they decide.`)]
    }
    const isAdmin = actor.role === 'admin'
    if (!isAdmin) apiError('Access denied.', 403)
    const reason = accountStrings(input, ['reason']).reason
    let promotion = null
    const logs = await filtered(ctx, 'residencyRecords', { residentUid: id }, tx)
    logs.sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt) || String(b.id).localeCompare(String(a.id)))
    promotion = logs.find(log => log.toStatus === 'permanent' && !log.isReverted) ?? null
    const name = `${profile.name.firstName} ${profile.name.lastName}`.trim()
    let next, message
    const writes = []
    if (action === 'promote') {
      const duration = residencyDuration(profile.residencyStartDate)
      if (profile.residencyStatus !== 'temporary') apiError('That resident is already permanent.')
      if (!profile.temporaryAddress?.householdNumber && !profile.temporaryAddress?.displayLine) apiError('This resident has no temporary address on file, so there is nothing to promote. Edit their record first.')
      if (!duration) apiError('Set a valid "Residing Here Since" date on this resident before making them permanent.')
      if (duration.total_months < permanentResidencyMinMonths()) apiError(`This resident has stayed only ${formatResidencyDuration(duration)}. They must reach ${permanentResidencyMinMonths()} months before being made permanent.`)
      next = { residencyStatus: 'permanent', permanentAddress: profile.temporaryAddress, temporaryAddress: null, residenceType: '' }
      message = `${name} is now a permanent resident. Their previous address is kept in Residency Records.`
    } else {
      if (profile.residencyStatus !== 'permanent') apiError('That resident is already temporary.')
      if (!reason) apiError('Give a reason before reverting someone to temporary. It is kept on the record.')
      const residenceType = promotion && Object.hasOwn(residenceTypes(), promotion.previousResidenceType ?? '') ? promotion.previousResidenceType : ''
      next = { residencyStatus: 'temporary', permanentAddress: promotion ? promotion.previousPermanentAddress : profile.permanentAddress,
        temporaryAddress: profile.permanentAddress, residenceType }
      if (promotion) writes.push(write(ctx, `residencyRecords/${promotion.id}`, { isReverted: true }, true))
      message = `${name} has been returned to temporary resident status.${!residenceType ? ' Open their record and set the Type of Temporary Residence.' : ''}${!promotion ? ' No archived address existed, so their address on file became the temporary one - enter their permanent address next.' : ''}`
    }
    const logId = randomId(), log = { residentUid: id, fromStatus: profile.residencyStatus, toStatus: next.residencyStatus,
      reason, changedByUid: actorUid, changedByName: actor.displayName, previousPermanentAddress: profile.permanentAddress,
      previousTemporaryAddress: profile.temporaryAddress, previousResidenceType: profile.residenceType, isReverted: false, legacyId: null }
    next.lastResidencyRecordId = logId
    writes.push(write(ctx, `residencyRecords/${logId}`, log, false, ['changedAt']), write(ctx, `residents/${id}`, next, true, ['updatedAt']))
    return [writes, result(message)]
  })
}

export { mutateResident }
