import { StyleSheet } from 'react-native'
export const colors = { primary: '#1d6f5e', dark: '#14483d', soft: '#e8f3ef', background: '#f4f7f6', text: '#223028', muted: '#6b7c76', border: '#dbe5e1', danger: '#c0392b' }
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, content: { padding: 18, paddingBottom: 36, gap: 14 },
  card: { padding: 18, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, gap: 12 },
  title: { fontSize: 25, fontWeight: '700', color: colors.dark }, heading: { fontSize: 19, fontWeight: '700', color: colors.dark },
  text: { fontSize: 15, color: colors.text, lineHeight: 22 }, muted: { fontSize: 14, color: colors.muted, lineHeight: 21 },
  label: { fontSize: 14, color: colors.text, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 7, padding: 12, color: colors.text, fontSize: 16, minHeight: 46 },
  button: { padding: 13, borderRadius: 7, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  secondary: { backgroundColor: colors.soft }, buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  error: { color: colors.danger, backgroundColor: '#fff0ee', borderRadius: 7, padding: 12, fontSize: 14, lineHeight: 21 },
  notice: { color: colors.dark, backgroundColor: colors.soft, borderRadius: 7, padding: 12, fontSize: 14, lineHeight: 21 },
  option: { borderWidth: 1, borderColor: colors.border, padding: 13, borderRadius: 7, marginVertical: 4 },
  selected: { backgroundColor: colors.soft, borderColor: colors.primary },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10 },
})
