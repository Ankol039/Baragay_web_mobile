import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import * as Print from 'expo-print'
import { Share } from 'react-native'
import { getResidentResponseCsv, getResidentResponse } from './residentService.js'
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
export async function shareCsv(id) {
  const { filename, csv } = await getResidentResponseCsv(id)
  if (!await Sharing.isAvailableAsync()) return Share.share({ message: csv, title: filename })
  const file = new File(Paths.cache, filename); file.write(csv)
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' })
}
export async function printResponse(id) {
  const { data } = await getResidentResponse(id)
  if (!data) throw new Error('Response not found.')
  await Print.printAsync({ html: `<html><head><meta charset="utf-8"/></head><body><h1>${escape(data.response.title)}</h1><p>${escape(data.response.submitted_at_label)}</p>${data.answers.map(a => `<h3>${escape(a.question_text)}</h3><p>${escape(a.display_answer)}</p>`).join('')}</body></html>` })
}
