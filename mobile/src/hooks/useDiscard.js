import { useEffect } from 'react'
import { usePreventRemove } from '@react-navigation/native'
import { Platform } from 'react-native'
import { confirmAction } from '../components/confirm.js'
export default function useDiscard(dirty, navigation) {
  usePreventRemove(dirty, ({ data }) => confirmAction('Unsaved Changes', 'You have unsaved changes. Leave without saving?', () => navigation.dispatch(data.action), 'Leave'))
  useEffect(() => {
    if (Platform.OS !== 'web' || !dirty) return
    const stop = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', stop)
    return () => window.removeEventListener('beforeunload', stop)
  }, [dirty])
}
