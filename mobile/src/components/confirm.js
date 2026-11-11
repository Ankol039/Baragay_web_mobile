import { Alert, Platform } from 'react-native'
// React Native Alert has no web implementation. Keep equivalent confirmation on web.
export function confirmAction(title, message, action, label = 'Continue') {
  if (Platform.OS === 'web') { if (window.confirm(`${title}\n\n${message}`)) action(); return }
  Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: label, onPress: action }])
}
