import { type FormEvent, useEffect, useState } from "react"
import { apiJson } from "../api/client"
import { useAuth } from "../context/AuthContext"
import type { CropListing, Group } from "../types/models"

export function MarketplacePage() {
  const { user } = useAuth()
  const [crops, setCrops] = useState<CropListing[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedCrop, setSelectedCrop] = useState<CropListing | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [farmerName, setFarmerName] = useState(user?.full_name || "")
  const [cropName, setCropName] = useState("")
  const [category, setCategory] = useState("Vegetables")
  const [quantityKg, setQuantityKg] = useState("")
  const [pricePerKg, setPricePerKg] = useState("")
  const [location, setLocation] = useState(user?.district || "")
  const [status, setStatus] = useState<"available" | "reserved" | "sold">("available")
  const [groupId, setGroupId] = useState("")
  const [assignedTo, setAssignedTo] = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  async function loadAll() {
    setLoading(true)
    setError("")
    try {
      const [cropRows, groupRows] = await Promise.all([
        apiJson<CropListing[]>("/api/crops"),
        apiJson<Group[]>("/api/groups"),
      ])
      setCrops(cropRows)
      setGroups(groupRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load listings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  function resetForm() {
    setEditingId(null)
    setFarmerName(user?.full_name || "")
    setCropName("")
    setCategory("Vegetables")
    setQuantityKg("")
    setPricePerKg("")
    setLocation(user?.district || "")
    setStatus("available")
    setGroupId("")
    setAssignedTo("")
  }

  function startEdit(c: CropListing) {
    setEditingId(c.id)
    setFarmerName(c.farmer_name)
    setCropName(c.crop_name)
    setCategory(c.category)
    setQuantityKg(String(c.quantity_kg))
    setPricePerKg(String(c.price_per_kg))
    setLocation(c.location)
    setStatus(c.status)
    setGroupId(c.group_id || "")
    setAssignedTo(c.assigned_to || "")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setNotice("")
    try {
      const payload: Record<string, unknown> = {
        farmer_name: farmerName,
        crop_name: cropName,
        category,
        quantity_kg: Number(quantityKg),
        price_per_kg: Number(pricePerKg),
        location,
        status,
        assigned_to: assignedTo || null,
      }
      if (!editingId) {
        payload.group_id = groupId || null
        const created = await apiJson<CropListing>("/api/crops", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        setNotice(`Created listing #${created.id} (${created.crop_name})`)
      } else {
        const updated = await apiJson<CropListing>(`/api/crops/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        })
        setNotice(`Updated listing #${updated.id}`)
      }
      resetForm()
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    }
  }

  async function handleViewSingle(id: number) {
    setError("")
    try {
      const item = await apiJson<CropListing>(`/api/crops/${id}`)
      setSelectedCrop(item)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to inspect listing")
    }
  }

  async function handleDelete(id: number) {
    setError("")
    setNotice("")
    try {
      await apiJson(`/api/crops/${id}`, { method: "DELETE" })
      if (selectedCrop?.id === id) setSelectedCrop(null)
      setNotice(`Deleted listing #${id}`)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete denied or failed")
    }
  }

  const activeGroup = groups.find((g) => g.id === groupId)

  return (
    <main className="mvp-container">
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      <section className="panel">
        <div className="panel-header">
          <h2>{editingId ? `Edit Crop Listing #${editingId}` : "Create Crop Listing"}</h2>
          <span className="panel-hint">Personal records or shared cooperative group records</span>
        </div>

        <form className="crop-form" onSubmit={handleSubmit}>
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
            <input type="number" step="0.01" min="0.01" value={quantityKg} onChange={(e) => setQuantityKg(e.target.value)} required />
          </div>
          <div className="field-group">
            <label>Price per kg (BDT)</label>
            <input type="number" step="0.01" min="0.01" value={pricePerKg} onChange={(e) => setPricePerKg(e.target.value)} required />
          </div>
          <div className="field-group">
            <label>District</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} required />
          </div>
          <div className="field-group">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as "available" | "reserved" | "sold")}>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="sold">Sold</option>
            </select>
          </div>
          <div className="field-group">
            <label>Scope / Shared Group</label>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} disabled={Boolean(editingId)}>
              <option value="">Personal Listing (Owner Only)</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  Group: {g.name}
                </option>
              ))}
            </select>
          </div>
          {activeGroup && (
            <div className="field-group">
              <label>Assign Member (Requires Assign Permission)</label>
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                <option value="">Unassigned</option>
                {activeGroup.members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name} ({m.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              {editingId ? "Update Listing" : "Create Listing"}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {selectedCrop && (
        <section className="panel detail-card">
          <div className="panel-header">
            <h2>Single Listing Details — #{selectedCrop.id} {selectedCrop.crop_name}</h2>
            <button type="button" className="btn-secondary" onClick={() => setSelectedCrop(null)}>
              Close
            </button>
          </div>
          <p>
            <strong>Farmer:</strong> {selectedCrop.farmer_name} • <strong>Location:</strong> {selectedCrop.location} •{" "}
            <strong>Price:</strong> ৳{selectedCrop.price_per_kg}/kg ({selectedCrop.quantity_kg} kg)
          </p>
          <p className="meta-footer">
            Scope: {selectedCrop.group_id ? `Group ${selectedCrop.group_id}` : "Personal"} • Assigned User:{" "}
            {selectedCrop.assigned_to || "None"}
          </p>
        </section>
      )}

      <section className="panel">
        <div className="panel-header">
          <h2>Accessible Crop Listings ({crops.length})</h2>
          <button type="button" className="btn-secondary" onClick={() => void loadAll()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {crops.length === 0 ? (
          <div className="empty-state">No crop listings visible for your account yet.</div>
        ) : (
          <div className="list-grid">
            {crops.map((c) => {
              const grp = groups.find((g) => g.id === c.group_id)
              return (
                <article key={c.id} className="crop-card">
                  <div>
                    <div className="crop-card-top">
                      <span className="crop-id">#{c.id}</span>
                      <span className={`status-badge status-${c.status}`}>{c.status}</span>
                    </div>
                    <h3>{c.crop_name}</h3>
                    <span className="category-tag">
                      {grp ? `Group: ${grp.name}` : "Personal Record"}
                    </span>
                    <p className="crop-meta">
                      <strong>Farmer:</strong> {c.farmer_name} ({c.location})
                      <br />
                      <strong>Assigned To:</strong>{" "}
                      {grp?.members.find((m) => m.user_id === c.assigned_to)?.full_name || "Unassigned"}
                    </p>
                    <div className="price-row">
                      <span className="price-main">৳{c.price_per_kg}/kg</span>
                      <span className="qty-text">{c.quantity_kg} kg</span>
                    </div>
                  </div>
                  <div className="card-actions">
                    <button type="button" className="btn-view" onClick={() => void handleViewSingle(c.id)}>
                      View
                    </button>
                    <button type="button" className="btn-edit" onClick={() => startEdit(c)}>
                      Edit
                    </button>
                    <button type="button" className="btn-delete" onClick={() => void handleDelete(c.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}