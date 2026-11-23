from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from db import sb_select
from security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)

# Centralized Role & Permission Constants
ROLE_USER = "user"
ROLE_ADMIN = "admin"

PERM_ADMIN_ALL = "admin:all"
PERM_CROPS_READ = "crops:read"
PERM_CROPS_CREATE = "crops:create"
PERM_CROPS_EDIT = "crops:edit"
PERM_CROPS_DELETE = "crops:delete"

GROUP_PERM_CREATE = "create"
GROUP_PERM_EDIT = "edit"
GROUP_PERM_ASSIGN = "assign"

ROLE_PERMISSIONS: dict[str, set[str]] = {
    ROLE_USER: {PERM_CROPS_READ, PERM_CROPS_CREATE, PERM_CROPS_EDIT, PERM_CROPS_DELETE},
    ROLE_ADMIN: {
        PERM_ADMIN_ALL,
        PERM_CROPS_READ,
        PERM_CROPS_CREATE,
        PERM_CROPS_EDIT,
        PERM_CROPS_DELETE,
    },
}


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    payload = decode_access_token(creds.credentials)
    user_id = payload["sub"]
    session_id = payload.get("sid")

    if session_id:
        sessions = await sb_select("sessions", f"id=eq.{session_id}&select=id,revoked")
        if not sessions or sessions[0].get("revoked"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session has been revoked")

    users = await sb_select("users", f"id=eq.{user_id}&select=*")
    if not users:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    user = users[0]
    if user.get("is_banned"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account banned: {user.get('ban_reason') or 'Policy violation'}",
        )
    user["session_id"] = session_id
    return user


def require_role(*allowed_roles: str):
    async def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(allowed_roles)}",
            )
        return current_user

    return dependency


def require_permission(permission: str):
    async def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        perms = ROLE_PERMISSIONS.get(current_user.get("role", ""), set())
        if permission not in perms and PERM_ADMIN_ALL not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {permission}",
            )
        return current_user

    return dependency


async def get_group_membership(group_id: str, user_id: str) -> dict | None:
    rows = await sb_select(
        "group_members",
        f"group_id=eq.{group_id}&user_id=eq.{user_id}&select=*",
    )
    return rows[0] if rows else None


async def verify_group_permission(
    group_id: str,
    current_user: dict,
    required_perm: str | None = None,
    owner_only: bool = False,
) -> tuple[dict, dict | None]:
    groups = await sb_select("groups", f"id=eq.{group_id}&select=*")
    if not groups:
        raise HTTPException(status_code=404, detail="Group not found")
    group = groups[0]

    if current_user.get("role") == ROLE_ADMIN:
        return group, None

    is_owner = group["owner_id"] == current_user["id"]
    membership = await get_group_membership(group_id, current_user["id"])

    if owner_only and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the group owner can delete, rename, or manage members",
        )

    if not is_owner and not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group",
        )

    if required_perm and not is_owner:
        perm_col = f"can_{required_perm}"
        if not membership or not membership.get(perm_col):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Group permission '{required_perm}' denied for your membership",
            )

    return group, membership


def enforce_admin_target_safety(actor: dict, target: dict, action_label: str) -> None:
    if actor["id"] == target["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Admins cannot {action_label} their own account",
        )
    if target.get("role") == ROLE_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Admins cannot {action_label} another admin account",
        )