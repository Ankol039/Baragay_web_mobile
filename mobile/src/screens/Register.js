import { useState } from 'react'
import { Text } from 'react-native'
import { Page, Card, Button, Field, Notice } from '../components/ui.js'
import { PersonFields, AddressFields } from '../components/PersonForm.js'
import FamilyForm from '../components/FamilyForm.js'
import PasswordRules from '../components/PasswordRules.js'
import { registrationMetadata, registerResident, newOperationId, signInRegistered } from '../services/accountsService.js'
import useResource from '../hooks/useResource.js'
import useDiscard from '../hooks/useDiscard.js'
import { useAuth } from '../context/AuthContext.js'
import { styles as s } from '../theme.js'
export default function Register({ navigation }) {
  const auth = useAuth(), resource = useResource(registrationMetadata)
  const [values, setValues] = useState({ residency_status: 'permanent', special_category: 'none', is_married: '0', has_children: '0', children: [], references: [{}], password: '', confirm_password: '' })
  const [operationId] = useState(newOperationId), [busy, setBusy] = useState(false), [error, setError] = useState(''), [created, setCreated] = useState(null), [dirty, setDirty] = useState(false)
  useDiscard(dirty && !created, navigation)
  const change = (key, value) => { setDirty(true); setValues(old => ({ ...old, [key]: value })) }
  async function submit() {
    setBusy(true); setError('')
    try { const result = await registerResident(values, operationId); setCreated(result.data); setDirty(false) }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function signIn() {
    setBusy(true); setError('')
    try { await signInRegistered(created.resident_number, values.password); setValues(v => ({ ...v, password: '', confirm_password: '' })); await auth.refresh() }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const data = resource.data, fields = data?.fields
  const primary = fields && { ...fields.person, middle_name: { ...fields.person.middle_name, required: true }, gender: { ...fields.person.gender, required: true } }
  const category = fields?.category_references?.[values.special_category]
  return <Page title="Register" resource={resource}><Notice error>{error}</Notice>{created ? <Card title="Registration Successful"><Text style={s.text}>Resident Number: {created.resident_number}</Text><Text style={s.muted}>Keep your Resident Number. Use it with your password to sign in.</Text><Button title="Sign In" onPress={signIn} disabled={busy} /></Card>
    : fields && <Card title="Resident Information"><PersonFields spec={primary} values={values} onChange={change} />
      <Field label="Birthdate *" value={values.birthdate} placeholder="YYYY-MM-DD" maxLength={10} onChange={v => change('birthdate', v)} />
      <Field label="Birthplace *" value={values.birthplace} onChange={v => change('birthplace', v)} />
      <Field label="Email" value={values.email} onChange={v => change('email', v)} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Contact Number" value={values.contact_number} onChange={v => change('contact_number', v)} maxLength={20} keyboardType="phone-pad" />
      <Field label="Residency Status" value={values.residency_status} onChange={v => change('residency_status', v)} options={{ permanent: 'Permanent', temporary: 'Temporary' }} />
      <Field label="Residency Start Date *" value={values.residency_start_date} placeholder="YYYY-MM-DD" maxLength={10} onChange={v => change('residency_start_date', v)} />
      <Text style={s.heading}>Permanent Address</Text><AddressFields spec={fields.address} values={values} onChange={change} />
      {values.residency_status === 'temporary' && <><Text style={s.heading}>Temporary Address</Text><Field label="Residence Type" options={fields.residence_types} value={values.residence_type} onChange={v => change('residence_type', v)} /><AddressFields spec={fields.address} values={values} onChange={change} prefix="temp_" /></>}
      <Field label="Special Category" options={{ none: 'None', pwd: 'PWD', senior_citizen: 'Senior Citizen', pregnant: 'Pregnant' }} value={values.special_category} onChange={v => change('special_category', v)} />
      {category && <><Field label={`${category.label} *`} value={values.category_reference} onChange={v => change('category_reference', v)} placeholder={category.placeholder} maxLength={60} /><Text style={s.muted}>{category.hint}</Text></>}
      <FamilyForm fields={fields} values={values} onChange={change} />
      <Field label="Password" value={values.password} onChange={v => change('password', v)} password /><PasswordRules rules={auth.password_rules || []} value={values.password} />
      <Field label="Confirm Password" value={values.confirm_password} onChange={v => change('confirm_password', v)} password />
      <Button title={busy ? 'Registering…' : 'Register'} onPress={submit} disabled={busy} />
    </Card>}
    <Button secondary title="Back to Sign In" disabled={busy} onPress={() => navigation.goBack()} />
  </Page>
}
