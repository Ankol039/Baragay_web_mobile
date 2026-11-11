import { View, Text } from 'react-native'
import { Field, Heading } from './ui.js'
import { PersonFields, PersonRows } from './PersonForm.js'
import { styles as s } from '../theme.js'
export default function FamilyForm({ fields, values, onChange }) {
  const person = who => <PersonFields spec={fields.person} values={Object.fromEntries([...Object.keys(fields.person), 'courtesy_title_other'].map(key => [key, values[`${who}_${key}`]]))}
    onChange={(key, value) => onChange(`${who}_${key}`, value)} />
  return <View style={{ gap: 15 }}>
    <Heading>Work and Household Contact</Heading><Field label="Occupation" value={values.occupation} onChange={v => onChange('occupation', v)} maxLength={100} placeholder="e.g. Student, Tricycle driver, Teacher, N/A" />
    <Text style={s.muted}>Type it in full. Put &quot;N/A&quot; if they are not working or studying.</Text>
    <Field label="Hotline Number" value={values.hotline_number} onChange={v => onChange('hotline_number', v)} maxLength={30} keyboardType="phone-pad" />
    <Text style={s.muted}>{fields.hotline_hint}</Text><Heading>Spouse</Heading>
    <Field label="Is this resident married?" options={{ 1: 'Yes', 0: 'No' }} value={values.is_married} onChange={v => onChange('is_married', v)} />
    {values.is_married === '1' && person('spouse')}<Heading>Children</Heading>
    <Field label="Does this resident have children?" options={{ 1: 'Yes', 0: 'No' }} value={values.has_children} onChange={v => onChange('has_children', v)} />
    {values.has_children === '1' && <PersonRows title="Children" rows={values.children} spec={fields.person} onChange={v => onChange('children', v)} />}
    <Heading>Parents</Heading><Text style={s.muted}>Optional. Fill in what is known.</Text>
    <Heading>Father&apos;s Name</Heading>{person('father')}<Heading>Mother&apos;s Name</Heading>{person('mother')}
    <Text style={s.muted}>At least one character reference is required, whether the resident is temporary or permanent.</Text>
    <PersonRows title="Character References" rows={values.references} spec={fields.person} onChange={v => onChange('references', v)} />
  </View>
}
