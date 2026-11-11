import { useState } from 'react'
import { Text, Image, View } from 'react-native'
import { Page, Card, Button, Notice, Details } from '../components/ui.js'
import { getProfile, uploadPhoto, removePhoto } from '../services/profileService.js'
import { confirmAction } from '../components/confirm.js'
import useResource from '../hooks/useResource.js'
import { useAuth } from '../context/AuthContext.js'
import { styles as s } from '../theme.js'
export default function Profile({ navigation }) {
  const resource = useResource(getProfile), auth = useAuth(), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  async function photo(action) {
    setBusy(true); setError('')
    try { const result = await action(); if (result) { resource.setData(result.data); setMessage(result.message); await auth.refresh() } }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  function edit(type) { navigation.navigate('EditProfile', { type }) }
  const data = resource.data, r = data?.resident, display = data?.display
  const person = (title, p) => <View key={title} style={{ gap: 10 }}><Text style={s.heading}>{title}</Text>{p?.full_name ? <Details rows={[[ 'Full Name', p.full_name ], ...Object.entries(data.fields.person).map(([key, field]) => [field.label, p[key]])]} /> : <Text style={s.muted}>Not recorded.</Text>}</View>
  return <Page title="My Profile" subtitle="Your personal details on record with the health center." resource={resource}><Notice>{message}</Notice><Notice error>{error}</Notice>
    {data && <><Card title="Profile Overview"><Details rows={[[ 'Resident Number', `${r.resident_number} (cannot be changed)` ], ['Courtesy Title', r.courtesy_title], ['Full Name', display.full_name], ['First Name', r.first_name], ['Middle Name', r.middle_name], ['Surname', r.last_name], ['Extension Name', r.name_extension], ['Gender', display.gender]]} /><Button title="Request Change" onPress={() => edit('nameAddress')} /></Card>
      <Card title="Profile Photo">{r.photo_path ? <Image source={{ uri: r.photo_path }} style={{ width: 140, height: 140, borderRadius: 70, alignSelf: 'center' }} /> : <Text style={[s.title, { alignSelf: 'center' }]}>{r.first_name?.[0]}</Text>}
        <Button title={r.photo_path ? 'Change Photo' : 'Upload Photo'} onPress={() => photo(uploadPhoto)} disabled={busy} />
        {!!r.photo_path && <Button secondary title="Remove Photo" disabled={busy} onPress={() => confirmAction('Remove Photo', 'Remove your profile photo?', () => photo(removePhoto), 'Remove Photo')} />}
      </Card>
      <Card title="Personal Details"><Details rows={[[ 'Birthdate', display.birthdate ], ['Age', display.age]]} /><Button title="Request Birthdate Correction" onPress={() => edit('birthdate')} /></Card>
      <Card title="Contact Information"><Details rows={[[ 'Email', r.email ], ['Contact Number', r.contact_number], ['Complete Address', r.address]]} /><Button title="Edit Contact" onPress={() => edit('contact')} />
        <Text style={s.heading}>Address Breakdown</Text><Details rows={Object.entries(data.fields.address).map(([key, f]) => [f.label, r[key]])} />
        {r.residency_status === 'temporary' && <><Text style={s.heading}>Temporary Address ({display.residence_type})</Text><Details rows={[[ 'Complete Address', r.temporary_address ], ...Object.entries(data.fields.address).map(([key, f]) => [f.label, r[`temp_${key}`]])]} /></>}
      </Card>
      <Card title="Family & Household"><Text style={s.muted}>Ask barangay staff to review any correction needed here.</Text>
        {data.pending_request && <Notice>You already have a change waiting for review. Nothing changes until staff approve it.</Notice>}
        <Details rows={[[ 'Occupation', r.occupation ], ['Hotline Number', r.hotline_number], ['Marital Status', r.is_married === '1' ? 'Married' : 'Not married']]} />
        {r.is_married === '1' && person('Spouse', display.spouse)}{person("Father", display.father)}{person("Mother", display.mother)}
        {display.children.length ? display.children.map((p, i) => person(`Child ${i + 1}`, p)) : <Text style={s.muted}>Children: None on record.</Text>}
        {display.references.length ? display.references.map((p, i) => person(`Character Reference ${i + 1}`, p)) : <Text style={s.muted}>Character References: None on record. Ask staff to add at least one.</Text>}
        <Button title="Request Family & Household Change" onPress={() => edit('family')} />
      </Card><Button title="Change Password" onPress={() => navigation.navigate('ChangePassword')} /><Button secondary title="Logout" onPress={auth.logout} disabled={busy} />
    </>}
  </Page>
}
