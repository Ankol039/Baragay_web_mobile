import { useState } from 'react'
import { Text } from 'react-native'
import { Page, Card, Field, Button, Notice } from '../components/ui.js'
import PasswordRules from '../components/PasswordRules.js'
import { changePassword } from '../services/authService.js'
import { useAuth } from '../context/AuthContext.js'
import { styles as s } from '../theme.js'
export default function ChangePassword({ navigation }) {
  const auth = useAuth(), [values, setValues] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(false)
  async function submit() {
    setBusy(true); setError('')
    try { await changePassword(values); setValues({ current_password: '', new_password: '', confirm_password: '' }); setSuccess(true) }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function done() { await auth.refresh(); if (navigation.canGoBack()) navigation.goBack() }
  return <Page title="Change Password"><Card><Notice error>{error}</Notice>
    {success ? <><Notice>Password changed successfully.</Notice><Button title="Done" onPress={done} /></> : <>
      {auth.user?.is_first_login && <Text style={s.muted}>For your security, please change your password before continuing.</Text>}
      {Object.entries({ current_password: 'Current Password', new_password: 'New Password', confirm_password: 'Confirm New Password' }).map(([key, label]) => <Field key={key} label={label} password
        value={values[key]} onChange={v => setValues(old => ({ ...old, [key]: v }))} />)}
      <PasswordRules rules={auth.password_rules || []} value={values.new_password} />
      {!!values.confirm_password && <Text style={s.muted}>{values.new_password === values.confirm_password ? 'Passwords match.' : 'Passwords do not match.'}</Text>}
      <Button title={busy ? 'Saving…' : 'Change Password'} onPress={submit} disabled={busy} />
    </>}
    <Button secondary title="Logout" onPress={auth.logout} disabled={busy} />
  </Card></Page>
}
