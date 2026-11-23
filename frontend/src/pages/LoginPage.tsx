import { type FormEvent, useState } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export function LoginPage() {
  const { user, restoring, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  if (!restoring && user) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/"} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      await login(email, password)
      navigate("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-wrapper">
      <section className="panel auth-card">
        <h2>Sign In to DigitalFarmers</h2>
        <p className="panel-hint">Short-lived JWT access tokens + httpOnly refresh rotation</p>
        {error && <div className="alert error">{error}</div>}
        <form onSubmit={handleSubmit} className="stack-form">
          <div className="field-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="karim@digitalfarmers.test"
              required
            />
          </div>
          <div className="field-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>
        <p className="auth-switch">
          New farmer or buyer? <Link to="/register">Create an account</Link>
        </p>
      </section>
    </main>
  )
}