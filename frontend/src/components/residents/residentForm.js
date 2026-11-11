import { editableFamily, emptyPerson } from '../../config/personFields.js'

export function emptyResident(fields) {
  const result = { first_name: '', middle_name: '', last_name: '', name_extension: '', courtesy_title: '', courtesy_title_other: '',
    email: '', contact_number: '', gender: '', residency_status: 'permanent', residency_start_date: '', birthdate: '', birthplace: '',
    special_category: 'none', category_reference: '', residence_type: '', occupation: '', hotline_number: '', is_married: '0', has_children: '0',
    children: [emptyPerson(fields.person)], references: [emptyPerson(fields.person)] }
  for (const key of Object.keys(fields.address)) { result[key] = ''; result[`temp_${key}`] = '' }
  for (const who of ['spouse', 'father', 'mother']) for (const key of Object.keys(fields.person).concat('courtesy_title_other')) result[`${who}_${key}`] = ''
  return result
}
export function ageLabel(value, now = new Date()) {
  if (!value) return ''
  const [year, month, day] = value.split('-').map(Number)
  const born = new Date(year, month - 1, day)
  if (Number.isNaN(born.getTime())) return ''
  if (born > now) return 'Invalid birthdate'
  let age = now.getFullYear() - born.getFullYear()
  if (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) age--
  return age === 1 ? '1 year old' : `${age} years old`
}
// Mirrors the page's inline browser hint (server duration/eligibility remains authoritative).
export function residencyHint(value, status, minimum, now = new Date()) {
  if (!value) return { text: `Permanent status requires at least ${minimum} months of residence.`, validity: '' }
  const start = new Date(value + 'T00:00:00'), today = new Date(now)
  today.setHours(0, 0, 0, 0)
  if (Number.isNaN(start.getTime()) || start > today) return { text: 'Pick a date that is not in the future.', validity: 'The residency start date cannot be in the future.' }
  let years = today.getFullYear() - start.getFullYear(), months = today.getMonth() - start.getMonth(), days = today.getDate() - start.getDate()
  if (days < 0) { months--; days += new Date(today.getFullYear(), today.getMonth(), 0).getDate() }
  if (months < 0) { years--; months += 12 }
  const text = [[years, 'year'], [months, 'month'], [days, 'day']].filter(([amount]) => amount).map(([amount, unit]) => `${amount} ${unit}${amount === 1 ? '' : 's'}`).join(', ') || 'less than a day'
  return status === 'permanent' && years * 12 + months < minimum
    ? { text: `Residing here for ${text}. That is under the ${minimum}-month minimum, so this person cannot be recorded as Permanent yet. Choose Temporary and change the status later.`, validity: `A permanent resident needs at least ${minimum} months of residence.` }
    : { text: `Residing here for ${text}.`, validity: '' }
}

export function editableResident(record, fields) {
  const result = { ...emptyResident(fields), ...Object.fromEntries(Object.entries(record).map(([key, value]) => [key, value ?? ''])) }
  result.is_married = String(Number(record.is_married) === 1 ? 1 : 0)
  result.has_children = String(Number(record.has_children) === 1 ? 1 : 0)
  if (result.courtesy_title && !fields.titles.includes(result.courtesy_title)) {
    result.courtesy_title_other = result.courtesy_title
    result.courtesy_title = 'Others'
  }
  return editableFamily(result, fields.person)
}
