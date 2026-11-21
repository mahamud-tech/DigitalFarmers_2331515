from datetime import datetime, timezone
import os
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
import httpx
from pydantic import BaseModel, Field

load_dotenv()

app = FastAPI(title="DigitalFarmers API")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")


class CropBase(BaseModel):
    farmer_name: str = Field(..., min_length=2, max_length=120)
    crop_name: str = Field(..., min_length=2, max_length=120)
    category: str = Field(default="Vegetables", min_length=2, max_length=60)
    quantity_kg: float = Field(..., gt=0)
    price_per_kg: float = Field(..., gt=0)
    location: str = Field(..., min_length=2, max_length=120)
    status: Literal["available", "reserved", "sold"] = "available"


class CropCreate(CropBase):
    pass


class CropUpdate(BaseModel):
    farmer_name: str | None = Field(default=None, min_length=2, max_length=120)
    crop_name: str | None = Field(default=None, min_length=2, max_length=120)
    category: str | None = Field(default=None, min_length=2, max_length=60)
    quantity_kg: float | None = Field(default=None, gt=0)
    price_per_kg: float | None = Field(default=None, gt=0)
    location: str | None = Field(default=None, min_length=2, max_length=120)
    status: Literal["available", "reserved", "sold"] | None = None


class CropResponse(CropBase):
    id: int
    created_at: str
    updated_at: str


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


_crops_db: list[dict] = [
    {
        "id": 1,
        "farmer_name": "Karim Mia",
        "crop_name": "Miniket Rice",
        "category": "Grains",
        "quantity_kg": 250.0,
        "price_per_kg": 62.0,
        "location": "Dinajpur",
        "status": "available",
        "created_at": _now(),
        "updated_at": _now(),
    },
    {
        "id": 2,
        "farmer_name": "Salma Begum",
        "crop_name": "Deshi Tomato",
        "category": "Vegetables",
        "quantity_kg": 80.0,
        "price_per_kg": 45.0,
        "location": "Bogura",
        "status": "available",
        "created_at": _now(),
        "updated_at": _now(),
    },
]
_next_id = 3


def _use_supabase() -> bool:
    return bool(SUPABASE_URL and SUPABASE_KEY)


def _sb_headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


@app.get("/api/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "storage": "supabase" if _use_supabase() else "memory",
    }


@app.get("/api/hello")
def hello(name: str = "World") -> dict[str, str]:
    return {"message": f"Hello, {name}!"}


# READ LIST: GET /api/crops
@app.get("/api/crops", response_model=list[CropResponse])
async def list_crops() -> list[dict]:
    if _use_supabase():
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(
                f"{SUPABASE_URL}/rest/v1/crop_listings?order=id.asc",
                headers=_sb_headers(),
            )
        if res.status_code >= 400:
            raise HTTPException(status_code=502, detail=res.text)
        return res.json()
    return _crops_db


# READ SINGLE: GET /api/crops/{crop_id}
@app.get("/api/crops/{crop_id}", response_model=CropResponse)
async def get_crop(crop_id: int) -> dict:
    if _use_supabase():
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(
                f"{SUPABASE_URL}/rest/v1/crop_listings?id=eq.{crop_id}&select=*",
                headers=_sb_headers(),
            )
        if res.status_code >= 400:
            raise HTTPException(status_code=502, detail=res.text)
        rows = res.json()
        if not rows:
            raise HTTPException(status_code=404, detail="Crop listing not found")
        return rows[0]

    for item in _crops_db:
        if item["id"] == crop_id:
            return item
    raise HTTPException(status_code=404, detail="Crop listing not found")


# CREATE: POST /api/crops
@app.post("/api/crops", response_model=CropResponse, status_code=status.HTTP_201_CREATED)
async def create_crop(payload: CropCreate) -> dict:
    global _next_id
    now = _now()
    data = payload.model_dump()
    data["created_at"] = now
    data["updated_at"] = now

    if _use_supabase():
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                f"{SUPABASE_URL}/rest/v1/crop_listings",
                headers=_sb_headers(),
                json=data,
            )
        if res.status_code >= 400:
            raise HTTPException(status_code=502, detail=res.text)
        rows = res.json()
        return rows[0]

    record = {"id": _next_id, **data}
    _next_id += 1
    _crops_db.append(record)
    return record


# UPDATE: PUT /api/crops/{crop_id}
@app.put("/api/crops/{crop_id}", response_model=CropResponse)
async def update_crop(crop_id: int, payload: CropUpdate) -> dict:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided for update")
    updates["updated_at"] = _now()

    if _use_supabase():
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.patch(
                f"{SUPABASE_URL}/rest/v1/crop_listings?id=eq.{crop_id}",
                headers=_sb_headers(),
                json=updates,
            )
        if res.status_code >= 400:
            raise HTTPException(status_code=502, detail=res.text)
        rows = res.json()
        if not rows:
            raise HTTPException(status_code=404, detail="Crop listing not found")
        return rows[0]

    for item in _crops_db:
        if item["id"] == crop_id:
            item.update(updates)
            return item
    raise HTTPException(status_code=404, detail="Crop listing not found")


# DELETE: DELETE /api/crops/{crop_id}
@app.delete("/api/crops/{crop_id}", status_code=status.HTTP_200_OK)
async def delete_crop(crop_id: int) -> dict:
    if _use_supabase():
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.delete(
                f"{SUPABASE_URL}/rest/v1/crop_listings?id=eq.{crop_id}",
                headers=_sb_headers(),
            )
        if res.status_code >= 400:
            raise HTTPException(status_code=502, detail=res.text)
        rows = res.json()
        if not rows:
            raise HTTPException(status_code=404, detail="Crop listing not found")
        return {"deleted": True, "id": crop_id}

    for idx, item in enumerate(_crops_db):
        if item["id"] == crop_id:
            _crops_db.pop(idx)
            return {"deleted": True, "id": crop_id}
    raise HTTPException(status_code=404, detail="Crop listing not found")


FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if FRONTEND_DIR.is_dir():
    app.frontend("/", directory=FRONTEND_DIR)