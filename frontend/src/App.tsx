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
          ? `Updated listing #${saved.id} (${saved.crop_name})`
          : `Created listing #${saved.id} (${saved.crop_name})`
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
      setNotice(`Deleted listing #${id}`)
      await loadCrops()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
    }
  }

  return (
    <main className="mvp-container">
      <header className="mvp-header">
        <div>
          <h1>DigitalFarmers — Crop Listings MVP</h1>
          <p className="subtitle">Create, Read Single, Read List, Update, and Delete produce listings</p>
        </div>
        <button type="button" onClick={() => void loadCrops()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh List"}
        </button>
      </header>

      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      <section className="panel">
        <h2>{editingId !== null ? `Edit Crop Listing #${editingId}` : "Add New Crop Listing"}</h2>
        <form className="crop-form" onSubmit={handleSubmit}>
          <input
            value={form.farmer_name}
            onChange={(e) => setForm({ ...form, farmer_name: e.target.value })}
            placeholder="Farmer Name"
            required
          />
          <input
            value={form.crop_name}
            onChange={(e) => setForm({ ...form, crop_name: e.target.value })}
            placeholder="Crop Name (e.g., Aman Rice)"
            required
          />
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Category (e.g., Grains, Vegetables)"
            required
          />
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={form.quantity_kg}
            onChange={(e) => setForm({ ...form, quantity_kg: e.target.value })}
            placeholder="Quantity (kg)"
            required
          />
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={form.price_per_kg}
            onChange={(e) => setForm({ ...form, price_per_kg: e.target.value })}
            placeholder="Price per kg (BDT)"
            required
          />
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="District / Location"
            required
          />
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as CropFormState["status"] })}
          >
            <option value="available">available</option>
            <option value="reserved">reserved</option>
            <option value="sold">sold</option>
          </select>
          <div className="form-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : editingId !== null ? "Update Listing" : "Create Listing"}
            </button>
            {editingId !== null && (
              <button type="button" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {selectedCrop && (
        <section className="panel detail-card">
          <div className="detail-top">
            <h2>Single Crop Details (#{selectedCrop.id})</h2>
            <button type="button" onClick={() => setSelectedCrop(null)}>
              Close
            </button>
          </div>
          <p>
            <strong>Crop:</strong> {selectedCrop.crop_name} ({selectedCrop.category})
          </p>
          <p>
            <strong>Farmer:</strong> {selectedCrop.farmer_name} — {selectedCrop.location}
          </p>
          <p>
            <strong>Quantity:</strong> {selectedCrop.quantity_kg} kg @ ৳{selectedCrop.price_per_kg}/kg
          </p>
          <p>
            <strong>Status:</strong> {selectedCrop.status}
          </p>
          <p className="meta">
            Created: {selectedCrop.created_at} | Updated: {selectedCrop.updated_at}
          </p>
        </section>
      )}

      <section className="panel">
        <h2>All Crop Listings ({crops.length})</h2>
        {crops.length === 0 && !loading ? (
          <p>No crop listings found. Create one above.</p>
        ) : (
          <div className="list-grid">
            {crops.map((crop) => (
              <article key={crop.id} className="crop-card">
                <div>
                  <h3>
                    #{crop.id} {crop.crop_name}
                  </h3>
                  <p>
                    {crop.farmer_name} • {crop.location} • <strong>{crop.status}</strong>
                  </p>
                  <p>
                    {crop.quantity_kg} kg — <strong>৳{crop.price_per_kg}/kg</strong> ({crop.category})
                  </p>
                </div>
                <div className="card-actions">
                  <button type="button" onClick={() => void handleViewSingle(crop.id)}>
                    View
                  </button>
                  <button type="button" onClick={() => startEdit(crop)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => void handleDelete(crop.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}