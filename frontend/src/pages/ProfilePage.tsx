import { type FormEvent, useEffect, useState } from "react"
import { apiJson } from "../api/client"
import { useAuth } from "../context/AuthContext"
import type { UserSession } from "../types/models"

export function ProfilePage() {
  const { user, reloadUser } = useAuth()
  const [fullName, setFullName] = useState(user?.full_name || "")
  const [district, setDistrict] = useState(user?.district || "")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "")
      setDistrict(user.district || "")
    }
  }, [user])

  async function loadSessions() {
    try {
      const rows = await apiJson<UserSession[]>("/api/auth/sessions")
      setSessions(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions")
    }
  }

  useEffect(() => {
    void loadSessions()
  }, [])

  async function handleProfileUpdate(e: FormEvent) {
    e.preventDefault()
    setError("")
    setNotice("")
    try {
      await apiJson("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify({ full_name: fullName.trim(), district: district.trim() }),
      })
      await reloadUser()
      setNotice("Profile updated successfully.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed")
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault()
    setError("")
    setNotice("")
    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.")
      return
    }
    try {
      await apiJson("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setNotice("Password changed successfully.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password change failed")
    }
  }

  async function handleRevokeSession(sessionId: string) {
    setError("")
    setNotice("")
    try {
      await apiJson(`/api/auth/sessions/${sessionId}`, { method: "DELETE" })
      setNotice("Session revoked.")
      await loadSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed")
    }
  }

  return (
    <main className="mvp-container">
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      <section className="panel">
        <div className="panel-header">
          <h2>Profile Details ({user?.email})</h2>
          <span className="status-badge status-available">Role: {user?.role}</span>
        </div>
        <form className="crop-form" onSubmit={handleProfileUpdate}>
          <div className="field-group">
            <label>Full Name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="field-group">
            <label>District</label>
            <input value={district} onChange={(e) => setDistrict(e.target.value)} required />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">Update Profile</button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Change Password</h2>
        </div>
        <form className="crop-form" onSubmit={handleChangePassword}>
          <div className="field-group">
            <label>Current Password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div className="field-group">
            <label>New Password (min 8 chars)</label>
            <input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div className="field-group">
            <label>Confirm New Password</label>
            <input type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">Change Password</button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Active &amp; Recent Login Sessions ({sessions.length})</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>IP Address</th>
              <th>Browser / Device</th>
              <th>Created</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>{s.ip_address}</td>
                <td>{s.user_agent.slice(0, 48)}</td>
                <td>{new Date(s.created_at).toLocaleString()}</td>
                <td>{s.revoked ? "Revoked" : s.is_current ? "Current Active" : "Active"}</td>
                <td>
                  {!s.revoked && (
                    <button type="button" className="btn-delete" onClick={() => void handleRevokeSession(s.id)}>
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  )
}