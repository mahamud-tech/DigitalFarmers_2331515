import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { Navbar } from "./components/Navbar"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { AuthProvider } from "./context/AuthContext"
import { AdminPage } from "./pages/AdminPage"
import { GroupsPage } from "./pages/GroupsPage"
import { LoginPage } from "./pages/LoginPage"
import { MarketplacePage } from "./pages/MarketplacePage"
import { ProfilePage } from "./pages/ProfilePage"
import { RegisterPage } from "./pages/RegisterPage"

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MarketplacePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/groups"
            element={
              <ProtectedRoute>
                <GroupsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}