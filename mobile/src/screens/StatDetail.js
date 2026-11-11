import { Text } from 'react-native'
import { Page, Card, Button } from '../components/ui.js'
import { getResidentStatDetail } from '../services/residentService.js'
import useResource from '../hooks/useResource.js'
import { styles as s } from '../theme.js'
export default function StatDetail({ route, navigation }) {
  const resource = useResource(getResidentStatDetail, route.params.view)
  const title = { available: 'Available Surveys', completed: 'Surveys Completed', assigned: 'Total Assigned' }[route.params.view]
  return <Page title={title} resource={resource}>{resource.data && <><Text style={s.muted}>{resource.data.count} total</Text>
    {!resource.data.rows.length && <Card><Text style={s.muted}>No records found.</Text></Card>}
    {resource.data.rows.map((r, i) => <Card title={r.title} key={r.survey_id || i}><Text style={s.muted}>{r.submitted_at_label || r.end_date_label}</Text>{r.description && <Text style={s.text}>{r.description}</Text>}
      {route.params.view !== 'completed' && (r.answered ? <Text style={s.muted}>Already answered</Text> : <Button title="Answer Survey" onPress={() => navigation.navigate('Survey', { id: r.survey_id })} />)}</Card>)}</>}</Page>
}
