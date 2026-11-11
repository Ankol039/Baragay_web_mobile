import { getResidentResponseCsv, getResidentResponse } from './residentService.js'
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export async function shareCsv(id) {
  const { csv, filename } = await getResidentResponseCsv(id), url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export async function printResponse(id) {
  const popup = window.open('', '_blank')
  if (!popup) throw new Error('Please allow popups to print your response.')
  try { const { data } = await getResidentResponse(id); if (!data) throw new Error('Response not found.')
    popup.document.write(`<html><head><title>${escape(data.response.title)}</title></head><body><h1>${escape(data.response.title)}</h1><p>${escape(data.response.submitted_at_label)}</p>${data.answers.map(a => `<h3>${escape(a.question_text)}</h3><p>${escape(a.display_answer)}</p>`).join('')}</body></html>`)
    popup.document.close(); popup.focus(); popup.print()
  } catch (error) { popup.close(); throw error }
}
