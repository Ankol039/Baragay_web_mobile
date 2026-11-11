import { useState } from 'react'
import { Image, Text } from 'react-native'
import { Page, Card, Field, Button, Notice } from '../components/ui.js'
import { login } from '../services/authService.js'
import { useAuth } from '../context/AuthContext.js'
import { styles as s } from '../theme.js'
export default function Login({ navigation }) {
  const auth = useAuth(), [identifier, setIdentifier] = useState(''), [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function submit() {
    setBusy(true); setError('')
    try { await login({ identifier, password }); setPassword(''); await auth.refresh() }
    catch (e) { setError(e.message); setPassword('') } finally { setBusy(false) }
  }
  return <Page title="Barangay Health Center" subtitle="Survey System"><Image source={require('../../assets/logo.png')} style={{ width: 90, height: 90, alignSelf: 'center' }} />
    <Card title="Resident Portal"><Text style={s.muted}>Sign in to answer surveys and view your responses.</Text><Notice error>{error || auth.error}</Notice>
      <Field label="Resident Number" value={identifier} onChange={setIdentifier} autoCapitalize="none" autoCorrect={false} />
      <Field label="Password" value={password} onChange={setPassword} password />
      <Button title={busy ? 'Signing In…' : 'Sign In'} disabled={busy} onPress={submit} />
      <Button secondary title="Register" onPress={() => navigation.navigate('Register')} disabled={busy} />
      <Text style={s.muted}>Staff and administrator accounts must use the website.</Text>
    </Card></Page>
}
