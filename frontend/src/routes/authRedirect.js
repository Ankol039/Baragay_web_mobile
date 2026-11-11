export function authDestination(user) {
  if (!user) return '/login'
  if (user.is_first_login) return `/${user.account_type}/change-password`
  if (user.account_type === 'staff' && !user.profile_completed) return '/staff/complete-profile'
  return `/${user.account_type}/dashboard`
}

export function protectedDestination(user, portal, path) {
  if (!user) return '/landing' // Anonymous folder login stubs end here.
  if (user.account_type !== portal) return authDestination(user) // index.php detects the existing identity.
  if (portal === 'resident') {
    return user.is_first_login && path !== '/resident/change-password' ? '/resident/change-password' : null
  }
  // These two filenames and logout are exempt in require_staff_onboarding().
  if (['/staff/change-password', '/staff/complete-profile', '/staff/logout'].includes(path)) return null
  const next = authDestination(user)
  return next === '/staff/dashboard' ? null : next
}
