// Presentation/normalisation only. The API independently decides where to look.
export default function detectAccountType(value) {
  const identifier = value.trim()
  if (/^R-[0-9]{4}-[0-9]{4}$/i.test(identifier)) {
    return { type: 'resident', identifier: identifier.toUpperCase() }
  }
  if (/^S-[0-9]{4}-[0-9]{4}$/i.test(identifier)) {
    return { type: 'staff', identifier: identifier.toUpperCase() }
  }
  return { type: 'username', identifier }
}
