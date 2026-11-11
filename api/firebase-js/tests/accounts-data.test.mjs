import test from 'node:test'
import assert from 'node:assert/strict'
import { readAccounts } from '../accounts-data.mjs'

test('address request listing batches owner profiles instead of spending one request per history row', async () => {
  const requests = Array.from({ length: 100 }, (_, index) => ({
    id: `legacy-${index}`,
    status: index === 0 ? 'pending' : 'approved',
    ownerUid: index === 0 ? 'demo-owner' : null,
    ownerDisplayName: '',
    ownerIdentifier: '',
    requestedAt: new Date(Date.UTC(2026, 0, 1 + index)),
    proposed: { name: { firstName: 'Demo', lastName: 'Resident' }, permanentAddress: { displayLine: 'Demo Address' } },
  }))
  const actor = { uid: 'demo-admin', role: 'admin', isActive: true, isFirstLogin: false, profileCompleted: true, deletedAt: null }
  const calls = { get: [], batchGet: [], query: 0, begin: 0, rollback: 0 }
  const profile = { name: { firstName: 'Demo', lastName: 'Resident' } }
  const ctx = { store: {
    async begin() { calls.begin++; return 'tx' },
    async rollback() { calls.rollback++ },
    async get(path) { calls.get.push(path); return path === 'users/demo-admin' ? actor : null },
    async query(spec) {
      calls.query++
      if (spec.collectionId === 'nameAddressRequests') return requests.map(row => ({ id: row.id, data: { ...row } }))
      return []
    },
    async batchGet(paths) {
      calls.batchGet.push(paths)
      return new Map(paths.map(path => [path, path === 'residents/demo-owner' ? profile : null]))
    },
  } }

  const result = await readAccounts(ctx, 'requests', {}, { localId: 'demo-admin' })

  assert.equal(result.is_admin, true)
  assert.equal(result.resident.length, 1, 'ownerless history stays hidden, matching the original resident join')
  assert.equal(result.resident[0].name, 'Demo Resident')
  assert.deepEqual(calls.batchGet, [['residents/demo-owner']])
  assert.equal(calls.get.filter(path => path.startsWith('residents/')).length, 0)
  const totalFirestoreCalls = calls.begin + calls.rollback + calls.query + calls.batchGet.length + calls.get.length
  assert.ok(totalFirestoreCalls < 50, `one address queue load should stay below the Workers Free subrequest cap (saw ${totalFirestoreCalls})`)
})
