import { useState } from 'react'
import { Text } from 'react-native'
import { Page, Card, Field, Button, Notice } from '../components/ui.js'
import { PersonFields, AddressFields } from '../components/PersonForm.js'
import FamilyForm from '../components/FamilyForm.js'
import { editablePerson, editableFamily, familyPayload } from '../config/personFields.js'
import { saveContact, requestBirthdate, requestNameAddress, requestFamily } from '../services/profileService.js'
import { getProfile } from '../services/profileService.js'
import useResource from '../hooks/useResource.js'
import useDiscard from '../hooks/useDiscard.js'
import { styles as s } from '../theme.js'
const actions = { contact: saveContact, birthdate: requestBirthdate, nameAddress: requestNameAddress, family: requestFamily }
const titles = { contact: 'Edit Contact Information', birthdate: 'Request Birthdate Correction', nameAddress: 'Request Name / Address Change', family: 'Request Family & Household Change' }
export default function EditProfile({ route, navigation }) {
  const resource = useResource(getProfile)
  return <Page title={titles[route.params.type]} resource={resource}>{resource.data && <EditForm key={route.params.type} type={route.params.type} data={resource.data} navigation={navigation} />}</Page>
}
function EditForm({ type, data, navigation }) {
  const spec = data.fields.person
  const [values, setValues] = useState(() => type === 'family' ? editableFamily(data.resident, spec, true) : editablePerson(data.resident, spec))
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('')
  useDiscard(dirty && !success, navigation)
  const change = (key, value) => { setDirty(true); setValues(old => ({ ...old, [key]: value })) }
  async function submit() {
    setBusy(true); setError('')
    try { const payload = type === 'family' ? familyPayload(values, spec) : type === 'birthdate' ? { birthdate: values.birthdate } : values
      const result = await actions[type](payload); setDirty(false); setSuccess(result.message || 'Your request has been sent for review.') }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const pending = type !== 'contact' && data.pending_request
  return <Card><Notice error>{error}</Notice><Notice>{success}</Notice>
    {pending && <Notice>You already have a pending request under review.</Notice>}
    {!success && <>{type === 'contact' ? <><Text style={s.muted}>Email and contact number changes are saved immediately.</Text>
      <Field label="Email" value={values.email} onChange={v => change('email', v)} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Contact Number" value={values.contact_number} onChange={v => change('contact_number', v)} keyboardType="phone-pad" maxLength={20} /></>
      : type === 'birthdate' ? <><Text style={s.muted}>Your birthdate sets the age on your record and your senior-citizen eligibility, so a correction is reviewed by staff before it takes effect.</Text>
        <Field label="Corrected Birthdate" placeholder="YYYY-MM-DD" value={values.birthdate} onChange={v => change('birthdate', v)} maxLength={10} /><Text style={s.muted}>Currently on record: {data.resident.birthdate || 'not set'}.</Text></>
      : type === 'family' ? <><Text style={s.muted}>Correct anything below and send it to barangay staff. Nothing on your record changes until they approve it.</Text>
        <FamilyForm fields={data.fields} values={values} onChange={change} /><Field label="Reason for the change *" value={values.family_reason} onChange={v => change('family_reason', v)} maxLength={255} /></>
      : <><Text style={s.muted}>Address changes are sent to staff for review.</Text><PersonFields spec={spec} values={values} onChange={change} identity />
        <AddressFields spec={data.fields.address} values={values} onChange={change} />{data.resident.residency_status === 'temporary' && <><Text style={s.heading}>Temporary Address</Text><AddressFields spec={data.fields.address} values={values} onChange={change} prefix="temp_" /></>}</>}
      <Button title={busy ? 'Saving…' : type === 'contact' ? 'Save Email & Contact' : type === 'nameAddress' ? 'Request Name/Address Change' : 'Send Request'} disabled={busy || pending} onPress={submit} />
    </>}
    <Button secondary title={success ? 'Done' : 'Cancel'} disabled={busy} onPress={() => navigation.goBack()} />
  </Card>
}
