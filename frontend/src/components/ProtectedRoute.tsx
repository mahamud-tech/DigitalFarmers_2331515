import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import type { UserRole } from "../types/models"

export function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: ReactNode
  requiredRole?: UserRole
}) {
  const { user, restoring } = useAuth()

  // Prevents flash of guest content while refresh cookie restores the session
  if (restoring) {
    return (
      <div className="mvp-container">
        <div className="panel">Restoring secure session...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}