import { type FormEvent, useEffect, useState } from "react"
import { apiJson } from "../api/client"
import { useAuth } from "../context/AuthContext"

interface CropItem {
  id: number
  owner_id: string
  group_id?: string | null
  assigned_to?: string | null
  farmer_name: string
  crop_name: string
  category: string
  quantity_kg: number
  price_per_kg: number
  location: string
  status: string
}

interface GroupMember {
  user_id: string
  email: string
  full_name: string
  can_create: boolean
  can_edit: boolean
  can_assign: boolean
  can_manage: boolean
}

interface GroupItem {
  id: string
  name: string
  my_permissions?: {
    can_create: boolean
    can_edit: boolean
    can_assign: boolean
    can_manage: boolean
  }
  members?: GroupMember[]
}

export function MarketplacePage() {
  const { user, reloadUser } = useAuth()

  // Crop & Group state
  const [crops, setCrops] = useState<CropItem[]>([])
  const [groups, setGroups] = useState<GroupItem[]>([])
  const [farmerName, setFarmerName] = useState(user?.full_name || "")
  const [cropName, setCropName] = useState("")
  const [category, setCategory] = useState("Vegetables")
  const [quantityKg, setQuantityKg] = useState("")
  const [pricePerKg, setPricePerKg] = useState("")
  const [location, setLocation] = useState(user?.district || "Dhaka")
  const [status, setStatus] = useState("available")
  const [groupId, setGroupId] = useState("")

  // Inline Edit state (for Owner / Editor+Creator)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editCropName, setEditCropName] = useState("")
  const [editQty, setEditQty] = useState("")
  const [editPrice, setEditPrice] = useState("")
  const [editStatus, setEditStatus] = useState("available")

  // Profile & Password state
  const [fullName, setFullName] = useState(user?.full_name || "")
  const [district, setDistrict] = useState(user?.district || "")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    if (user) {
      setFarmerName(user.full_name || "")
      setLocation(user.district || "Dhaka")
      setFullName(user.full_name || "")
      setDistrict(user.district || "Dhaka")
    }
  }, [user])

  async function loadData() {
    try {
      const [cropRows, groupRows] = await Promise.all([
        apiJson<CropItem[]>("/api/crops"),
        apiJson<GroupItem[]>("/api/groups").catch(() => []),
      ])
      setCrops(cropRows)
      setGroups(groupRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  function getCropPermissions(crop: CropItem) {
    if (user?.role === "admin") {
      return { canEdit: true, canAssign: true, canDelete: true, label: "Admin (Full Access)" }
    }
    if (!crop.group_id) {
      const isOwner = crop.owner_id === user?.id
      return {
        canEdit: isOwner,
        canAssign: isOwner,
        canDelete: isOwner,
        label: "Personal Listing",
      }
    }
    const grp = groups.find((g) => g.id === crop.group_id)
    const perms = grp?.my_permissions
    if (!perms) {
      const isOwner = crop.owner_id === user?.id
      return {
        canEdit: isOwner,
        canAssign: isOwner,
        canDelete: isOwner,
        label: grp?.name || "Co-op Group",
      }
    }
    // Karim (Owner/Manage): Create + Edit + Assign + Delete
    // Salma (Editor+Creator): Create + Edit only (no Assign, no Delete)
    // Rafiq (Assign-Only): Assign only (no Create, no Edit, no Delete)
    return {
      canEdit: Boolean(perms.can_edit || perms.can_manage),
      canAssign: Boolean(perms.can_assign || perms.can_manage),
      canDelete: Boolean(perms.can_manage),
      label: `Group: ${grp?.name || "Co-op"}`,
    }
  }

  const creatableGroups = groups.filter(
    (g) => user?.role === "admin" || g.my_permissions?.can_create || g.my_permissions?.can_manage
  )

  const isAssignOnlyUser =
    user?.role !== "admin" &&
    groups.length > 0 &&
    groups.every(
      (g) =>
        Boolean(g.my_permissions?.can_assign) &&
        !g.my_permissions?.can_create &&
        !g.my_permissions?.can_edit &&
        !g.my_permissions?.can_manage
    )

  async function handleCreateCrop(e: FormEvent) {
    e.preventDefault()
    setError("")
    setNotice("")
    try {
      await apiJson("/api/crops", {
        method: "POST",
        body: JSON.stringify({
          farmer_name: farmerName.trim(),
          crop_name: cropName.trim(),
          category,
          quantity_kg: Number(quantityKg),
          price_per_kg: Number(pricePerKg),
          location: location.trim(),
          status,
          group_id: groupId || null,
        }),
      })
      setCropName("")
      setQuantityKg("")
      setPricePerKg("")
      setNotice("Crop listing created.")
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create listing")
    }
  }

  function startEdit(crop: CropItem) {
    setEditingId(crop.id)
    setEditCropName(crop.crop_name)
    setEditQty(String(crop.quantity_kg))
    setEditPrice(String(crop.price_per_kg))
    setEditStatus(crop.status)
  }

  async function handleSaveEdit(id: number) {
    setError("")
    setNotice("")
    try {
      await apiJson(`/api/crops/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          crop_name: editCropName.trim(),
          quantity_kg: Number(editQty),
          price_per_kg: Number(editPrice),
          status: editStatus,
        }),
      })
      setEditingId(null)
      setNotice("Crop listing updated.")
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update listing")
    }
  }

  async function handleAssignCrop(id: number, assignedTo: string) {
    setError("")
    setNotice("")
    try {
      await apiJson(`/api/crops/${id}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ assigned_to: assignedTo || null }),
      })
      setNotice("Crop assignment updated.")
      await loadData()
    } catch (err) {
      try {
        await apiJson(`/api/crops/${id}`, {
          method: "PUT",
          body: JSON.stringify({ assigned_to: assignedTo || null }),
        })
        setNotice("Crop assignment updated.")
        await loadData()
      } catch (err2) {
        setError(err2 instanceof Error ? err2.message : err instanceof Error ? err.message : "Assignment failed")
      }
    }
  }

  async function handleDeleteCrop(id: number) {
    setError("")
    setNotice("")
    try {
      await apiJson(`/api/crops/${id}`, { method: "DELETE" })
      setNotice("Crop listing deleted.")
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
    }
  }

  async function handleUpdateProfile(e: FormEvent) {
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
      setError(err instanceof Error ? err.message : "Profile update failed")
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

  return (
    <main className="mvp-container">
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      {!isAssignOnlyUser && (
        <section className="panel">
          <div className="panel-header">
            <h2>Create Crop Listing</h2>
            <span>
              {creatableGroups.length > 0
                ? "Personal records or shared cooperative group records"
                : "Personal records (you do not have group-create permission)"}
            </span>
          </div>
          <form className="crop-form" onSubmit={handleCreateCrop}>
            <div className="field-group">
              <label>Farmer Name</label>
              <input value={farmerName} onChange={(e) => setFarmerName(e.target.value)} required />
            </div>
            <div className="field-group">
              <label>Crop Name</label>
              <input value={cropName} onChange={(e) => setCropName(e.target.value)} required />
            </div>
            <div className="field-group">
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="Vegetables">Vegetables</option>
                <option value="Grains">Grains</option>
                <option value="Fruits">Fruits</option>
                <option value="Spices">Spices</option>
              </select>
            </div>
            <div className="field-group">
              <label>Quantity (kg)</label>
              <input
                type="number"
                min="1"
                step="any"
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
                required
              />
            </div>
            <div className="field-group">
              <label>Price per kg (BDT)</label>
              <input
                type="number"
                min="1"
                step="any"
                value={pricePerKg}
                onChange={(e) => setPricePerKg(e.target.value)}
                required
              />
            </div>
            <div className="field-group">
              <label>District</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} required />
            </div>
            <div className="field-group">
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="available">Available</option>
                <option value="reserved">Reserved</option>
                <option value="sold">Sold</option>
              </select>
            </div>
            <div className="field-group">
              <label>Scope / Shared Group</label>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">Personal Listing (Owner Only)</option>
                {creatableGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    Group: {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary">Create Listing</button>
            </div>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="panel-header">
          <h2>Accessible Crop Listings ({crops.length})</h2>
          <button type="button" className="btn-light" onClick={() => void loadData()}>
            Refresh
          </button>
        </div>
        {crops.length === 0 ? (
          <p>No crop listings visible for your account yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Crop &amp; Scope</th>
                <th>Farmer</th>
                <th>Qty (kg)</th>
                <th>Price/kg</th>
                <th>District</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {crops.map((c) => {
                const perms = getCropPermissions(c)
                const grp = groups.find((g) => g.id === c.group_id)
                const isEditing = editingId === c.id

                return (
                  <tr key={c.id}>
                    <td>
                      {isEditing ? (
                        <input value={editCropName} onChange={(e) => setEditCropName(e.target.value)} />
                      ) : (
                        <>
                          <strong>{c.crop_name}</strong> ({c.category})
                          <div style={{ fontSize: "0.78rem", color: "#58665c" }}>{perms.label}</div>
                        </>
                      )}
                    </td>
                    <td>{c.farmer_name}</td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          step="any"
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          style={{ width: "85px" }}
                        />
                      ) : (
                        c.quantity_kg
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          step="any"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          style={{ width: "85px" }}
                        />
                      ) : (
                        c.price_per_kg
                      )}
                    </td>
                    <td>{c.location}</td>
                    <td>
                      {isEditing ? (
                        <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                          <option value="available">Available</option>
                          <option value="reserved">Reserved</option>
                          <option value="sold">Sold</option>
                        </select>
                      ) : (
                        <span className={`status-badge status-${c.status}`}>{c.status}</span>
                      )}
                    </td>
                    <td>
                      {perms.canAssign && grp?.members && grp.members.length > 0 ? (
                        <select
                          value={c.assigned_to || ""}
                          onChange={(e) => void handleAssignCrop(c.id, e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {grp.members.map((m) => (
                            <option key={m.user_id} value={m.user_id}>
                              {m.full_name} ({m.email})
                            </option>
                          ))}
                        </select>
                      ) : perms.canAssign && c.group_id ? (
                        <button
                          type="button"
                          className="btn-light"
                          onClick={() =>
                            void handleAssignCrop(c.id, c.assigned_to === user?.id ? "" : user?.id || "")
                          }
                        >
                          {c.assigned_to === user?.id ? "Unassign Me" : "Assign to Me"}
                        </button>
                      ) : (
                        <span style={{ fontSize: "0.84rem", color: "#58665c" }}>
                          {c.assigned_to ? "Assigned" : "Unassigned"}
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        {perms.canEdit && !isEditing && (
                          <button type="button" className="btn-light" onClick={() => startEdit(c)}>
                            Edit
                          </button>
                        )}
                        {perms.canEdit && isEditing && (
                          <>
                            <button type="button" className="btn-primary" onClick={() => void handleSaveEdit(c.id)}>
                              Save
                            </button>
                            <button type="button" className="btn-light" onClick={() => setEditingId(null)}>
                              Cancel
                            </button>
                          </>
                        )}
                        {perms.canDelete && (
                          <button type="button" className="btn-delete" onClick={() => void handleDeleteCrop(c.id)}>
                            Delete
                          </button>
                        )}
                        {!perms.canEdit && !perms.canDelete && perms.canAssign && (
                          <span style={{ fontSize: "0.78rem", color: "#58665c" }}>Assign-only</span>
                        )}
                        {!perms.canEdit && !perms.canDelete && !perms.canAssign && (
                          <span style={{ fontSize: "0.78rem", color: "#58665c" }}>View-only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Profile &amp; Password Settings ({user?.email})</h2>
          <span className="status-badge status-available">Role: {user?.role}</span>
        </div>
        <form className="crop-form" onSubmit={handleUpdateProfile}>
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

        <hr style={{ margin: "1.25rem 0" }} />

        <form className="crop-form" onSubmit={handleChangePassword}>
          <div className="field-group">
            <label>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="field-group">
            <label>New Password (min 8 chars)</label>
            <input
              type="password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="field-group">
            <label>Confirm New Password</label>
            <input
              type="password"
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">Change Password</button>
          </div>
        </form>
      </section>
    </main>
  )
}