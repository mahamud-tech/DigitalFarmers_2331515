import { Link, NavLink, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export function Navbar() {
  const { user, restoring, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate("/login")
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div>
          <Link to="/" className="brand-link">
            <span className="brand-badge">CSE309 Secure Multi-User Exchange</span>
            <h1>DigitalFarmers</h1>
          </Link>
        </div>

        {!restoring && (
          <nav className="nav-links">
            {user ? (
              <>
                <NavLink to="/" end className="nav-item">
                  My Crops
                </NavLink>
                <NavLink to="/groups" className="nav-item">
                  Co-op Groups
                </NavLink>
                <NavLink to="/profile" className="nav-item">
                  Profile &amp; Sessions
                </NavLink>
                {user.role === "admin" && (
                  <NavLink to="/admin" className="nav-item admin-pill">
                    Admin Dashboard
                  </NavLink>
                )}
                <span className="user-chip">
                  {user.full_name} ({user.role})
                </span>
                <button type="button" className="btn-light" onClick={() => void handleLogout()}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="nav-item">
                  Login
                </NavLink>
                <NavLink to="/register" className="btn-light">
                  Sign Up
                </NavLink>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  )
}