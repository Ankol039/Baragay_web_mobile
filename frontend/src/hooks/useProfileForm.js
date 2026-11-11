import { useRef, useState } from 'react'
import useDirtyWarning from './useDirtyWarning.js'

export default function useProfileForm(initial, path, onSaved) {
  const [values, setValues] = useState(initial)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const dirty = useDirtyWarning()
  const change = (key, value) => setValues(current => ({ ...current, [key]: value,
    ...(key.endsWith('courtesy_title') ? { [`${key}_other`]: '' } : {}) }))
  async function submit(event, payload = values) {
    event.preventDefault()
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      const result = await path(payload)
      dirty.clear()
      onSaved(result)
    } catch (failure) { setError(failure.message) }
    finally { pending.current = false; setBusy(false) }
  }
  return { values, change, error, busy, dirty, submit }
}
