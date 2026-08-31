import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api/client'
import { usePolling } from '../hooks/usePolling'

const ThemeContext = createContext()

const THEME_KEY = 'kirana-dark-mode'
const THEME_SETTING = 'theme'

function readLocalDark() {
  try {
    return JSON.parse(localStorage.getItem(THEME_KEY)) === true
  } catch {
    return false
  }
}

function readBackendTheme(data) {
  const list = Array.isArray(data) ? data : (data?.settings || [])
  const found = list.find(setting => setting.key === THEME_SETTING)
  const value = found?.value
  if (value === 'dark') return 'dark'
  if (value === 'light') return 'light'
  return null
}

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(readLocalDark)
  // Only explicit user toggles write back to the backend — the mount-time
  // effect and backend-driven applies must never clobber the synced value.
  const userToggledRef = useRef(false)

  // Keep <html class="dark">, localStorage, and (on user toggle) the backend
  // setting in sync with the current state.
  useEffect(() => {
    localStorage.setItem(THEME_KEY, JSON.stringify(dark))
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    if (userToggledRef.current && localStorage.getItem('kirana-token')) {
      api.settings.update({ [THEME_SETTING]: dark ? 'dark' : 'light' }).catch(() => {})
      userToggledRef.current = false
    }
  }, [dark])

  // Once per session, adopt the theme saved on the backend (another device,
  // or a previous visit). On a brand-new device the app boots on the login
  // screen before any token exists, so wait for one to appear, then fetch
  // once and stop. No write-back here — the backend is authoritative.
  useEffect(() => {
    let cancelled = false
    let timer = null
    const tryFetch = () => {
      if (cancelled || !localStorage.getItem('kirana-token')) return false
      api.settings.getAll()
        .then(res => {
          if (cancelled) return
          const mode = readBackendTheme(res.data)
          if (mode) setDark(mode === 'dark')
        })
        .catch(() => {})
      return true
    }
    if (!tryFetch()) {
      timer = setInterval(() => {
        if (tryFetch()) clearInterval(timer)
      }, 2500)
    }
    return () => { cancelled = true; if (timer) clearInterval(timer) }
  }, [])

  // Cross-device sync: quietly re-check the saved theme while the app is open.
  usePolling(() => {
    if (!localStorage.getItem('kirana-token')) return
    api.settings.getAll()
      .then(res => {
        const mode = readBackendTheme(res.data)
        if (mode && mode !== (readLocalDark() ? 'dark' : 'light')) {
          setDark(mode === 'dark')
        }
      })
      .catch(() => {})
  }, 60000)

  const toggleDark = useCallback(() => {
    userToggledRef.current = true
    setDark(prev => !prev)
  }, [])

  return (
    <ThemeContext.Provider value={{ dark, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

// The hook intentionally lives next to its provider; fast refresh still works,
// it just falls back to a full reload for this file.
// eslint-disable-next-line react/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
