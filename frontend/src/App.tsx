import { type FormEvent, useEffect, useState } from "react"

export interface CropListing {
  id: number
  farmer_name: string
  crop_name: string
  category: string
  quantity_kg: number
  price_per_kg: number
  location: string
  status: "available" | "reserved" | "sold"
  created_at: string
  updated_at: string
}

interface CropFormState {
  farmer_name: string
  crop_name: string
  category: string
  quantity_kg: string
  price_per_kg: string
  location: string
  status: "available" | "reserved" | "sold"
}

const EMPTY_FORM: CropFormState = {
  farmer_name: "",
  crop_name: "",
  category: "Vegetables",
  quantity_kg: "",
  price_per_kg: "",
  location: "",
  status: "available",
}

export default function App() {
  const [crops, setCrops] = useState<CropListing[]>([])
  const [selectedCrop, setSelectedCrop] = useState<CropListing | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<CropFormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  // READ LIST: GET /api/crops
  async function loadCrops() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/crops")
      if (!res.ok) throw new Error(`Failed to load crops (${res.status})`)
      const data: CropListing[] = await res.json()
      setCrops(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading crops")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCrops()
  }, [])

  // READ SINGLE: GET /api/crops/{id}
  async function handleViewSingle(id: number) {
    setError("")
    try {
      const res = await fetch(`/api/crops/${id}`)
      if (!res.ok) throw new Error(`Failed to fetch crop #${id} (${res.status})`)
      const data: CropListing = await res.json()
      setSelectedCrop(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching crop details")
    }
  }

  function startEdit(crop: CropListing) {
    setEditingId(crop.id)
    setNotice("")
    setError("")
    setForm({
      farmer_name: crop.farmer_name,
      crop_name: crop.crop_name,
      category: crop.category,
      quantity_kg: String(crop.quantity_kg),
      price_per_kg: String(crop.price_per_kg),
      location: crop.location,
      status: crop.status,
    })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  // CREATE (POST /api/crops) & UPDATE (PUT /api/crops/{id})
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError("")
    setNotice("")

    const payload = {
      farmer_name: form.farmer_name.trim(),
      crop_name: form.crop_name.trim(),
      category: form.category.trim(),
      quantity_kg: Number(form.quantity_kg),
      price_per_kg: Number(form.price_per_kg),
      location: form.location.trim(),
      status: form.status,
    }

    try {
      const isEdit = editingId !== null
      const url = isEdit ? `/api/crops/${editingId}` : "/api/crops"
      const method = isEdit ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        throw new Error(
          errBody?.detail ? JSON.stringify(errBody.detail) : `Request failed (${res.status})`
        )
      }

      const saved: CropListing = await res.json()
      setNotice(
        isEdit
          ? `Updated listing #${saved.id} (${saved.crop_name}) successfully.`
          : `Published new listing #${saved.id} (${saved.crop_name}) successfully.`
      )
      if (selectedCrop?.id === saved.id) {
        setSelectedCrop(saved)
      }
      cancelEdit()
      await loadCrops()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSubmitting(false)
    }
  }

  // DELETE: DELETE /api/crops/{id}
  async function handleDelete(id: number) {
    setError("")
    setNotice("")
    try {
      const res = await fetch(`/api/crops/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`Failed to delete #${id} (${res.status})`)
      if (selectedCrop?.id === id) {
        setSelectedCrop(null)
      }
      if (editingId === id) {
        cancelEdit()
      }
      setNotice(`Deleted crop listing #${id}.`)
      await loadCrops()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
    }
  }

  const availableCount = crops.filter((c) => c.status === "available").length
  const totalQuantityKg = crops.reduce((sum, c) => sum + Number(c.quantity_kg || 0), 0)
  const totalMarketValue = crops.reduce(
    (sum, c) => sum + Number(c.quantity_kg || 0) * Number(c.price_per_kg || 0),
    0
  )

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div>
            <span className="brand-badge">Direct Farm-to-Market Exchange</span>
            <h1>DigitalFarmers Produce Marketplace</h1>
            <p className="subtitle">
              Manage harvest inventory, unit pricing, and live availability across districts
            </p>
          </div>
          <button
            type="button"
            className="btn-light"
            onClick={() => void loadCrops()}
            disabled={loading}
          >
            {loading ? "Syncing..." : "Refresh Listings"}
          </button>
        </div>
      </header>

      <main className="mvp-container">
        <section className="stats-grid" aria-label="Marketplace Summary">
          <div className="stat-card">
            <span className="stat-label">Total Listings</span>
            <span className="stat-value">{crops.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Available Batches</span>
            <span className="stat-value">{availableCount}</span>
          </div>
          <div className="stat-card amber">
            <span className="stat-label">Total Stock</span>
            <span className="stat-value">{totalQuantityKg.toLocaleString()} kg</span>
          </div>
          <div className="stat-card amber">
            <span className="stat-label">Catalog Value</span>
            <span className="stat-value">৳{totalMarketValue.toLocaleString()}</span>
          </div>
        </section>

        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}

        <section className="panel">
          <div className="panel-header">
            <h2>{editingId !== null ? `Edit Crop Listing #${editingId}` : "Publish New Crop Listing"}</h2>
            <span className="panel-hint">
              {editingId !== null
                ? "Modify fields below and save changes"
                : "Enter harvest details to list produce"}
            </span>
          </div>

          <form className="crop-form" onSubmit={handleSubmit}>
            <div className="field-group">
              <label htmlFor="farmer_name">Farmer Name</label>
              <input
                id="farmer_name"
                value={form.farmer_name}
                onChange={(e) => setForm({ ...form, farmer_name: e.target.value })}
                placeholder="e.g., Karim Mia"
                required
              />
            </div>

            <div className="field-group">
              <label htmlFor="crop_name">Crop / Produce Name</label>
              <input
                id="crop_name"
                value={form.crop_name}
                onChange={(e) => setForm({ ...form, crop_name: e.target.value })}
                placeholder="e.g., Miniket Rice"
                required
              />
            </div>

            <div className="field-group">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="Vegetables">Vegetables</option>
                <option value="Grains">Grains</option>
                <option value="Fruits">Fruits</option>
                <option value="Spices">Spices</option>
                <option value="Pulses">Pulses</option>
              </select>
            </div>

            <div className="field-group">
              <label htmlFor="quantity_kg">Quantity (kg)</label>
              <input
                id="quantity_kg"
                type="number"
                step="0.01"
                min="0.01"
                value={form.quantity_kg}
                onChange={(e) => setForm({ ...form, quantity_kg: e.target.value })}
                placeholder="e.g., 150"
                required
              />
            </div>

            <div className="field-group">
              <label htmlFor="price_per_kg">Price per kg (BDT)</label>
              <input
                id="price_per_kg"
                type="number"
                step="0.01"
                min="0.01"
                value={form.price_per_kg}
                onChange={(e) => setForm({ ...form, price_per_kg: e.target.value })}
                placeholder="e.g., 60"
                required
              />
            </div>

            <div className="field-group">
              <label htmlFor="location">District / Location</label>
              <input
                id="location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g., Bogura"
                required
              />
            </div>

            <div className="field-group">
              <label htmlFor="status">Availability Status</label>
              <select
                id="status"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as CropFormState["status"] })
                }
              >
                <option value="available">Available</option>
                <option value="reserved">Reserved</option>
                <option value="sold">Sold</option>
              </select>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting
                  ? "Saving..."
                  : editingId !== null
                    ? "Save Changes"
                    : "Create Listing"}
              </button>
              {editingId !== null && (
                <button type="button" className="btn-secondary" onClick={cancelEdit}>
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </section>

        {selectedCrop && (
          <section className="panel detail-card">
            <div className="panel-header">
              <h2>
                Single Crop Inspection — #{selectedCrop.id} {selectedCrop.crop_name}
              </h2>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedCrop(null)}
              >
                Close Details
              </button>
            </div>

            <div className="detail-grid">
              <div className="detail-item">
                <span>Crop &amp; Category</span>
                <strong>
                  {selectedCrop.crop_name} ({selectedCrop.category})
                </strong>
              </div>
              <div className="detail-item">
                <span>Farmer</span>
                <strong>{selectedCrop.farmer_name}</strong>
              </div>
              <div className="detail-item">
                <span>District</span>
                <strong>{selectedCrop.location}</strong>
              </div>
              <div className="detail-item">
                <span>Available Quantity</span>
                <strong>{selectedCrop.quantity_kg} kg</strong>
              </div>
              <div className="detail-item">
                <span>Unit Price</span>
                <strong>৳{selectedCrop.price_per_kg} / kg</strong>
              </div>
              <div className="detail-item">
                <span>Status</span>
                <strong>{selectedCrop.status.toUpperCase()}</strong>
              </div>
            </div>

            <p className="meta-footer">
              Created: {new Date(selectedCrop.created_at).toLocaleString()} • Last Updated:{" "}
              {new Date(selectedCrop.updated_at).toLocaleString()}
            </p>
          </section>
        )}

        <section className="panel">
          <div className="panel-header">
            <h2>Active Produce Directory ({crops.length})</h2>
            <span className="panel-hint">Click View to inspect single record via GET /api/crops/:id</span>
          </div>

          {crops.length === 0 && !loading ? (
            <div className="empty-state">
              No crop listings available yet. Use the form above to publish the first harvest.
            </div>
          ) : (
            <div className="list-grid">
              {crops.map((crop) => (
                <article key={crop.id} className="crop-card">
                  <div>
                    <div className="crop-card-top">
                      <span className="crop-id">ID #{crop.id}</span>
                      <span className={`status-badge status-${crop.status}`}>
                        {crop.status}
                      </span>
                    </div>

                    <h3>{crop.crop_name}</h3>
                    <span className="category-tag">{crop.category}</span>

                    <p className="crop-meta">
                      <strong>Farmer:</strong> {crop.farmer_name}
                      <br />
                      <strong>Location:</strong> {crop.location}
                    </p>

                    <div className="price-row">
                      <span className="price-main">৳{crop.price_per_kg} / kg</span>
                      <span className="qty-text">{crop.quantity_kg} kg available</span>
                    </div>
                  </div>

                  <div className="card-actions">
                    <button
                      type="button"
                      className="btn-view"
                      onClick={() => void handleViewSingle(crop.id)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="btn-edit"
                      onClick={() => startEdit(crop)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-delete"
                      onClick={() => void handleDelete(crop.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  )
}