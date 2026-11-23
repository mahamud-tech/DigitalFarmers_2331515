from typing import Literal
from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=150)
    full_name: str = Field(..., min_length=2, max_length=120)
    district: str = Field(default="Dhaka", min_length=2, max_length=80)
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=150)
    password: str = Field(..., min_length=1, max_length=128)


class ProfileUpdateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    district: str = Field(..., min_length=2, max_length=80)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)


class CropCreate(BaseModel):
    farmer_name: str = Field(..., min_length=2, max_length=120)
    crop_name: str = Field(..., min_length=2, max_length=120)
    category: str = Field(default="Vegetables", min_length=2, max_length=60)
    quantity_kg: float = Field(..., gt=0)
    price_per_kg: float = Field(..., gt=0)
    location: str = Field(..., min_length=2, max_length=120)
    status: Literal["available", "reserved", "sold"] = "available"
    group_id: str | None = None
    assigned_to: str | None = None


class CropUpdate(BaseModel):
    farmer_name: str | None = Field(default=None, min_length=2, max_length=120)
    crop_name: str | None = Field(default=None, min_length=2, max_length=120)
    category: str | None = Field(default=None, min_length=2, max_length=60)
    quantity_kg: float | None = Field(default=None, gt=0)
    price_per_kg: float | None = Field(default=None, gt=0)
    location: str | None = Field(default=None, min_length=2, max_length=120)
    status: Literal["available", "reserved", "sold"] | None = None
    assigned_to: str | None = None


class GroupCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    description: str = Field(default="", max_length=400)


class GroupRename(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=400)


class GroupMemberUpsert(BaseModel):
    user_email: str = Field(..., min_length=5, max_length=150)
    can_create: bool = True
    can_edit: bool = False
    can_assign: bool = False


class BanActionRequest(BaseModel):
    reason: str = Field(default="Violation of marketplace rules", min_length=3, max_length=250)


class RoleChangeRequest(BaseModel):
    role: Literal["user", "admin"]


class BulkBanRequest(BaseModel):
    user_ids: list[str]
    ban: bool
    reason: str = Field(default="Bulk moderation action", max_length=250)


class BulkDeleteRequest(BaseModel):
    ids: list[int | str]