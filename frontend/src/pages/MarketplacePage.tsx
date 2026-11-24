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

interface GroupItem {
  id: string
  name: string
  my_permissions?: {
    can_create: boolean
    can_edit: boolean
    can_assign: boolean
    can_manage: boolean
  }
}

export function MarketplacePage() {
  const { user, reloadUser } = useAuth()

  // Crop state
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

      <section className="panel">
        <div className="panel-header">
          <h2>Create Crop Listing</h2>
          <span>Personal records or shared cooperative group records</span>
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
            <input type="number" min="1" step="any" value={quantityKg} onChange={(e) => setQuantityKg(e.target.value)} required />
          </div>
          <div className="field-group">
            <label>Price per kg (BDT)</label>
            <input type="number" min="1" step="any" value={pricePerKg} onChange={(e) => setPricePerKg(e.target.value)} required />
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
              {groups.map((g) => (
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
                <th>Crop</th>
                <th>Farmer</th>
                <th>Qty (kg)</th>
                <th>Price/kg</th>
                <th>District</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {crops.map((c) => (
                <tr key={c.id}>
                  <td>{c.crop_name} ({c.category})</td>
                  <td>{c.farmer_name}</td>
                  <td>{c.quantity_kg}</td>
                  <td>{c.price_per_kg}</td>
                  <td>{c.location}</td>
                  <td>{c.status}</td>
                  <td>
                    <button type="button" className="btn-delete" onClick={() => void handleDeleteCrop(c.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
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
    </main>
  )
}