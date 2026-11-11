import { useRef, useState } from 'react'
import { updateResident } from '../services/accountsService.js'

export default function useResidentSubmission(onSaved) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [redirect, setRedirect] = useState(null)
  const sending = useRef(false)
  async function submit(event, body) {
    event.preventDefault()
    if (sending.current) return
    sending.current = true
    setBusy(true); setError('')
    try {
      const result = await updateResident(body)
      if (!result.data) { setRedirect(result.redirect); return }
      await onSaved(result)
    } catch (failure) { setError(failure.message) }
    finally { sending.current = false; setBusy(false) }
  }
  return { error, busy, redirect, submit, clearError: () => setError('') }
}
