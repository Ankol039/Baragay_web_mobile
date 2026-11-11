import assert from 'node:assert/strict'
import test from 'node:test'
import detectAccountType from '../src/utils/detectAccountType.js'
import { authDestination } from '../src/routes/authRedirect.js'

const cases = [
  ['R-2026-0001', 'resident', 'R-2026-0001'],
  ['r-2026-0001', 'resident', 'R-2026-0001'],
  [' R-2026-0001 ', 'resident', 'R-2026-0001'],
  ['S-2026-0001', 'staff', 'S-2026-0001'],
  [' s-2026-0001 ', 'staff', 'S-2026-0001'],
  ['admin', 'username', 'admin'],
  ['Admin', 'username', 'Admin'],
  [' staff.nurse ', 'username', 'staff.nurse'],
  ['R-2026-001', 'username', 'R-2026-001'],
  ['S-2026-001', 'username', 'S-2026-001'],
  ['R-2026-00001', 'username', 'R-2026-00001'],
  ['R-2026-0001-extra', 'username', 'R-2026-0001-extra'],
  ['R-２０２６-0001', 'username', 'R-２０２６-0001'],
  ['', 'username', ''],
]

for (const [input, type, identifier] of cases) {
  test(`detect and normalise ${JSON.stringify(input)}`, () => {
    assert.deepEqual(detectAccountType(input), { type, identifier })
  })
}

test('dashboard and onboarding destinations still use the server identity', () => {
  for (const account_type of ['resident', 'staff']) {
    for (const role of account_type === 'resident' ? ['resident'] : ['staff', 'admin']) {
      const user = { account_type, role, is_first_login: false, profile_completed: true }
      assert.equal(authDestination(user), `/${account_type}/dashboard`)
      assert.equal(authDestination({ ...user, is_first_login: true }), `/${account_type}/change-password`)
      if (account_type === 'staff') {
        assert.equal(authDestination({ ...user, profile_completed: false }), '/staff/complete-profile')
        assert.equal(authDestination({ ...user, is_first_login: true, profile_completed: false }), '/staff/change-password')
      }
    }
  }
})
