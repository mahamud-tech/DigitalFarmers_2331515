import { type FormEvent, useState } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export function RegisterPage() {
  const { user, restoring, register } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [district, setDistrict] = useState("Dhaka")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  if (!restoring && user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      await register({ full_name: fullName, email, district, password })
      navigate("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-wrapper">
      <section className="panel auth-card">
        <h2>Create DigitalFarmers Account</h2>
        <p className="panel-hint">Passwords are hashed with Argon2 + server-side pepper</p>
        {error && <div className="alert error">{error}</div>}
        <form onSubmit={handleSubmit} className="stack-form">
          <div className="field-group">
            <label htmlFor="fullName">Full Name</label>
            <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="field-group">
            <label htmlFor="regEmail">Email</label>
            <input id="regEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field-group">
            <label htmlFor="district">District</label>
            <input id="district" value={district} onChange={(e) => setDistrict(e.target.value)} required />
          </div>
          <div className="field-group">
            <label htmlFor="regPass">Password (min 8 characters)</label>
            <input
              id="regPass"
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  )
}