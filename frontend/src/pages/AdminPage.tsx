import { useEffect, useState } from "react"
import { apiFetch, apiJson } from "../api/client"
import type { AuditLog, CropListing, Group, User } from "../types/models"

export function AdminPage() {
  const [tab, setTab] = useState<"users" | "content" | "audit" | "security">("users")
  const [overview, setOverview] = useState<Record<string, number>>({})
  const [users, setUsers] = useState<User[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [page, setPage] = useState(1)
  const [userSearch, setUserSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [userDetail, setUserDetail] = useState<any>(null)

  const [crops, setCrops] = useState<CropListing[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedCropIds, setSelectedCropIds] = useState<number[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [logAction, setLogAction] = useState("all")
  const [logSearch, setLogSearch] = useState("")

  const [securityData, setSecurityData] = useState<any>({ by_ip: [], by_account: [], recent_failures: [] })
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  async function loadOverview() {
    const data = await apiJson<Record<string, number>>("/api/admin/overview")
    setOverview(data)
  }

  async function loadUsers() {
    const params = new URLSearchParams({
      search: userSearch,
      role: roleFilter,
      status: statusFilter,
      page: String(page),
      page_size: "10",
    })
    const res = await apiJson<{ items: User[]; total: number }>(`/api/admin/users?${params.toString()}`)
    setUsers(res.items)
    setTotalUsers(res.total)
  }

  async function loadContent() {
    const res = await apiJson<{ crops: CropListing[]; groups: Group[] }>("/api/admin/content")
    setCrops(res.crops)
    setGroups(res.groups)
  }

  async function loadAudit() {
    const params = new URLSearchParams({ action: logAction, search: logSearch })
    const rows = await apiJson<AuditLog[]>(`/api/admin/audit-logs?${params.toString()}`)
    setLogs(rows)
  }

  async function loadSecurity() {
    const data = await apiJson("/api/admin/security")
    setSecurityData(data)
  }

  useEffect(() => {
    void loadOverview()
    void loadUsers()
  }, [page, userSearch, roleFilter, statusFilter])

  useEffect(() => {
    if (tab === "content") void loadContent()
    if (tab === "audit") void loadAudit()
    if (tab === "security") void loadSecurity()
  }, [tab, logAction, logSearch])

  async function inspectUser(userId: string) {
    setError("")
    try {
      const detail = await apiJson(`/api/admin/users/${userId}`)
      setUserDetail(detail)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user details")
    }
  }

  async function handleBanToggle(u: User) {
    setError("")
    setNotice("")
    try {
      if (u.is_banned) {
        await apiJson(`/api/admin/users/${u.id}/unban`, { method: "POST" })
        setNotice(`Unbanned ${u.email}`)
      } else {
        const reason = window.prompt("Enter ban reason:", "Violation of marketplace rules")
        if (!reason) return
        await apiJson(`/api/admin/users/${u.id}/ban`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        })
        setNotice(`Banned ${u.email}`)
      }
      await Promise.all([loadUsers(), loadOverview()])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed")
    }
  }

  async function handleRoleToggle(u: User) {
    setError("")
    setNotice("")
    try {
      const nextRole = u.role === "admin" ? "user" : "admin"
      await apiJson(`/api/admin/users/${u.id}/role`, {
        method: "POST",
        body: JSON.stringify({ role: nextRole }),
      })
      setNotice(`Changed ${u.email} role to ${nextRole}`)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role change blocked")
    }
  }

  async function handleRevokeSessions(userId: string) {
    setError("")
    try {
      await apiJson(`/api/admin/users/${userId}/revoke-sessions`, { method: "POST" })
      setNotice("Revoked all sessions for user.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke sessions")
    }
  }

  async function handleBulkBan(ban: boolean) {
    if (selectedUserIds.length === 0) return
    setError("")
    try {
      await apiJson("/api/admin/users/bulk-ban", {
        method: "POST",
        body: JSON.stringify({ user_ids: selectedUserIds, ban, reason: "Bulk admin moderation" }),
      })
      setSelectedUserIds([])
      setNotice(`Bulk ${ban ? "ban" : "unban"} completed.`)
      await Promise.all([loadUsers(), loadOverview()])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk action failed")
    }
  }

  async function handleBulkDeleteCrops() {
    if (selectedCropIds.length === 0) return
    await apiJson("/api/admin/crops/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids: selectedCropIds }),
    })
    setSelectedCropIds([])
    setNotice("Deleted selected crop listings.")
    await Promise.all([loadContent(), loadOverview()])
  }

  async function handleBulkDeleteGroups() {
    if (selectedGroupIds.length === 0) return
    await apiJson("/api/admin/groups/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids: selectedGroupIds }),
    })
    setSelectedGroupIds([])
    setNotice("Deleted selected groups.")
    await Promise.all([loadContent(), loadOverview()])
  }

  async function downloadCsv(kind: "users" | "records" | "activity") {
    const params = new URLSearchParams()
    if (kind === "users") {
      params.set("search", userSearch)
      params.set("role", roleFilter)
      params.set("status", statusFilter)
    } else if (kind === "activity") {
      params.set("action", logAction)
      params.set("search", logSearch)
    }
    const res = await apiFetch(`/api/admin/export/${kind}?${params.toString()}`)
    if (!res.ok) {
      setError("CSV export failed")
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `digitalfarmers_${kind}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="mvp-container">
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      <section className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Users (7d New: {overview.new_users_7d ?? 0})</span>
          <span className="stat-value">{overview.total_users ?? 0}</span>
        </div>
        <div className="stat-card amber">
          <span className="stat-label">Banned Users</span>
          <span className="stat-value">{overview.banned_users ?? 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Crop Records (7d: {overview.new_records_7d ?? 0})</span>
          <span className="stat-value">{overview.total_records ?? 0}</span>
        </div>
        <div className="stat-card amber">
          <span className="stat-label">Groups (7d: {overview.new_groups_7d ?? 0})</span>
          <span className="stat-value">{overview.total_groups ?? 0}</span>
        </div>
      </section>

      <div className="tab-bar">
        <button type="button" className={tab === "users" ? "btn-primary" : "btn-secondary"} onClick={() => setTab("users")}>
          Users &amp; Roles
        </button>
        <button type="button" className={tab === "content" ? "btn-primary" : "btn-secondary"} onClick={() => setTab("content")}>
          Content Moderation
        </button>
        <button type="button" className={tab === "audit" ? "btn-primary" : "btn-secondary"} onClick={() => setTab("audit")}>
          Activity Audit Log
        </button>
        <button type="button" className={tab === "security" ? "btn-primary" : "btn-secondary"} onClick={() => setTab("security")}>
          Security &amp; Failed Logins
        </button>
      </div>

      {tab === "users" && (
        <section className="panel">
          <div className="panel-header">
            <h2>Users ({totalUsers})</h2>
            <div className="card-actions-inline">
              <button type="button" className="btn-delete" onClick={() => void handleBulkBan(true)}>
                Bulk Ban ({selectedUserIds.length})
              </button>
              <button type="button" className="btn-view" onClick={() => void handleBulkBan(false)}>
                Bulk Unban
              </button>
              <button type="button" className="btn-secondary" onClick={() => void downloadCsv("users")}>
                Export Users CSV
              </button>
            </div>
          </div>

          <div className="crop-form" style={{ marginBottom: "1rem" }}>
            <input
              placeholder="Search email, name, district..."
              value={userSearch}
              onChange={(e) => { setPage(1); setUserSearch(e.target.value) }}
            />
            <select value={roleFilter} onChange={(e) => { setPage(1); setRoleFilter(e.target.value) }}>
              <option value="all">All Roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value) }}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="banned">Banned</option>
            </select>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Name &amp; Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(u.id)}
                      onChange={(e) =>
                        setSelectedUserIds((prev) =>
                          e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                        )
                      }
                    />
                  </td>
                  <td>
                    <strong>{u.full_name}</strong>
                    <br />
                    <small>{u.email}</small>
                  </td>
                  <td>{u.role}</td>
                  <td>{u.is_banned ? `BANNED (${u.ban_reason || ""})` : "Active"}</td>
                  <td className="card-actions-inline">
                    <button type="button" className="btn-view" onClick={() => void inspectUser(u.id)}>Detail</button>
                    <button type="button" className="btn-edit" onClick={() => void handleRoleToggle(u)}>Role</button>
                    <button type="button" className="btn-delete" onClick={() => void handleBanToggle(u)}>
                      {u.is_banned ? "Unban" : "Ban"}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => void handleRevokeSessions(u.id)}>
                      Revoke Sessions
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="form-actions" style={{ marginTop: "1rem" }}>
            <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Prev
            </button>
            <span>Page {page}</span>
            <button type="button" className="btn-secondary" disabled={page * 10 >= totalUsers} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>

          {userDetail && (
            <div className="panel detail-card" style={{ marginTop: "1rem" }}>
              <div className="panel-header">
                <h3>User Detail: {userDetail.user.full_name} ({userDetail.user.email})</h3>
                <button type="button" className="btn-secondary" onClick={() => setUserDetail(null)}>Close</button>
              </div>
              <p>
                <strong>Records:</strong> {userDetail.records.length} •{" "}
                <strong>Groups:</strong> {userDetail.groups.length} •{" "}
                <strong>Sessions:</strong> {userDetail.sessions.length} •{" "}
                <strong>Recent Logs:</strong> {userDetail.activity.length}
              </p>
            </div>
          )}
        </section>
      )}

      {tab === "content" && (
        <section className="panel">
          <div className="panel-header">
            <h2>All Crop Listings ({crops.length}) &amp; Groups ({groups.length})</h2>
            <div className="card-actions-inline">
              <button type="button" className="btn-delete" onClick={() => void handleBulkDeleteCrops()}>
                Delete Selected Crops ({selectedCropIds.length})
              </button>
              <button type="button" className="btn-delete" onClick={() => void handleBulkDeleteGroups()}>
                Delete Selected Groups ({selectedGroupIds.length})
              </button>
              <button type="button" className="btn-secondary" onClick={() => void downloadCsv("records")}>
                Export Records CSV
              </button>
            </div>
          </div>

          <h3>Crop Listings</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>ID</th>
                <th>Crop</th>
                <th>Farmer</th>
                <th>Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {crops.map((c) => (
                <tr key={c.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedCropIds.includes(c.id)}
                      onChange={(e) =>
                        setSelectedCropIds((prev) =>
                          e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                        )
                      }
                    />
                  </td>
                  <td>#{c.id}</td>
                  <td>{c.crop_name}</td>
                  <td>{c.farmer_name}</td>
                  <td>৳{c.price_per_kg}/kg</td>
                  <td>{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ marginTop: "1.5rem" }}>Groups</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Group Name</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedGroupIds.includes(g.id)}
                      onChange={(e) =>
                        setSelectedGroupIds((prev) =>
                          e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id)
                        )
                      }
                    />
                  </td>
                  <td>{g.name}</td>
                  <td>{g.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "audit" && (
        <section className="panel">
          <div className="panel-header">
            <h2>System Activity &amp; Audit Log ({logs.length})</h2>
            <button type="button" className="btn-secondary" onClick={() => void downloadCsv("activity")}>
              Export Activity CSV
            </button>
          </div>
          <div className="crop-form" style={{ marginBottom: "1rem" }}>
            <input placeholder="Search user, IP, details..." value={logSearch} onChange={(e) => setLogSearch(e.target.value)} />
            <select value={logAction} onChange={(e) => setLogAction(e.target.value)}>
              <option value="all">All Events</option>
              <option value="login">login</option>
              <option value="failed_login">failed_login</option>
              <option value="logout">logout</option>
              <option value="password_change">password_change</option>
              <option value="role_change">role_change</option>
              <option value="ban">ban</option>
              <option value="unban">unban</option>
              <option value="delete">delete</option>
              <option value="export">export</option>
            </select>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Details</th>
                <th>IP &amp; Browser</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.created_at).toLocaleString()}</td>
                  <td>{l.user_email}</td>
                  <td><strong>{l.action}</strong></td>
                  <td>{l.details}</td>
                  <td>
                    {l.ip_address}
                    <br />
                    <small>{l.user_agent.slice(0, 40)}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "security" && (
        <section className="panel">
          <h2>Failed Login Security Monitor</h2>
          <div className="detail-grid">
            <div>
              <h3>Failed Logins by IP</h3>
              <table className="data-table">
                <thead>
                  <tr><th>IP Address</th><th>Attempts</th></tr>
                </thead>
                <tbody>
                  {securityData.by_ip.map((r: any) => (
                    <tr key={r.ip_address}><td>{r.ip_address}</td><td>{r.count}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3>Failed Logins by Account</h3>
              <table className="data-table">
                <thead>
                  <tr><th>Account Email</th><th>Attempts</th></tr>
                </thead>
                <tbody>
                  {securityData.by_account.map((r: any) => (
                    <tr key={r.email}><td>{r.email}</td><td>{r.count}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}