import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { getSession, observeSession, logout } from '../services/authService.js'
const Context = createContext(null)
export const useAuth = () => useContext(Context)
export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, password_rules: [], error: '' })
  const generation = useRef(0)
  async function refresh() {
    const current = ++generation.current
    try { const session = await getSession(); if (current === generation.current) setState({ ...session, loading: false, error: '' }); return session }
    catch (error) { if (current === generation.current) setState({ loading: false, user: null, password_rules: [], error: error.message }) }
  }
  useEffect(() => {
    let stop = () => {}
    try { stop = observeSession(refresh, error => setState(s => ({ ...s, loading: false, error: error.message }))) }
    catch (error) { setState(s => ({ ...s, loading: false, error: error.message })) }
    void refresh()
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh() })
    return () => { generation.current++; stop(); listener.remove() }
  }, [])
  return <Context.Provider value={{ ...state, refresh, logout }}>{children}</Context.Provider>
}
