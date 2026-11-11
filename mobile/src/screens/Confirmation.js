import { Text } from 'react-native'
import { Page, Card, Button } from '../components/ui.js'
import { getSurveyConfirmation } from '../services/surveyService.js'
import useResource from '../hooks/useResource.js'
import { styles as s } from '../theme.js'
export default function Confirmation({ route, navigation }) {
  const resource = useResource(getSurveyConfirmation, route.params.id)
  return <Page resource={resource}><Card title="Submission confirmed"><Text style={s.title}>✓</Text>
    {resource.data && <Text style={s.text}>Your response to &quot;{resource.data.title}&quot; has been submitted successfully.</Text>}
    <Button title="Back to Surveys" onPress={() => navigation.navigate('Resident', { screen: 'Surveys' })} /></Card></Page>
}
