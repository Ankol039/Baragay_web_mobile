import { useEffect, useRef, useState } from 'react'
import { getResident, residentAction } from '../services/accountsService.js'

export default function useResidentActions(onSaved, onFailure) {
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const [redirect, setRedirect] = useState(null)
  const sending = useRef(false)
  const loading = useRef(null)
  useEffect(() => () => loading.current?.abort(), [])
  async function edit(id) {
    loading.current?.abort()
    const controller = new AbortController()
    loading.current = controller
    setBusy(true)
    try {
      const result = await getResident(id)
      if (controller.signal.aborted) return
      if (!result.data) { setRedirect(result.redirect); return }
      setDialog({ type: 'edit', detail: result.data })
    } catch (failure) {
      if (!controller.signal.aborted) window.alert(failure.message)
    } finally { if (loading.current === controller) setBusy(false) }
  }
  async function run(action, resident, reason = '') {
    if (sending.current) return
    sending.current = true; setBusy(true)
    try {
      const result = await residentAction(action, resident.resident_id, reason)
      setDialog(null)
      if (!result.data) { setRedirect(result.redirect); return }
      await onSaved(result)
    } catch (failure) { setDialog(null); onFailure(failure.message) }
    finally { sending.current = false; setBusy(false) }
  }
  return { dialog, setDialog, busy, redirect, edit, run, close: () => { if (!busy) setDialog(null) } }
}
