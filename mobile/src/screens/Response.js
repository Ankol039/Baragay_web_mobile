import { useState } from 'react'
import { Text } from 'react-native'
import { Page, Card, Button, Notice } from '../components/ui.js'
import { getResidentResponse } from '../services/residentService.js'
import { shareCsv, printResponse } from '../services/exportService'
import useResource from '../hooks/useResource.js'
import { styles as s } from '../theme.js'
export default function Response({ navigation, route }) {
  const resource = useResource(getResidentResponse, route.params.id), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  async function run(action) { setBusy(true); setError(''); try { await action(route.params.id) } catch (e) { setError(e.message) } finally { setBusy(false) } }
  return <Page title={resource.data?.response.title || 'Submitted Response'} resource={resource}><Notice error>{error}</Notice>
    {resource.redirect && <Notice error>Response not found.</Notice>}
    {resource.data && <><Text style={s.muted}>{resource.data.response.description}</Text><Text style={s.muted}>Submitted: {resource.data.response.submitted_at_label}</Text>
      <Button title="Export CSV / Share" disabled={busy} onPress={() => run(shareCsv)} /><Button secondary title="Print" disabled={busy} onPress={() => run(printResponse)} />
      {resource.data.answers.map((a, i) => <Card key={a.question_id} title={`${i + 1}. ${a.question_text}`}><Text selectable style={s.text}>{a.display_answer}</Text></Card>)}</>}
    <Button secondary title="Back to History" onPress={() => navigation.goBack()} />
  </Page>
}
