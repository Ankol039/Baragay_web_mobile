import { View, Text, Pressable } from 'react-native'
import { Card, Field } from './ui.js'
import { questionRequired, MAX_ANSWER_LENGTH } from '../shared/validateResponse.js'
import { styles as s } from '../theme.js'
export default function Question({ question, index, value, onChange }) {
  const q = question, options = q.type === 'multiple_choice' ? q.choices.map(c => [`choice_${c.id}`, c.text])
    : q.type === 'yesno' ? [['Yes', 'Yes'], ['No', 'No']] : [1, 2, 3, 4, 5].map(v => [String(v), String(v)])
  return <Card title={`${index + 1}. ${q.text}${questionRequired(q) ? ' *' : ''}`}>
    {q.type === 'short_answer' ? <Field label={questionRequired(q) ? 'Answer' : 'Answer (optional)'} multiline maxLength={MAX_ANSWER_LENGTH}
      placeholder="Type your answer here (optional)" value={value} onChange={onChange} />
      : <View style={q.type === 'rating' && s.row}>{options.map(([key, label]) => <Pressable key={key} accessibilityRole="radio"
        accessibilityState={{ selected: value === key }} accessibilityLabel={label} onPress={() => onChange(key)} style={[s.option, value === key && s.selected]}>
        <Text style={s.text}>{q.type !== 'rating' ? `${value === key ? '●' : '○'}  ` : ''}{label}</Text></Pressable>)}</View>}
    {q.type === 'rating' && <Text style={s.muted}>1 = Poor, 5 = Excellent</Text>}
  </Card>
}
