import { createContext, type ReactNode, useContext, useEffect, useState } from "react"
import { apiFetch, apiJson, setAccessToken, setSessionExpiredHandler } from "../api/client"
import type { User } from "../types/models"

interface AuthContextValue {
  user: User | null
  restoring: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: { email: string; full_name: string; district: string; password: string }) => Promise<void>
  logout: () => Promise<void>
  reloadUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [restoring, setRestoring] = useState(true)

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setAccessToken(null)
      setUser(null)
    })

    async function restoreSession() {
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        })
        if (res.ok) {
          const data = await res.json()
          setAccessToken(data.access_token)
          setUser(data.user)
        } else {
          setAccessToken(null)
          setUser(null)
        }
      } catch {
        setAccessToken(null)
        setUser(null)
      } finally {
        setRestoring(false)
      }
    }

    void restoreSession()
  }, [])

  async function login(email: string, password: string) {
    const data = await apiJson<{ access_token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
    setAccessToken(data.access_token)
    setUser(data.user)
  }

  async function register(payload: { email: string; full_name: string; district: string; password: string }) {
    const data = await apiJson<{ access_token: string; user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    })
    setAccessToken(data.access_token)
    setUser(data.user)
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" }, false).catch(() => null)
    setAccessToken(null)
    setUser(null)
  }

  async function reloadUser() {
    const me = await apiJson<User>("/api/auth/me")
    setUser(me)
  }

  return (
    <AuthContext.Provider value={{ user, restoring, login, register, logout, reloadUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}