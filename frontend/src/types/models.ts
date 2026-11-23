export type UserRole = "user" | "admin"

export interface User {
  id: string
  email: string
  full_name: string
  district: string
  role: UserRole
  is_banned: boolean
  ban_reason?: string | null
  created_at?: string
}

export interface CropListing {
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
  status: "available" | "reserved" | "sold"
  created_at: string
  updated_at: string
}

export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  email: string
  full_name: string
  member_role: "owner" | "member"
  can_create: boolean
  can_edit: boolean
  can_assign: boolean
}

export interface Group {
  id: string
  name: string
  description: string
  owner_id: string
  owner_name: string
  is_owner: boolean
  my_permissions: {
    can_create: boolean
    can_edit: boolean
    can_assign: boolean
    can_manage: boolean
  }
  members: GroupMember[]
  created_at: string
}

export interface UserSession {
  id: string
  ip_address: string
  user_agent: string
  revoked: boolean
  expires_at: string
  created_at: string
  is_current?: boolean
}

export interface AuditLog {
  id: number
  user_id?: string | null
  user_email: string
  action: string
  target_type: string
  target_id: string
  details: string
  ip_address: string
  user_agent: string
  created_at: string
}