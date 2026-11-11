export const questionTypes = [
  ['multiple_choice', 'Multiple Choice'], ['yesno', 'Yes/No'],
  ['rating', 'Rating Scale (1-5)'], ['short_answer', 'Short Answer'],
]
export const questionTypeLabel = type => type === 'rating' ? 'Rating Scale' : questionTypes.find(([value]) => value === type)?.[1] || type
export const blankChoice = () => ({ key: crypto.randomUUID(), choice_text: '' })
export function editableQuestion(question) {
  const choices = question?.choices?.map(choice => ({ ...choice, key: crypto.randomUUID() })) || []
  while (choices.length < 2) choices.push(blankChoice())
  return { key: crypto.randomUUID(), question_text: '', question_type: 'multiple_choice', ...question, choices, removed: {} }
}
export function questionPayload(question) {
  const existing_choices = { ...question.removed }, new_choices = []
  for (const choice of question.choices) {
    if (choice.choice_id) existing_choices[choice.choice_id] = choice.choice_text
    else new_choices.push(choice.choice_text)
  }
  return { question_text: question.question_text, question_type: question.question_type, existing_choices, new_choices,
    choices: question.choices.map(choice => choice.choice_text) }
}
