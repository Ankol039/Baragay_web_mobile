// DATE fields are UTC midnight calendar values; event instants display in Manila.
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const asDate = value => value?.toDate ? value.toDate() : new Date(value)
export const dateKey = value => value ? asDate(value).toISOString().slice(0, 10) : ''
export const manilaDate = (now = new Date()) => new Date(now.getTime() + 8 * 3600000)
export const todayKey = (now = new Date()) => dateKey(manilaDate(now))
export function eventValue(value) {
  return manilaDate(asDate(value)).toISOString().slice(0, 19).replace('T', ' ')
}
export function dateLabel(value, { event = false, padded = false, full = false, time = false } = {}) {
  const date = event ? manilaDate(asDate(value)) : asDate(value)
  const day = date.getUTCDate(), hour = date.getUTCHours()
  return `${(full ? fullMonths : months)[date.getUTCMonth()]} ${padded ? String(day).padStart(2, '0') : day}, ${date.getUTCFullYear()}`
    + (time ? ` ${padded ? String(hour % 12 || 12).padStart(2, '0') : hour % 12 || 12}:${String(date.getUTCMinutes()).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}` : '')
}
export function residencyMonths(start, today) {
  if (!start || start > today) return 0
  const a = asDate(start), b = asDate(today)
  // PHP DateTime::diff borrows days from the month preceding the end date.
  let days = b.getUTCDate() - a.getUTCDate(), count = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth()
  let month = b.getUTCMonth()
  while (days < 0) { days += new Date(Date.UTC(b.getUTCFullYear(), month--, 0)).getUTCDate(); count-- }
  return Math.max(0, count)
}
export function activityMonths(responses, now) {
  const today = asDate(todayKey(now)), year = today.getUTCFullYear(), month = today.getUTCMonth(), day = today.getUTCDate()
  // MySQL DATE_SUB clamps to month-end. PHP strtotime month labels overflow.
  const lastDay = new Date(Date.UTC(year, month - 4, 0)).getUTCDate()
  const cutoff = dateKey(new Date(Date.UTC(year, month - 5, Math.min(day, lastDay))))
  const counts = new Map()
  for (const row of responses) {
    const local = eventValue(row.submittedAt)
    if (local.slice(0, 10) >= cutoff) counts.set(local.slice(0, 7), (counts.get(local.slice(0, 7)) || 0) + 1)
  }
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 5 + index, day)), key = dateKey(date).slice(0, 7)
    return { label: `${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`, value: counts.get(key) || 0 }
  })
}
