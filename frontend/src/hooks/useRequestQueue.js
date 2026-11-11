import { useContext, useState } from 'react'
import useServiceData from './useServiceData.js'
import { getRequests, getDeletions, getArchives, archiveAction, reviewRequest } from '../services/accountsService.js'
const loaders = { '/staff/address-requests': getRequests, '/staff/deletion-requests': getDeletions, '/staff/deleted-accounts': getArchives }
import { AuthContext } from '../context/authContext.js'

export default function useRequestQueue(path) {
  const load = loaders[path]
  const initial = useServiceData(load)
  const [latest, setLatest] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  const [redirect, setRedirect] = useState(null)
  const auth = useContext(AuthContext)
  async function run(endpoint, body) {
    if (busy) return
    setBusy(true); setFailure(''); setMessage('')
    try {
      const result = endpoint === 'review' ? await reviewRequest(body.kind, body.request_id, body.action, body.review_comment) : await archiveAction(endpoint.endsWith('/restore') ? 'restore' : 'purge', body)
      if (result.redirect && !result.data) { setRedirect(result.redirect); return }
      setDialog(null)
      setMessage(result.ui?.show_success === false ? '' : result.message || '')
      try {
        const refreshed = await load()
        if (refreshed.redirect) setRedirect(refreshed.redirect)
        else setLatest(refreshed.data)
        await auth?.refresh()
      } catch (error) { setFailure(error.message) }
    } catch (error) { setFailure(error.message) }
    finally { setBusy(false) }
  }
  function review(kind, request, action, comment) {
    return run('review', { kind, request_id: String(request.request_id), action, review_comment: comment })
  }
  function open(value) { setFailure(''); setDialog(value) }
  return { data: latest || initial.data, redirect: redirect || initial.redirect, error: failure || initial.error,
    dialog, open, close: () => { if (!busy) { setDialog(null); setFailure('') } }, busy, review, run, message, clearMessage: () => setMessage('') }
}
