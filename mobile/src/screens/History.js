import { Text } from 'react-native'
import { Page, Card, Button } from '../components/ui.js'
import { getResidentHistory } from '../services/residentService.js'
import useResource from '../hooks/useResource.js'
import { styles as s } from '../theme.js'
export default function History({ navigation }) {
  const resource = useResource(getResidentHistory)
  return <Page title="Submitted Surveys" subtitle="Review your previous survey responses and keep a record of what you submitted." resource={resource}>
    {resource.data?.responses.length === 0 && <Card><Text style={s.muted}>You have not submitted any surveys yet.</Text></Card>}
    {resource.data?.responses.map(r => <Card key={r.response_id} title={r.title}><Text style={s.text}>{r.description}</Text><Text style={s.muted}>{r.submitted_at_label}</Text>
      <Button title="View" onPress={() => navigation.navigate('Response', { id: String(r.response_id) })} /></Card>)}
  </Page>
}
