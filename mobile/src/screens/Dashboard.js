import { Text, View } from 'react-native'
import { Page, Card, Button, Details } from '../components/ui.js'
import { getResidentDashboard } from '../services/residentService.js'
import useResource from '../hooks/useResource.js'
import { styles as s, colors } from '../theme.js'
function Meter({ value }) { return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: value }} style={{ height: 12, backgroundColor: colors.border, borderRadius: 7 }}><View style={{ height: 12, width: `${value}%`, backgroundColor: colors.primary, borderRadius: 7 }} /></View> }
export default function Dashboard({ navigation }) {
  const resource = useResource(getResidentDashboard), d = resource.data
  return <Page title={d ? `Welcome, ${d.resident_name}!` : 'Dashboard'} subtitle="Here's a quick look at your survey activity." resource={resource}>
    {d && <><Button title="Answer a Survey" onPress={() => navigation.navigate('Surveys')} /><Text style={s.notice}>Reminder: Please complete available surveys before their closing date. Your responses help improve barangay health services.</Text>
      {[['Available Surveys', d.available_count, 'available'], ['Surveys Completed', d.answered_count, 'completed'], ['Total Assigned', d.assigned_total, 'assigned']].map(([label, value, view]) => <Card title={label} key={view}><Text style={s.title}>{value}</Text><Button secondary title="View Details" onPress={() => navigation.navigate('StatDetail', { view })} /></Card>)}
      <Card title="Your Progress"><Meter value={d.completion_pct} /><Text style={s.text}>{d.answered_count} of {d.assigned_total} surveys completed ({d.completion_pct}%)</Text></Card>
      <Card title="Survey Overview"><Details rows={[[`${d.available_count} waiting for your answer`, d.available_count ? 'Open now and not yet answered.' : 'Nothing pending right now.'], [`${d.answered_count} already submitted`, 'Your answers are recorded and cannot be changed.'], [d.next_deadline_label || 'No upcoming deadline', d.next_deadline_label ? 'Closing date of your next survey.' : 'You have no surveys closing soon.']]} /></Card>
      <Card title={d.is_temporary ? 'Where You Are Staying' : 'Your Registered Address'}><Text style={s.text}>{d.is_temporary ? `${d.residence_name}
${d.me.temporary_address}` : d.me.address}</Text>
        <Details rows={[[ 'Household Number', d.me.household_number ], ['Barangay', d.is_temporary ? d.me.temp_barangay : d.me.barangay], ['Municipality / City', d.is_temporary ? d.me.temp_municipality : d.me.municipality], ['Province', d.is_temporary ? d.me.temp_province : d.me.province], ...(d.is_temporary ? [['Permanent Address', d.me.address]] : [])]} />
        <Text style={s.muted}>Address changes are reviewed by barangay staff. Request one from My Profile.</Text></Card>
      {d.has_activity && <Card title="Your Activity"><Text style={s.muted}>Surveys you submitted over the last six months.</Text>{d.activity_months.map(row => <View key={row.label}><Text style={s.text}>{row.label}: {row.value}</Text><Meter value={Math.round(row.value / Math.max(1, ...d.activity_months.map(v => v.value)) * 100)} /></View>)}</Card>}
      {d.has_residency_progress && <Card title={d.is_temporary ? 'Towards Permanent Status' : 'Your Residency'}><Meter value={d.residency_pct} /><Details rows={[[ 'Residing here since', d.residency_start_label ], ['Months completed', d.residency_months], ...(d.is_temporary ? [['Still to go', `${Math.max(0, d.residency_minimum - d.residency_months)} month(s)`]] : [])]} />{d.is_temporary && <Text style={s.muted}>Reaching the minimum does not change your status on its own — barangay staff record it.</Text>}</Card>}
      {d.has_household && <Card title="On Your Record"><Details rows={d.household_rows.map(r => [r.label, r.value])} /></Card>}
      <Card title="Closing Soon">{d.upcoming.length ? d.upcoming.map(r => <View key={r.survey_id}><Text style={s.text}>{r.title}</Text><Text style={s.muted}>{r.end_date_label}</Text></View>) : <Text style={s.muted}>No upcoming deadline</Text>}</Card>
      <Card title="Recent Submissions">{d.recent_submissions.length ? d.recent_submissions.map((r, i) => <View key={i}><Text style={s.text}>{r.title}</Text><Text style={s.muted}>{r.submitted_at_label}</Text></View>) : <Text style={s.muted}>You have not submitted any surveys yet.</Text>}</Card>
    </>}
  </Page>
}
