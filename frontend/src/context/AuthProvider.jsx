import PropTypes from 'prop-types'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as authService from '../services/authService.js'
import { AuthContext } from './authContext.js'

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const mutating = useRef(false)

  const refresh = useCallback(async (signal) => {
    if (mutating.current || signal?.aborted) return
    const request = ++generation.current
    try {
      const result = await authService.getSession()
      if (!signal?.aborted && request === generation.current) {
        setSession(result)
        setError('')
      }
    } catch (failure) {
      if (signal?.aborted || failure.name === 'AbortError' || request !== generation.current) return
      if ([401, 403].includes(failure.status)) {
        setSession({ authenticated: false, user: null })
        setError('')
      }
      else {
        setSession(null)
        setError(failure.message)
      }
    } finally {
      if (!signal?.aborted && request === generation.current) setSessionChecked(true)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let stop = () => {}
    // Skip the discarded StrictMode effect before starting the network read.
    queueMicrotask(() => {
      if (controller.signal.aborted) return
      try {
        stop = authService.observeSession(() => refresh(controller.signal), failure => {
          if (!controller.signal.aborted) setError(failure.message)
        })
      } catch (failure) {
        setError(failure.message)
        setSessionChecked(true)
      }
    })
    const revalidate = () => { if (document.visibilityState === 'visible') refresh(controller.signal) }
    window.addEventListener('focus', revalidate)
    document.addEventListener('visibilitychange', revalidate)
    return () => {
      controller.abort()
      stop()
      window.removeEventListener('focus', revalidate)
      document.removeEventListener('visibilitychange', revalidate)
    }
  }, [refresh])

  async function mutate(action, body) {
    mutating.current = true
    ++generation.current // A pre-mutation session read must never overwrite this result.
    try {
      const result = await authService[action](body)
      ++generation.current
      setSession(result.data)
      setSessionChecked(true)
      setError('')
      return result
    } catch (failure) {
      if (action !== 'login' && [401, 403].includes(failure.status)) {
        setSession({ authenticated: false, user: null })
        setSessionChecked(true)
      }
      throw failure
    } finally {
      mutating.current = false
    }
  }

  return (
    <AuthContext.Provider value={{
      user: session?.user, passwordRules: session?.password_rules || [],
      loading: !sessionChecked, error, refresh,
      login: (credentials) => mutate('login', credentials),
      logout: () => mutate('logout'),
      changePassword: (passwords) => mutate('changePassword', passwords),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

if (import.meta.env.DEV) {
  AuthProvider.propTypes = {
    children: PropTypes.node,
  }
}
