import test from 'node:test'
import assert from 'node:assert/strict'
import { allowRequest, privateIPv4 } from '../scripts/gateway-policy.mjs'
const project = 'existing-project', db = `projects/${project}/databases/(default)`
const allow = (kind, method, url, headers = {}, body = '') => allowRequest(kind, method, url, headers, body, project)
test('LAN binds require a specific RFC1918 IPv4 interface', () => {
  for (const host of ['10.0.0.3', '172.16.0.1', '172.31.255.254', '192.168.1.3']) assert.equal(privateIPv4(host), true)
  for (const host of ['0.0.0.0', '127.0.0.1', '172.15.0.1', '172.32.0.1', '8.8.8.8', '::', 'localhost']) assert.equal(privateIPv4(host), false)
})
test('only resident API and normal SDK auth operations pass', () => {
  for (const path of ['index.php?action=rules', 'accounts.php', 'resident-read.php', 'resident-profile.php', 'survey-schema.php']) assert(allow('api', 'POST', `/api/firebase/${path}`))
  for (const path of ['/api/firebase/staff-surveys.php', '/api/firebase/accounts-core.php', '/config/functions.php', '/api/firebase/%2e%2e%2fprivate.php']) assert.equal(allow('api', 'GET', path), false)
  for (const action of ['signInWithPassword', 'lookup']) assert(allow('auth', 'POST', `/identitytoolkit.googleapis.com/v1/accounts:${action}?key=emulator-only`))
  assert(allow('auth', 'POST', '/securetoken.googleapis.com/v1/token?key=emulator-only'))
  for (const path of ['/emulator/v1/projects/test/accounts', '/identitytoolkit.googleapis.com/v1/projects/test/accounts', '/identitytoolkit.googleapis.com/v1/accounts:signUp', '/identitytoolkit.googleapis.com/v1/accounts:delete']) assert.equal(allow('auth', 'POST', path), false)
})
test('Firestore Listen and transaction REST are pinned to the existing project', () => {
  for (const mode of ['Listen']) {
    assert(allow('firestore', 'POST', `/google.firestore.v1.Firestore/${mode}/channel?database=${encodeURIComponent(db)}`))
    assert.equal(allow('firestore', 'POST', `/google.firestore.v1.Firestore/${mode}/channel?database=projects/other/databases/(default)`), false)
  }
  for (const path of ['', '/users/me', ':batchGet', ':commit', ':runQuery']) assert(allow('firestore', 'POST', `/v1/${db}/documents${path}`))
  for (const path of [`/v1/projects/other/databases/(default)/documents/users/me`, `/emulator/v1/projects/${project}:securityRules`, `/v1/${db}/documents:bulkDelete`, `/v1/${db}/documents/../private`]) assert.equal(allow('firestore', 'POST', path), false)
  assert.equal(allow('firestore', 'POST', `/google.firestore.v1.Firestore/Write/channel?database=${encodeURIComponent(db)}`), false)
  assert.equal(allowRequest('firestore', 'GET', `/v1/${db}/documents/users/me`), false)
})
test('owner credentials are rejected in headers and encoded WebChannel overrides', () => {
  const path = `/google.firestore.v1.Firestore/Listen/channel?database=${encodeURIComponent(db)}`
  for (const headers of [{ authorization: 'Bearer owner' }, { Authorization: 'bEaReR OWNER' }, { 'X-HTTP-Headers': 'Authorization: Bearer owner' }]) assert.equal(allow('firestore', 'POST', path, headers), false)
  for (const value of ['Authorization: Bearer owner', 'Authorization: Bearer%20owner', 'Authorization: Bearer%2520owner', 'Authorization: Bearer \r\nowner']) assert.equal(allow('firestore', 'POST', `${path}&$httpHeaders=${encodeURIComponent(value)}`), false)
  assert.equal(allow('firestore', 'POST', path, {}, String.raw`headers=Authorization%3ABearer%20\u006fwner`), false)
  assert(allow('firestore', 'POST', path, { authorization: 'Bearer normal-user-jwt' }, 'Owner feedback text'))
  for (const method of ['DELETE', 'PUT', 'PATCH', 'TRACE']) assert.equal(allow('firestore', method, path), false)
})
