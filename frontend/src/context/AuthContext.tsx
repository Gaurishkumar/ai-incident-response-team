'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiClientError } from '@/lib/api'
import type { UserResponse, LoginRequest, RegisterRequest } from '@/lib/types'

interface AuthContextValue {
  user: UserResponse | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (data: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<UserResponse>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // On mount: check if session is valid by hitting the stats endpoint (lightweight)
  useEffect(() => {
    const stored = sessionStorage.getItem('ops_user')
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        sessionStorage.removeItem('ops_user')
      }
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (data: LoginRequest) => {
    const result = await api.auth.login(data)
    setUser(result.user)
    sessionStorage.setItem('ops_user', JSON.stringify(result.user))
  }, [])

  const register = useCallback(async (data: RegisterRequest) => {
    return await api.auth.register(data)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.auth.logout()
    } catch {
      // Even if server-side logout fails, clear local state
    }
    setUser(null)
    sessionStorage.removeItem('ops_user')
    router.push('/login')
  }, [router])

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
