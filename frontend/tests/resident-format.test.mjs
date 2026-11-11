import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import { activityMonths, dateLabel, eventValue, residencyMonths, todayKey } from '../src/services/resident/format.js'
import { trimWidth } from '../src/services/resident/trimWidth.js'
import { csvText } from '../src/services/resident/csv.js'

const php = (code, input) => JSON.parse(execFileSync('/Applications/XAMPP/xamppfiles/bin/php', ['-r', code], { input: JSON.stringify(input), encoding: 'utf8' }))
test('residency month counts match PHP DateTime::diff across leap years and month ends', () => {
  const pairs = []
  for (const year of [2024, 2025, 2026]) for (const month of [1, 2, 3, 8, 11, 12]) for (const day of [1, 10, 28, 31]) {
    const start = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)
    for (const end of ['2026-11-10', '2026-03-01', '2026-02-28', '2026-01-31']) pairs.push([start, end])
  }
  const expected = php('$rows=json_decode(stream_get_contents(STDIN),true);$out=[];foreach($rows as [$a,$b]){$a=new DateTime($a);$b=new DateTime($b);$d=$a->diff($b);$out[]=$a<=$b?$d->y*12+$d->m:0;}echo json_encode($out);', pairs)
  assert.deepEqual(pairs.map(([a, b]) => residencyMonths(a, b)), expected)
})
test('date labels match PHP and remain fixed to Manila across the UTC date boundary', () => {
  const instant = new Date('2026-11-09T16:05:06Z')
  assert.equal(todayKey(instant), '2026-11-10')
  assert.equal(eventValue(instant), '2026-11-10 00:05:06')
  const expected = php('date_default_timezone_set("Asia/Manila");echo json_encode([date("M j, Y g:i A",strtotime("2026-11-09T16:05:06Z")),date("F d, Y h:i A",strtotime("2026-11-09T16:05:06Z"))]);', null)
  assert.equal(dateLabel(instant, { event: true, time: true }), expected[0])
  assert.equal(dateLabel(instant, { event: true, time: true, full: true, padded: true }), expected[1])
})
test('activity preserves PHP overflowing month labels and the SQL partial first-month cutoff', () => {
  const now = new Date('2026-03-31T04:00:00Z')
  const expected = php('$out=[];for($i=5;$i>=0;$i--){$key=date("Y-m",strtotime("-$i month",strtotime("2026-03-31")));$out[]=date("M Y",strtotime($key."-01"));}echo json_encode($out);', null)
  const activity = activityMonths([
    { submittedAt: new Date('2025-10-30T15:59:59Z') }, // Manila October 30: excluded.
    { submittedAt: new Date('2025-10-30T16:00:00Z') }, // Manila October 31: included.
    { submittedAt: new Date('2026-01-01T00:00:00Z') },
  ], now)
  assert.deepEqual(activity.map(row => row.label), expected)
  assert.equal(activity[0].value, 1)
  assert.equal(activity.find(row => row.label === 'Jan 2026').value, 1)
  assert.equal(activity.find(row => row.label === 'Dec 2025').value, 0)
})
test('survey description truncation matches PHP mb_strimwidth for Unicode and line breaks', () => {
  const texts = ['Plain text '.repeat(12), '界'.repeat(50), 'a\u0301'.repeat(60), '👨‍👩‍👧‍👦'.repeat(15), '🙂'.repeat(50), 'line\n'.repeat(30), 'short', '']
  const expected = php('$out=[];foreach(json_decode(stream_get_contents(STDIN),true) as $text)$out[]=mb_strimwidth($text,0,80,"...","UTF-8");echo json_encode($out);', texts)
  assert.deepEqual(texts.map(text => trimWidth(text, 80)), expected)
})
test('CSV encoding matches existing PHP for quotes, escapes, spaces, Unicode and multiline text', () => {
  const rows = [['Survey', 'Survey title'], [], ['Question', 'Answer'], ['comma,', 'quote"'], ['slash\\"', '\\'],
    ['backslash\\\\"', 'line\nline'], ['tab\t', '界🙂'], ['no answer', ''], ['carriage\rreturn', 'vertical\vtab']]
  const expected = php('$out=fopen("php://temp","w+");foreach(json_decode(stream_get_contents(STDIN),true) as $row)fputcsv($out,$row);rewind($out);echo json_encode(stream_get_contents($out));', rows)
  assert.equal(csvText(rows), expected)
})
