import { record } from '../../propTypes.js'
import { useState } from 'react'

export default function TextAnswerList({ question }) {
  const [search, setSearch] = useState('')
  const answers = question.answers
  if (answers.length === 0) return <p style={{ color: 'var(--muted)', fontStyle: 'italic', background: 'var(--bg)', padding: 16, borderRadius: 8, textAlign: 'center' }}>No text responses have been submitted yet.</p>
  const matches = answers.map(answer => answer.answer_text.toLowerCase().includes(search.toLowerCase()))
  const scope = `answers-${question.question_id}`
  return <>
    <div className="table-toolbar no-print"><input type="search" data-answer-search={scope} placeholder="Search these answers..." aria-label="Search the open-text answers to this question" value={search} onChange={event => setSearch(event.target.value)} /></div>
    <div id={scope} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
      {answers.map((answer, index) => <div key={index} data-answer-text={answer.answer_text} style={{ display: matches[index] ? undefined : 'none', background: 'var(--bg)', padding: 16, borderRadius: 8, borderLeft: '4px solid var(--primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
        <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text)' }}>{`"${answer.answer_text}"`}</p>
        {answer.submitted_at_label && <p className="muted-note" style={{ margin: '8px 0 0' }}>{answer.submitted_at_label}</p>}
      </div>)}
    </div>
    <p className="answer-no-match empty-state" style={{ display: matches.some(Boolean) ? 'none' : 'block' }}>No answers match your search.</p>
  </>
}

if (import.meta.env.DEV) {
  TextAnswerList.propTypes = {
    question: record.isRequired,
  }
}
