import { Text, View } from 'react-native'
import { styles as s } from '../theme.js'
const tests = { length: v => v.length >= 8, upper: v => /[A-Z]/.test(v), lower: v => /[a-z]/.test(v), number: v => /[0-9]/.test(v), space: v => v.length > 0 && !/\s/.test(v) }
export default function PasswordRules({ rules, value = '' }) {
  return <View style={{ gap: 5 }}><Text style={s.label}>Your password must have:</Text>{rules.map(({ key, label }) => <Text style={s.muted} key={key}>{tests[key]?.(value) ? '✓' : '○'} {label}</Text>)}
    <Text style={s.muted}>Tip: a symbol such as ! or # makes it stronger, but is not required.</Text></View>
}
