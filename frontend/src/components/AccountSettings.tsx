import React, { useState } from "react";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  district: string;
  role: string;
}

interface AccountSettingsProps {
  user: AuthUser;
  accessToken: string;
  apiBaseUrl?: string;
  onUserUpdated?: (updatedUser: AuthUser) => void;
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({
  user,
  accessToken,
  apiBaseUrl = "/api",
  onUserUpdated,
}) => {
  const [fullName, setFullName] = useState(user.full_name || "");
  const [district, setDistrict] = useState(user.district || "Dhaka");
  const [profileStatus, setProfileStatus] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const authHeaders: HeadersInit = {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileStatus(null);
    setSavingProfile(true);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/profile`, {
        method: "PUT",
        headers: authHeaders,
        credentials: "include",
        body: JSON.stringify({
          full_name: fullName.trim(),
          district: district.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProfileStatus({
          type: "err",
          msg: data.detail || `Profile update failed (${res.status})`,
        });
        return;
      }
      setProfileStatus({ type: "ok", msg: "Profile updated successfully." });
      if (onUserUpdated) {
        onUserUpdated(data);
      }
    } catch {
      setProfileStatus({ type: "err", msg: "Network error while updating profile." });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordStatus(null);

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: "err", msg: "New password and confirmation do not match." });
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/change-password`, {
        method: "POST",
        headers: authHeaders,
        credentials: "include",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPasswordStatus({
          type: "err",
          msg: `${data.detail || "Password change failed"} (Status ${res.status})`,
        });
        return;
      }
      setPasswordStatus({ type: "ok", msg: "Password changed successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordStatus({ type: "err", msg: "Network error while changing password." });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <section style={{ marginTop: "2rem", borderTop: "1px solid #ccc", paddingTop: "1.25rem" }}>
      <h2>Account Settings</h2>

      <form onSubmit={handleProfileSubmit} style={{ marginBottom: "1.5rem" }}>
        <h3>Update Profile</h3>
        <div>
          <label>
            Full Name:{" "}
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </label>
        </div>
        <div style={{ marginTop: "0.5rem" }}>
          <label>
            District:{" "}
            <input
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              required
            />
          </label>
        </div>
        <div style={{ marginTop: "0.5rem" }}>
          <button type="submit" disabled={savingProfile}>
            {savingProfile ? "Saving..." : "Update Profile"}
          </button>
        </div>
        {profileStatus && (
          <p style={{ color: profileStatus.type === "ok" ? "green" : "crimson" }}>
            {profileStatus.msg}
          </p>
        )}
      </form>

      <form onSubmit={handlePasswordSubmit}>
        <h3>Change Password</h3>
        <div>
          <label>
            Current Password:{" "}
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
        </div>
        <div style={{ marginTop: "0.5rem" }}>
          <label>
            New Password:{" "}
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </label>
        </div>
        <div style={{ marginTop: "0.5rem" }}>
          <label>
            Confirm New Password:{" "}
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>
        </div>
        <div style={{ marginTop: "0.5rem" }}>
          <button type="submit" disabled={savingPassword}>
            {savingPassword ? "Updating..." : "Change Password"}
          </button>
        </div>
        {passwordStatus && (
          <p style={{ color: passwordStatus.type === "ok" ? "green" : "crimson" }}>
            {passwordStatus.msg}
          </p>
        )}
      </form>
    </section>
  );
};