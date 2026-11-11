import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import Card from '../common/Card.jsx'
import ResultBars from './ResultBars.jsx'
import TextAnswerList from './TextAnswerList.jsx'

export default function QuestionResultCard({ question, index }) {
  const rating = question.question_type === 'rating'
  return <Card>
    <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 20 }}>{`${index + 1}. ${question.question_text}`}</h3>
    {question.breakdown ? <>
      {rating ? <div style={{ marginBottom: 20 }}>
        <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>{question.avg_rating}</span>{' '}
        <span style={{ fontSize: '1.2rem', color: 'var(--muted)' }}>/ 5 Average Rating</span>
        <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{`Based on ${question.rating_n} total ratings`}</div>
      </div> : <div style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: 14 }}>{`Based on ${question.total_votes} response${question.total_votes === 1 ? '' : 's'}.`}</div>}
      <ResultBars rows={question.breakdown} rating={rating} />
    </> : <TextAnswerList question={question} />}
  </Card>
}

if (import.meta.env.DEV) {
  QuestionResultCard.propTypes = {
    question: record.isRequired,
    index: PropTypes.number.isRequired,
  }
}
