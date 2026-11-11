import { Text } from 'react-native'
import { Page, Card, Button } from '../components/ui.js'
import { getResidentSurveys } from '../services/residentService.js'
import useResource from '../hooks/useResource.js'
import { styles as s } from '../theme.js'
export default function Surveys({ navigation }) {
  const resource = useResource(getResidentSurveys), data = resource.data
  const rows = (list, answered) => list.map(row => <Card key={row.survey_id} title={row.title}>
    <Text style={s.text}>{row.description}</Text><Text style={s.muted}>End Date: {row.end_date_label}</Text>
    {answered ? <Text style={s.muted}>Already answered</Text> : <Button title="Answer Survey" onPress={() => navigation.navigate('Survey', { id: row.survey_id })} />}</Card>)
  return <Page title="Available Surveys" subtitle="Choose a survey below to share your answers." resource={resource}>
    {data && <>{!data.open.length && <Card><Text style={s.muted}>No available surveys at the moment.</Text></Card>}{rows(data.open, false)}
      {!!data.answered.length && <><Text style={s.heading}>Already Answered</Text>{rows(data.answered, true)}</>}</>}
  </Page>
}
