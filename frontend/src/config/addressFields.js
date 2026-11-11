export const addressLine = (spec, values, prefix = '') => Object.keys(spec).map(key => (values[prefix + key] || '').trim()).filter(Boolean).join(', ')
