import { View } from 'react-native'
import { Field, Heading, Button } from './ui.js'
export function PersonFields({ spec, values, onChange, identity = false }) {
  return <View style={{ gap: 12 }}>{Object.entries(spec).filter(([key]) => !identity || key !== 'gender').map(([key, field]) => <Field key={key}
    label={`${field.label}${!identity && field.required ? ' *' : ''}`} value={values[key]} onChange={value => onChange(key, value)}
    options={field.options && (key === 'courtesy_title' ? [...field.options, 'Others'] : field.options)} maxLength={field.maxlength} placeholder={field.placeholder} />)}
    {values.courtesy_title === 'Others' && <Field label="Specify Title" value={values.courtesy_title_other} onChange={v => onChange('courtesy_title_other', v)} maxLength={20} />}
  </View>
}
export function AddressFields({ spec, values, onChange, prefix = '' }) {
  return <View style={{ gap: 12 }}>{Object.entries(spec).map(([key, field]) => <Field key={key} label={`${field.label}${field.required ? ' *' : ''}`}
    value={values[prefix + key]} onChange={v => onChange(prefix + key, v)} maxLength={field.maxlength} placeholder={field.placeholder} keyboardType={key === 'postal_code' ? 'number-pad' : 'default'} />)}</View>
}
export function PersonRows({ title, rows = [], spec, onChange }) {
  return <View style={{ gap: 15 }}><Heading>{title}</Heading>{rows.map((row, i) => <View key={i} style={{ gap: 10 }}><Heading>{title === 'Children' ? 'Child' : 'Character Reference'} {i + 1}</Heading>
    <PersonFields spec={spec} values={row} onChange={(key, v) => onChange(rows.map((p, j) => j === i ? { ...p, [key]: v } : p))} />
    <Button secondary title="Remove" onPress={() => onChange(rows.filter((_, j) => j !== i))} /></View>)}
    <Button secondary title={title === 'Children' ? '+ Add another child' : '+ Add another reference'} onPress={() => onChange([...rows, {}])} />
  </View>
}
