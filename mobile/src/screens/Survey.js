import { useEffect, useState } from 'react'
import { Text } from 'react-native'
import { Page, Button, Notice } from '../components/ui.js'
import { confirmAction } from '../components/confirm.js'
import Question from '../components/Question.js'
import { getSurvey, submitResponse } from '../services/surveyService.js'
import { validateResponse, responseMessages } from '../shared/validateResponse.js'
import useResource from '../hooks/useResource.js'
import useDiscard from '../hooks/useDiscard.js'
import { styles as s } from '../theme.js'
export default function Survey({ navigation, route }) {
  const resource = useResource(getSurvey, route.params.id), [values, setValues] = useState({})
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState(false), [confirmed, setConfirmed] = useState(false)
  useDiscard(!done && Object.values(values).some(Boolean), navigation)
  useEffect(() => { if (resource.redirect) { setDone(true); setError('This survey is no longer available or has already been answered.') } }, [resource.redirect])
  useEffect(() => { if (confirmed) navigation.replace('Confirmation', { id: route.params.id }) }, [confirmed, navigation, route.params.id])
  async function save() {
    setBusy(true); setError('')
    try {
      const result = await submitResponse(route.params.id, values, resource.data.version)
      if (result.redirect?.includes('submitted=')) { setDone(true); setConfirmed(true) }
      else if (result.redirect?.includes('error=empty')) setError(responseMessages.empty)
      else if (result.redirect?.includes('error=failed')) setError(responseMessages.failed)
      else { setDone(true); setError('This survey is no longer available or has already been answered.') }
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  function submit() {
    const checked = validateResponse(resource.data.questions, values)
    if (!checked.valid) { setError(checked.message); return }
    confirmAction('Submit Survey', 'Your answers are recorded and cannot be changed.', save, 'Submit Survey')
  }
  return <Page title={resource.data?.survey.title || 'Survey'} resource={resource}><Notice error>{error}</Notice>
    {resource.data && <><Text style={s.muted}>{resource.data.survey.description}</Text>{resource.data.questions.map((q, index) => <Question key={q.id} index={index}
      question={q} value={values[`q${q.id}`] || ''} onChange={v => setValues(old => ({ ...old, [`q${q.id}`]: v }))} />)}
      <Button title={busy ? 'Submitting…' : 'Submit Survey'} onPress={submit} disabled={busy || done} /></>}
    <Button secondary title={done ? 'Back to Surveys' : 'Cancel'} onPress={() => navigation.goBack()} disabled={busy} />
  </Page>
}
