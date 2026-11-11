import { useEffect, useState } from 'react'
import useAuth from './useAuth.js'

// Same read-state contract as useApiData; stale route/account results are ignored.
export default function useServiceData(load, argument) {
  const { user } = useAuth()
  const uid = user?.uid
  const [state, setState] = useState(null)
  useEffect(() => {
    if (!load || !uid) return
    let active = true
    Promise.resolve().then(() => active ? load(argument) : null).then(result => {
      if (active) setState({ load, argument, uid, data: result.data, error: '', redirect: result.redirect })
    }).catch(error => {
      if (active) setState({ load, argument, uid, data: null, error: error.message, redirect: null })
    })
    return () => { active = false }
  }, [load, argument, uid])
  return state?.load === load && state.argument === argument && state.uid === uid
    ? { ...state, loading: false } : { data: null, error: '', loading: true }
}
