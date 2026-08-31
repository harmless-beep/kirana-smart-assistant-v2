import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api/client'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('kirana-token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      api.auth.getMe()
        .then(res => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('kirana-token')
          setToken(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  const login = async (phone, password) => {
    const res = await api.auth.login({ phone, password })
    localStorage.setItem('kirana-token', res.data.access_token || res.data.token)
    setToken(res.data.access_token || res.data.token)
    setUser(res.data.user)
    return res.data
  }

  const register = async (shopName, ownerName, phone, password) => {
    const res = await api.auth.register({ name: ownerName, phone, password, shop_name: shopName })
    localStorage.setItem('kirana-token', res.data.access_token || res.data.token)
    setToken(res.data.access_token || res.data.token)
    setUser(res.data.user)
    return res.data
  }

  const logout = () => {
    localStorage.removeItem('kirana-token')
    setToken(null)
    setUser(null)
  }

  const updateUser = (data) => setUser(prev => ({ ...prev, ...data }))

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

// The hook intentionally lives next to its provider; fast refresh still works,
// it just falls back to a full reload for this file.
// eslint-disable-next-line react/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
