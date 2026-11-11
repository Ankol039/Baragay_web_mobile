import { apiError } from './accounts-store.mjs'
import { PROFILE_PERSON, PROFILE_ADDRESS, profileMap, personFieldKeys, phpTrim, resolveCourtesyTitle, collectPersonRows, personRowsErrors, hotlineNumberPattern, hotlineFormatHint, genderOptions, residenceTypes, addressFieldNames, buildAddressLine, requiredAddressFields, addressFieldLabels, validContactNumber, overlongAddressFields, categoryReferenceFields, validCategoryReference, residencyDuration, formatResidencyDuration, permanentResidencyMinMonths, today, dateOnly, validDate } from './policy.mjs'
export function accountDate(value) {
  if (!validDate(value)) apiError('Please enter a valid date.')
  return new Date(value + 'T00:00:00Z')
}
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
export function residentValues(input, existing = null) {
  if (!record(input)) apiError('Invalid request.')
  for (const [key, value] of Object.entries(input)) {
    if (['children', 'references'].includes(key)) {
      if (!Array.isArray(value)) apiError(`Invalid request field: ${key}.`)
      for (const row of value) if (!record(row) || Object.values(row).some(part => typeof part !== 'string')) apiError(`Invalid request field: ${key}.`)
    } else if (typeof value !== 'string') apiError(`Invalid request field: ${key}.`)
  }
  const str = key => phpTrim(input[key]), occupation = str('occupation'), hotline = str('hotline_number')
  const married = input.is_married === '1', hasChildren = input.has_children === '1', family = {}
  for (const who of ['spouse', 'father', 'mother']) {
    const person = Object.fromEntries(personFieldKeys().map(key => [key, str(who + '_' + key)]))
    person.courtesy_title = resolveCourtesyTitle(person.courtesy_title, str(who + '_courtesy_title_other'))
    if (who === 'spouse' && !married) for (const key of personFieldKeys()) person[key] = ''
    family[who] = person
  }
  const children = hasChildren ? collectPersonRows(input.children || []) : [], references = collectPersonRows(input.references || [])
  const errors = [...personRowsErrors(children, 'Child'), ...personRowsErrors(references, 'Character reference')]
  if (married && !family.spouse.last_name) errors.push('Enter the spouse\'s surname, or answer No to "Is this resident married?".')
  if (married && !family.spouse.first_name) errors.push('Enter the spouse\'s first name, or answer No to "Is this resident married?".')
  if (hasChildren && !children.length) errors.push('Add at least one child, or answer No to "Does this resident have children?".')
  if (!references.length) errors.push('At least one character reference is required.')
  if (hotline && !new RegExp(hotlineNumberPattern()).test(hotline)) errors.push('Check the hotline number. ' + hotlineFormatHint())
  if ([...occupation].length > 100) errors.push('That occupation is too long (100 characters maximum).')
  const gender = Object.hasOwn(genderOptions(), input.gender) ? input.gender : ''
  const courtesyTitle = resolveCourtesyTitle(input.courtesy_title || '', input.courtesy_title_other || '')
  const category = ['none', 'pwd', 'senior_citizen', 'pregnant'].includes(input.special_category) ? input.special_category : 'none'
  const categoryReference = category === 'none' ? '' : str('category_reference')
  const status = input.residency_status === 'temporary' ? 'temporary' : 'permanent'
  const start = str('residency_start_date'), duration = residencyDuration(start)
  const residenceType = status === 'temporary' && Object.hasOwn(residenceTypes(), input.residence_type) ? input.residence_type : ''
  const addr = Object.fromEntries(addressFieldNames().map(key => [key, str(key)]))
  const temp = Object.fromEntries(addressFieldNames().map(key => [key, status === 'temporary' ? str('temp_' + key) : '']))
  const missing = requiredAddressFields().filter(key => !addr[key]).map(key => addressFieldLabels()[key])
  if (status === 'temporary') missing.push(...requiredAddressFields().filter(key => !temp[key]).map(key => 'Temporary ' + addressFieldLabels()[key]))
  const birthdate = str('birthdate'), over = [...overlongAddressFields(addr), ...(status === 'temporary' ? overlongAddressFields(temp, 'Temporary ') : [])]
  if (!str('first_name') || !str('middle_name') || !str('last_name') || !birthdate || !gender || !str('birthplace')) apiError('Please fill in all required fields (marked with *).')
  else if (errors.length) apiError(errors[0])
  else if (missing.length) apiError('Please fill in: ' + missing.join(', ') + '.')
  else if (status === 'temporary' && !residenceType) apiError('Choose the type of temporary residence.')
  else if (!existing && addr.postal_code && !/^\d{4}$/.test(addr.postal_code)) apiError('A Philippine postal code is four digits.')
  else if (!validContactNumber(str('contact_number'))) apiError('A contact number can only contain digits, spaces, +, -, and brackets.')
  else if (over.length) apiError('These entries are too long: ' + over.join(', ') + '.')
  else if (category !== 'none' && !categoryReference) apiError('Enter the ' + categoryReferenceFields()[category].label + ' for this resident, or set the category to None.')
  else if (category !== 'none' && [...categoryReference].length > 60) apiError('That reference number is too long (60 characters maximum).')
  else if (category !== 'none' && !validCategoryReference(category, categoryReference)) apiError(categoryReferenceFields()[category].error)
  else if (!start) apiError('Enter the date this person began residing in the barangay.')
  else if (!duration) apiError('The residency start date is not a valid past date.')
  else if (status === 'permanent' && (!existing || start !== dateOnly(existing.residencyStartDate)) && duration.total_months < permanentResidencyMinMonths()) apiError('This person has been residing here for only ' + formatResidencyDuration(duration) + '. A resident must complete at least ' + permanentResidencyMinMonths() + (existing ? ' months before they can be recorded as Permanent. Revert them to Temporary first if the date is correct.' : ' months before they can be recorded as Permanent. Register them as Temporary for now, then change the status once they reach ' + permanentResidencyMinMonths() + ' months.'))
  else if (birthdate && start < birthdate) apiError('The residency start date cannot be earlier than the birthdate.')
  else if (birthdate > today()) apiError('Birthdate cannot be in the future.')
  const household = { occupation, hotlineNumber: hotline, isMarried: married, hasChildren }
  for (const who of ['spouse', 'father', 'mother']) household[who] = who === 'spouse' && !married ? null : profileMap(family[who], PROFILE_PERSON)
  return [{ name: profileMap({ ...input, courtesy_title: courtesyTitle, gender, first_name: str('first_name'), middle_name: str('middle_name'), last_name: str('last_name'), name_extension: str('name_extension') }, PROFILE_PERSON),
    contact: { email: str('email'), number: str('contact_number') }, birthdate: accountDate(birthdate), birthplace: str('birthplace'),
    permanentAddress: { ...profileMap(addr, PROFILE_ADDRESS), displayLine: buildAddressLine(...Object.values(addr)) }, temporaryAddress: status === 'temporary' ? { ...profileMap(temp, PROFILE_ADDRESS), displayLine: buildAddressLine(...Object.values(temp)) } : null,
    residencyStatus: status, residencyStartDate: accountDate(start), residenceType, specialCategory: category, categoryReference, household, lastResidencyRecordId: null }, { children, characterReferences: references }]
}
