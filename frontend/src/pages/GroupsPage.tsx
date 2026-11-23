import { type FormEvent, useEffect, useState } from "react"
import { apiJson } from "../api/client"
import type { Group } from "../types/models"

export function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [memberEmail, setMemberEmail] = useState("")
  const [canCreate, setCanCreate] = useState(true)
  const [canEdit, setCanEdit] = useState(false)
  const [canAssign, setCanAssign] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState("")
  const [renameText, setRenameText] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  async function loadGroups() {
    try {
      const data = await apiJson<Group[]>("/api/groups")
      setGroups(data)
      if (!selectedGroupId && data.length > 0) setSelectedGroupId(data[0].id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load groups")
    }
  }

  useEffect(() => {
    void loadGroups()
  }, [])

  async function handleCreateGroup(e: FormEvent) {
    e.preventDefault()
    setError("")
    setNotice("")
    try {
      await apiJson("/api/groups", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      })
      setName("")
      setDescription("")
      setNotice("Created new cooperative group.")
      await loadGroups()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group")
    }
  }

  async function handleAddMember(e: FormEvent) {
    e.preventDefault()
    if (!selectedGroupId) return
    setError("")
    setNotice("")
    try {
      await apiJson(`/api/groups/${selectedGroupId}/members`, {
        method: "POST",
        body: JSON.stringify({
          user_email: memberEmail,
          can_create: canCreate,
          can_edit: canEdit,
          can_assign: canAssign,
        }),
      })
      setMemberEmail("")
      setNotice("Updated group member permissions.")
      await loadGroups()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Member update failed")
    }
  }

  async function handleRename(groupId: string) {
    if (!renameText.trim()) return
    setError("")
    try {
      await apiJson(`/api/groups/${groupId}`, {
        method: "PUT",
        body: JSON.stringify({ name: renameText }),
      })
      setRenameText("")
      setNotice("Group renamed.")
      await loadGroups()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rename failed")
    }
  }

  async function handleDeleteGroup(groupId: string) {
    setError("")
    try {
      await apiJson(`/api/groups/${groupId}`, { method: "DELETE" })
      setNotice("Group deleted.")
      await loadGroups()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
    }
  }

  async function handleRemoveMember(groupId: string, userId: string) {
    setError("")
    try {
      await apiJson(`/api/groups/${groupId}/members/${userId}`, { method: "DELETE" })
      setNotice("Member removed.")
      await loadGroups()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member")
    }
  }

  return (
    <main className="mvp-container">
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      <section className="panel">
        <div className="panel-header">
          <h2>Create Farming Cooperative / Group</h2>
          <span className="panel-hint">Only the owner can rename, delete, or manage member permissions</span>
        </div>
        <form className="crop-form" onSubmit={handleCreateGroup}>
          <div className="field-group">
            <label>Group Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Sylhet Tea Growers" required />
          </div>
          <div className="field-group">
            <label>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Shared crop inventory" />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">Create Group</button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Manage Group Members &amp; Permissions (Owner Only)</h2>
        </div>
        <form className="crop-form" onSubmit={handleAddMember}>
          <div className="field-group">
            <label>Select Group</label>
            <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label>Member Email</label>
            <input type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="salma@digitalfarmers.test" required />
          </div>
          <div className="field-group">
            <label>Permissions</label>
            <div className="checkbox-row">
              <label><input type="checkbox" checked={canCreate} onChange={(e) => setCanCreate(e.target.checked)} /> Create</label>
              <label><input type="checkbox" checked={canEdit} onChange={(e) => setCanEdit(e.target.checked)} /> Edit</label>
              <label><input type="checkbox" checked={canAssign} onChange={(e) => setCanAssign(e.target.checked)} /> Assign</label>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">Add / Update Member</button>
          </div>
        </form>
      </section>

      {groups.map((g) => (
        <section key={g.id} className="panel">
          <div className="panel-header">
            <div>
              <h2>{g.name}</h2>
              <p className="panel-hint">{g.description} • Owner: {g.owner_name}</p>
            </div>
            {g.my_permissions.can_manage && (
              <div className="card-actions-inline">
                <input
                  value={renameText}
                  onChange={(e) => setRenameText(e.target.value)}
                  placeholder="New group name"
                />
                <button type="button" className="btn-edit" onClick={() => void handleRename(g.id)}>Rename</button>
                <button type="button" className="btn-delete" onClick={() => void handleDeleteGroup(g.id)}>Delete Group</button>
              </div>
            )}
          </div>

          <p>
            <strong>Your Effective Permissions:</strong>{" "}
            {g.my_permissions.can_create ? "Create " : ""}
            {g.my_permissions.can_edit ? "Edit " : ""}
            {g.my_permissions.can_assign ? "Assign " : ""}
            {g.my_permissions.can_manage ? "(Owner Management)" : "(Read-Only / Member)"}
          </p>

          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Email</th>
                <th>Role</th>
                <th>Create</th>
                <th>Edit</th>
                <th>Assign</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {g.members.map((m) => (
                <tr key={m.id}>
                  <td>{m.full_name}</td>
                  <td>{m.email}</td>
                  <td>{m.member_role}</td>
                  <td>{m.can_create ? "Yes" : "No"}</td>
                  <td>{m.can_edit ? "Yes" : "No"}</td>
                  <td>{m.can_assign ? "Yes" : "No"}</td>
                  <td>
                    {g.my_permissions.can_manage && m.member_role !== "owner" && (
                      <button
                        type="button"
                        className="btn-delete"
                        onClick={() => void handleRemoveMember(g.id, m.user_id)}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </main>
  )
}