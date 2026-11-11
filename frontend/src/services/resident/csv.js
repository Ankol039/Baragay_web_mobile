function cell(value) {
  const text = String(value ?? '')
  // Match the existing PHP fputcsv delimiter/enclosure/default escape behavior.
  return /[ \t\r\n,"\\]/.test(text) ? `"${text.replace(/(?<!\\)"/g, '""')}"` : text
}
export const csvText = rows => rows.map(row => row.map(cell).join(',')).join('\n') + '\n'
