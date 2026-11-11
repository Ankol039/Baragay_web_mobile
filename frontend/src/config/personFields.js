// The PHP profile response supplies person_field_spec() verbatim. All person
// forms, repeaters and collection use that single server-owned field list.
export const emptyPerson = spec => Object.fromEntries(Object.keys(spec).map(key => [key, '']))
export function editablePerson(person, spec) {
  const result = { ...person }
  const titles = spec.courtesy_title.options
  if (result.courtesy_title && !titles.includes(result.courtesy_title) && result.courtesy_title !== 'Others') {
    result.courtesy_title_other = result.courtesy_title
    result.courtesy_title = 'Others'
  }
  return result
}
export function collectPersonRows(rows, spec) {
  return (Array.isArray(rows) ? rows : []).flatMap(row => {
    if (!row || typeof row !== 'object') return []
    const entry = Object.fromEntries(Object.keys(spec).map(key => [key, String(row[key] || '').trim()]))
    entry.courtesy_title = entry.courtesy_title === 'Others' ? String(row.courtesy_title_other || '').trim().slice(0, 20)
      : spec.courtesy_title.options.includes(entry.courtesy_title) ? entry.courtesy_title : ''
    return Object.keys(spec).some(key => key !== 'gender' && entry[key]) ? [entry] : []
  })
}
export function editableFamily(resident, spec, clearOnOpen = false) {
  const result = { ...resident, family_reason: '' }
  for (const who of ['spouse', 'father', 'mother']) {
    const person = editablePerson(Object.fromEntries(Object.keys(spec).map(key => [key, resident[`${who}_${key}`]])), spec)
    for (const [key, value] of Object.entries(person)) result[`${who}_${key}`] = value
  }
  for (const key of ['children', 'references']) {
    result[key] = (resident[key].length ? resident[key] : [emptyPerson(spec)]).map(row => editablePerson(row, spec))
  }
  // The source family modal has no data-keep-on-close: shared script.js clears
  // text/select fields on open, retaining the default Yes/No radios and rows.
  if (clearOnOpen) {
    for (const key of Object.keys(result)) {
      if (['is_married', 'has_children', 'children', 'references'].includes(key)) continue
      result[key] = ''
    }
    for (const key of ['children', 'references']) result[key] = result[key].map(() => emptyPerson(spec))
  }
  return result
}
export function familyPayload(values, spec) {
  const result = { ...values }
  for (const key of ['children', 'references']) {
    result[key] = collectPersonRows(values[key], spec).map(row => editablePerson(row, spec))
  }
  return result
}
