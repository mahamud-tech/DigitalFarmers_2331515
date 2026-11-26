import csv
from datetime import datetime, timedelta, timezone
import io
from pathlib import Path
from urllib.parse import quote

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from config import (
    COOKIE_SECURE,
    FRONTEND_ORIGIN,
    LOCKOUT_MINUTES,
    MAX_FAILED_LOGIN_ATTEMPTS,
    REFRESH_TOKEN_EXPIRE_DAYS,
)
from db import sb_delete, sb_insert, sb_select, sb_update
from rbac import (
    PERM_CROPS_CREATE,
    PERM_CROPS_DELETE,
    PERM_CROPS_EDIT,
    PERM_CROPS_READ,
    ROLE_ADMIN,
    enforce_admin_target_safety,
    get_current_user,
    require_permission,
    require_role,
    verify_group_permission,
)
from schemas import (
    BanActionRequest,
    BulkBanRequest,
    BulkDeleteRequest,
    CropCreate,
    CropUpdate,
    GroupCreate,
    GroupMemberUpsert,
    GroupRename,
    LoginRequest,
    PasswordChangeRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    RoleChangeRequest,
)
from security import (
    create_access_token,
    generate_refresh_token,
    get_client_meta,
    hash_password,
    hash_refresh_token,
    log_audit,
    verify_password,
)
from seed import seed_demo_data

app = FastAPI(title="DigitalFarmers RBAC & Multi-User API", version="2.0.0")

origins = [o.strip() for o in FRONTEND_ORIGIN.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


def _set_refresh_cookie(response: Response, raw_refresh: str) -> None:
    response.set_cookie(
        key="df_refresh_token",
        value=raw_refresh,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="none" if COOKIE_SECURE else "lax",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key="df_refresh_token",
        path="/api",
        samesite="none" if COOKIE_SECURE else "lax",
    )


def _public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "full_name": u["full_name"],
        "district": u.get("district", "Dhaka"),
        "role": u["role"],
        "is_banned": u.get("is_banned", False),
        "ban_reason": u.get("ban_reason"),
        "created_at": u.get("created_at"),
    }


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "ok", "service": "DigitalFarmers API v2", "docs": "/docs", "health": "/api/health"}


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "DigitalFarmers API v2"}


@app.post("/api/seed")
async def trigger_seed():
    return await seed_demo_data()


# ==========================================
# 1. AUTHENTICATION & SESSIONS
# ==========================================
@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, request: Request, response: Response):
    email = payload.email.strip().lower()
    existing = await sb_select("users", f"email=eq.{quote(email)}&select=id")
    if existing:
        raise HTTPException(status_code=400, detail="Email is already registered")

    user = (
        await sb_insert(
            "users",
            {
                "email": email,
                "full_name": payload.full_name.strip(),
                "district": payload.district.strip(),
                "password_hash": hash_password(payload.password),
                "role": "user",
            },
        )
    )[0]

    raw_refresh = generate_refresh_token()
    ip, ua = get_client_meta(request)
    session = (
        await sb_insert(
            "sessions",
            {
                "user_id": user["id"],
                "refresh_token_hash": hash_refresh_token(raw_refresh),
                "ip_address": ip,
                "user_agent": ua,
                "expires_at": (datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat(),
            },
        )
    )[0]

    access_token = create_access_token(user["id"], user["role"], session["id"])
    _set_refresh_cookie(response, raw_refresh)
    await log_audit(request, "register", user["id"], email, "user", user["id"], "New user registered")
    return {"access_token": access_token, "token_type": "bearer", "user": _public_user(user)}

#loggin 



@app.post("/api/auth/login")
async def login(payload: LoginRequest, request: Request, response: Response):
    email = payload.email.strip().lower()
    users = await sb_select("users", f"email=eq.{quote(email)}&select=*")
    if not users:
        await log_audit(request, "failed_login", None, email, "auth", email, "Unknown email")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    user = users[0]
    now = datetime.now(timezone.utc)

    if user.get("locked_until"):
        locked_dt = datetime.fromisoformat(str(user["locked_until"]).replace("Z", "+00:00"))
        if locked_dt > now:
            await log_audit(request, "failed_login", user["id"], email, "auth", user["id"], "Account locked")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed login attempts. Try again in 15 minutes.",
            )

    if user.get("is_banned"):
        await log_audit(request, "failed_login", user["id"], email, "auth", user["id"], "Banned user login attempt")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account banned: {user.get('ban_reason') or 'Contact administrator'}",
        )

    if not verify_password(payload.password, user["password_hash"]):
        attempts = int(user.get("failed_login_attempts") or 0) + 1
        update_data: dict = {"failed_login_attempts": attempts}
        if attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
            update_data["locked_until"] = (now + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
        await sb_update("users", update_data, f"id=eq.{user['id']}")
        await log_audit(
            request,
            "failed_login",
            user["id"],
            email,
            "auth",
            user["id"],
            f"Wrong password (attempt {attempts})",
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    await sb_update("users", {"failed_login_attempts": 0, "locked_until": None}, f"id=eq.{user['id']}")

    raw_refresh = generate_refresh_token()
    ip, ua = get_client_meta(request)
    session = (
        await sb_insert(
            "sessions",
            {
                "user_id": user["id"],
                "refresh_token_hash": hash_refresh_token(raw_refresh),
                "ip_address": ip,
                "user_agent": ua,
                "expires_at": (now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat(),
            },
        )
    )[0]

    access_token = create_access_token(user["id"], user["role"], session["id"])
    _set_refresh_cookie(response, raw_refresh)
    await log_audit(request, "login", user["id"], email, "session", session["id"], "Successful login")
    return {"access_token": access_token, "token_type": "bearer", "user": _public_user(user)}


@app.post("/api/auth/refresh")
async def refresh_session(request: Request, response: Response):
    raw_refresh = request.cookies.get("df_refresh_token")
    if not raw_refresh:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh cookie")

    token_hash = hash_refresh_token(raw_refresh)
    sessions = await sb_select("sessions", f"refresh_token_hash=eq.{token_hash}&select=*")
    if not sessions:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    session = sessions[0]
    now = datetime.now(timezone.utc)
    expires_at = datetime.fromisoformat(str(session["expires_at"]).replace("Z", "+00:00"))
    if session.get("revoked") or expires_at <= now:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session expired or revoked")

    users = await sb_select("users", f"id=eq.{session['user_id']}&select=*")
    if not users or users[0].get("is_banned"):
        await sb_update("sessions", {"revoked": True}, f"id=eq.{session['id']}")
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account unavailable or banned")

    user = users[0]
    new_raw_refresh = generate_refresh_token()
    await sb_update(
        "sessions",
        {"refresh_token_hash": hash_refresh_token(new_raw_refresh)},
        f"id=eq.{session['id']}",
    )
    access_token = create_access_token(user["id"], user["role"], session["id"])
    _set_refresh_cookie(response, new_raw_refresh)
    return {"access_token": access_token, "token_type": "bearer", "user": _public_user(user)}

#logout



@app.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    raw_refresh = request.cookies.get("df_refresh_token")
    if raw_refresh:
        token_hash = hash_refresh_token(raw_refresh)
        sessions = await sb_select("sessions", f"refresh_token_hash=eq.{token_hash}&select=*")
        if sessions:
            sess = sessions[0]
            await sb_update("sessions", {"revoked": True}, f"id=eq.{sess['id']}")
            users = await sb_select("users", f"id=eq.{sess['user_id']}&select=email")
            email = users[0]["email"] if users else "unknown"
            await log_audit(request, "logout", sess["user_id"], email, "session", sess["id"], "User logged out")
    _clear_refresh_cookie(response)
    return {"logged_out": True}


@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return _public_user(current_user)


@app.put("/api/auth/profile")
async def update_profile(
    payload: ProfileUpdateRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    updated = (
        await sb_update(
            "users",
            {"full_name": payload.full_name.strip(), "district": payload.district.strip()},
            f"id=eq.{current_user['id']}",
        )
    )[0]
    await log_audit(
        request,
        "profile_update",
        current_user["id"],
        current_user["email"],
        "user",
        current_user["id"],
        "Updated profile details",
    )
    return _public_user(updated)


@app.post("/api/auth/change-password")
async def change_password(
    payload: PasswordChangeRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user["password_hash"]):
        await log_audit(
            request,
            "failed_password_change",
            current_user["id"],
            current_user["email"],
            "user",
            current_user["id"],
            "Incorrect current password provided",
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    await sb_update(
        "users",
        {"password_hash": hash_password(payload.new_password)},
        f"id=eq.{current_user['id']}",
    )
    await log_audit(
        request,
        "password_change",
        current_user["id"],
        current_user["email"],
        "user",
        current_user["id"],
        "Changed account password",
    )
    return {"changed": True}


@app.get("/api/auth/sessions")
async def list_my_sessions(current_user: dict = Depends(get_current_user)):
    rows = await sb_select(
        "sessions",
        f"user_id=eq.{current_user['id']}&order=created_at.desc&select=id,ip_address,user_agent,revoked,expires_at,created_at",
    )
    for r in rows:
        r["is_current"] = r["id"] == current_user.get("session_id")
    return rows


@app.delete("/api/auth/sessions/{session_id}")
async def revoke_my_session(
    session_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    rows = await sb_select("sessions", f"id=eq.{session_id}&user_id=eq.{current_user['id']}&select=id")
    if not rows:
        raise HTTPException(status_code=404, detail="Session not found")
    await sb_update("sessions", {"revoked": True}, f"id=eq.{session_id}")
    await log_audit(
        request,
        "session_revoke",
        current_user["id"],
        current_user["email"],
        "session",
        session_id,
        "Revoked personal session",
    )
    return {"revoked": True, "id": session_id}


# ==========================================
# 2. GROUPS / TEAMS WITH FINE-GRAINED PERMISSIONS
# ==========================================
@app.get("/api/groups")
async def list_groups(current_user: dict = Depends(get_current_user)):
    all_groups = await sb_select("groups", "order=created_at.desc&select=*")
    all_members = await sb_select("group_members", "select=*")
    users = await sb_select("users", "select=id,email,full_name")
    user_map = {u["id"]: u for u in users}

    result = []
    for g in all_groups:
        g_members = [m for m in all_members if m["group_id"] == g["id"]]
        my_mem = next((m for m in g_members if m["user_id"] == current_user["id"]), None)
        is_owner = g["owner_id"] == current_user["id"]

        if current_user["role"] != ROLE_ADMIN and not is_owner and not my_mem:
            continue

        enriched_members = []
        for m in g_members:
            u_info = user_map.get(m["user_id"], {})
            enriched_members.append(
                {
                    **m,
                    "email": u_info.get("email", "unknown"),
                    "full_name": u_info.get("full_name", "Unknown User"),
                }
            )

        result.append(
            {
                **g,
                "owner_name": user_map.get(g["owner_id"], {}).get("full_name", "Owner"),
                "is_owner": is_owner,
                "my_permissions": {
                    "can_create": True if (is_owner or current_user["role"] == ROLE_ADMIN) else bool(my_mem and my_mem["can_create"]),
                    "can_edit": True if (is_owner or current_user["role"] == ROLE_ADMIN) else bool(my_mem and my_mem["can_edit"]),
                    "can_assign": True if (is_owner or current_user["role"] == ROLE_ADMIN) else bool(my_mem and my_mem["can_assign"]),
                    "can_manage": is_owner or current_user["role"] == ROLE_ADMIN,
                },
                "members": enriched_members,
            }
        )
    return result


@app.post("/api/groups", status_code=status.HTTP_201_CREATED)
async def create_group(
    payload: GroupCreate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    group = (
        await sb_insert(
            "groups",
            {
                "name": payload.name.strip(),
                "description": payload.description.strip(),
                "owner_id": current_user["id"],
            },
        )
    )[0]
    await sb_insert(
        "group_members",
        {
            "group_id": group["id"],
            "user_id": current_user["id"],
            "member_role": "owner",
            "can_create": True,
            "can_edit": True,
            "can_assign": True,
        },
    )
    await log_audit(
        request,
        "group_create",
        current_user["id"],
        current_user["email"],
        "group",
        group["id"],
        f"Created group '{group['name']}'",
    )
    return group


@app.put("/api/groups/{group_id}")
async def rename_group(
    group_id: str,
    payload: GroupRename,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    await verify_group_permission(group_id, current_user, owner_only=True)
    updates: dict = {"name": payload.name.strip()}
    if payload.description is not None:
        updates["description"] = payload.description.strip()
    updated = (await sb_update("groups", updates, f"id=eq.{group_id}"))[0]
    await log_audit(
        request,
        "group_rename",
        current_user["id"],
        current_user["email"],
        "group",
        group_id,
        f"Renamed group to '{updated['name']}'",
    )
    return updated


@app.delete("/api/groups/{group_id}")
async def delete_group(
    group_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    group, _ = await verify_group_permission(group_id, current_user, owner_only=True)
    await sb_delete("groups", f"id=eq.{group_id}")
    await log_audit(
        request,
        "delete",
        current_user["id"],
        current_user["email"],
        "group",
        group_id,
        f"Deleted group '{group['name']}'",
    )
    return {"deleted": True, "id": group_id}


@app.post("/api/groups/{group_id}/members")
async def upsert_group_member(
    group_id: str,
    payload: GroupMemberUpsert,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    group, _ = await verify_group_permission(group_id, current_user, owner_only=True)
    email = payload.user_email.strip().lower()
    users = await sb_select("users", f"email=eq.{quote(email)}&select=*")
    if not users:
        raise HTTPException(status_code=404, detail="Target user email not found")
    target_user = users[0]

    existing = await sb_select(
        "group_members",
        f"group_id=eq.{group_id}&user_id=eq.{target_user['id']}&select=*",
    )
    is_owner = target_user["id"] == group["owner_id"]
    mem_data = {
        "member_role": "owner" if is_owner else "member",
        "can_create": True if is_owner else payload.can_create,
        "can_edit": True if is_owner else payload.can_edit,
        "can_assign": True if is_owner else payload.can_assign,
    }
    if existing:
        saved = (
            await sb_update(
                "group_members",
                mem_data,
                f"group_id=eq.{group_id}&user_id=eq.{target_user['id']}",
            )
        )[0]
    else:
        saved = (
            await sb_insert(
                "group_members",
                {"group_id": group_id, "user_id": target_user["id"], **mem_data},
            )
        )[0]

    await log_audit(
        request,
        "group_member_update",
        current_user["id"],
        current_user["email"],
        "group",
        group_id,
        f"Updated member {email} permissions (create={mem_data['can_create']}, edit={mem_data['can_edit']}, assign={mem_data['can_assign']})",
    )
    return saved


@app.delete("/api/groups/{group_id}/members/{member_user_id}")
async def remove_group_member(
    group_id: str,
    member_user_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    group, _ = await verify_group_permission(group_id, current_user, owner_only=True)
    if member_user_id == group["owner_id"]:
        raise HTTPException(status_code=400, detail="Cannot remove the group owner")
    await sb_delete("group_members", f"group_id=eq.{group_id}&user_id=eq.{member_user_id}")
    await log_audit(
        request,
        "group_member_remove",
        current_user["id"],
        current_user["email"],
        "group",
        group_id,
        f"Removed member {member_user_id}",
    )
    return {"removed": True}


# ==========================================
# 3. CROP LISTINGS (OWNERSHIP + GROUP RBAC)
# ==========================================
async def _accessible_group_ids(user_id: str) -> set[str]:
    mems = await sb_select("group_members", f"user_id=eq.{user_id}&select=group_id")
    owned = await sb_select("groups", f"owner_id=eq.{user_id}&select=id")
    return {m["group_id"] for m in mems} | {g["id"] for g in owned}


@app.get("/api/crops")
async def list_crops(current_user: dict = Depends(require_permission(PERM_CROPS_READ))):
    all_crops = await sb_select("crop_listings", "order=id.desc&select=*")
    if current_user["role"] == ROLE_ADMIN:
        return all_crops

    group_ids = await _accessible_group_ids(current_user["id"])
    return [
        c
        for c in all_crops
        if c["owner_id"] == current_user["id"] or (c.get("group_id") and c["group_id"] in group_ids)
    ]


@app.get("/api/crops/{crop_id}")
async def get_crop(crop_id: int, current_user: dict = Depends(require_permission(PERM_CROPS_READ))):
    rows = await sb_select("crop_listings", f"id=eq.{crop_id}&select=*")
    if not rows:
        raise HTTPException(status_code=404, detail="Crop listing not found")
    crop = rows[0]

    if current_user["role"] != ROLE_ADMIN:
        group_ids = await _accessible_group_ids(current_user["id"])
        if crop["owner_id"] != current_user["id"] and crop.get("group_id") not in group_ids:
            raise HTTPException(status_code=403, detail="Access denied to another user's crop listing")
    return crop


@app.post("/api/crops", status_code=status.HTTP_201_CREATED)
async def create_crop(
    payload: CropCreate,
    request: Request,
    current_user: dict = Depends(require_permission(PERM_CROPS_CREATE)),
):
    if payload.group_id:
        await verify_group_permission(payload.group_id, current_user, required_perm="create")

    now = datetime.now(timezone.utc).isoformat()
    data = payload.model_dump()
    data["owner_id"] = current_user["id"]
    data["created_at"] = now
    data["updated_at"] = now

    created = (await sb_insert("crop_listings", data))[0]
    await log_audit(
        request,
        "crop_create",
        current_user["id"],
        current_user["email"],
        "crop",
        str(created["id"]),
        f"Created crop '{created['crop_name']}'",
    )
    return created


@app.put("/api/crops/{crop_id}")
async def update_crop(
    crop_id: int,
    payload: CropUpdate,
    request: Request,
    current_user: dict = Depends(require_permission(PERM_CROPS_EDIT)),
):
    rows = await sb_select("crop_listings", f"id=eq.{crop_id}&select=*")
    if not rows:
        raise HTTPException(status_code=404, detail="Crop listing not found")
    crop = rows[0]

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided")

    if current_user["role"] != ROLE_ADMIN:
        if crop.get("group_id"):
            only_assign = set(updates.keys()) == {"assigned_to"}
            if only_assign:
                await verify_group_permission(crop["group_id"], current_user, required_perm="assign")
            else:
                await verify_group_permission(crop["group_id"], current_user, required_perm="edit")
                if "assigned_to" in updates and updates["assigned_to"] != crop.get("assigned_to"):
                    await verify_group_permission(crop["group_id"], current_user, required_perm="assign")
        elif crop["owner_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="You can only update your own crop listings")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updated = (await sb_update("crop_listings", updates, f"id=eq.{crop_id}"))[0]
    await log_audit(
        request,
        "crop_update",
        current_user["id"],
        current_user["email"],
        "crop",
        str(crop_id),
        f"Updated crop '{updated['crop_name']}'",
    )
    return updated


@app.delete("/api/crops/{crop_id}")
async def delete_crop(
    crop_id: int,
    request: Request,
    current_user: dict = Depends(require_permission(PERM_CROPS_DELETE)),
):
    rows = await sb_select("crop_listings", f"id=eq.{crop_id}&select=*")
    if not rows:
        raise HTTPException(status_code=404, detail="Crop listing not found")
    crop = rows[0]

    if current_user["role"] != ROLE_ADMIN:
        if crop.get("group_id"):
            await verify_group_permission(crop["group_id"], current_user, owner_only=True)
        elif crop["owner_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="You can only delete your own crop listings")

    await sb_delete("crop_listings", f"id=eq.{crop_id}")
    await log_audit(
        request,
        "delete",
        current_user["id"],
        current_user["email"],
        "crop",
        str(crop_id),
        f"Deleted crop '{crop['crop_name']}'",
    )
    return {"deleted": True, "id": crop_id}


# ==========================================
# 4. ADMIN DASHBOARD, MODERATION, AUDIT & CSV EXPORTS
# ==========================================
#bann




@app.get("/api/admin/overview")
async def admin_overview(admin: dict = Depends(require_role(ROLE_ADMIN))):
    users = await sb_select("users", "select=id,is_banned,created_at")
    crops = await sb_select("crop_listings", "select=id,created_at")
    groups = await sb_select("groups", "select=id,created_at")

    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    def is_recent(ts: str | None) -> bool:
        if not ts:
            return False
        return datetime.fromisoformat(str(ts).replace("Z", "+00:00")) >= cutoff

    return {
        "total_users": len(users),
        "banned_users": sum(1 for u in users if u.get("is_banned")),
        "total_records": len(crops),
        "total_groups": len(groups),
        "new_users_7d": sum(1 for u in users if is_recent(u.get("created_at"))),
        "new_records_7d": sum(1 for c in crops if is_recent(c.get("created_at"))),
        "new_groups_7d": sum(1 for g in groups if is_recent(g.get("created_at"))),
    }


def _filter_users(users: list[dict], search: str, role: str, status_filter: str) -> list[dict]:
    out = users
    if search:
        q = search.lower()
        out = [u for u in out if q in u["email"].lower() or q in u["full_name"].lower() or q in u.get("district", "").lower()]
    if role and role != "all":
        out = [u for u in out if u["role"] == role]
    if status_filter == "banned":
        out = [u for u in out if u.get("is_banned")]
    elif status_filter == "active":
        out = [u for u in out if not u.get("is_banned")]
    return out


@app.get("/api/admin/users")
async def admin_list_users(
    search: str = "",
    role: str = "all",
    status_filter: str = Query(default="all", alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    admin: dict = Depends(require_role(ROLE_ADMIN)),
):
    users = await sb_select("users", "order=created_at.desc&select=*")
    filtered = [_public_user(u) for u in _filter_users(users, search, role, status_filter)]
    total = len(filtered)
    start = (page - 1) * page_size
    return {"items": filtered[start : start + page_size], "total": total, "page": page, "page_size": page_size}


@app.get("/api/admin/users/{user_id}")
async def admin_user_detail(user_id: str, admin: dict = Depends(require_role(ROLE_ADMIN))):
    users = await sb_select("users", f"id=eq.{user_id}&select=*")
    if not users:
        raise HTTPException(status_code=404, detail="User not found")
    records = await sb_select("crop_listings", f"owner_id=eq.{user_id}&order=id.desc&select=*")
    mems = await sb_select("group_members", f"user_id=eq.{user_id}&select=*")
    groups = await sb_select("groups", "select=id,name")
    g_map = {g["id"]: g["name"] for g in groups}
    for m in mems:
        m["group_name"] = g_map.get(m["group_id"], "Group")
    sessions = await sb_select("sessions", f"user_id=eq.{user_id}&order=created_at.desc&select=*")
    activity = await sb_select("audit_logs", f"user_id=eq.{user_id}&order=id.desc&limit=25&select=*")
    return {
        "user": _public_user(users[0]),
        "records": records,
        "groups": mems,
        "sessions": sessions,
        "activity": activity,
    }


@app.post("/api/admin/users/{user_id}/ban")
async def admin_ban_user(
    user_id: str,
    payload: BanActionRequest,
    request: Request,
    admin: dict = Depends(require_role(ROLE_ADMIN)),
):
    users = await sb_select("users", f"id=eq.{user_id}&select=*")
    if not users:
        raise HTTPException(status_code=404, detail="User not found")
    target = users[0]
    enforce_admin_target_safety(admin, target, "ban")

    await sb_update("users", {"is_banned": True, "ban_reason": payload.reason.strip()}, f"id=eq.{user_id}")
    await sb_update("sessions", {"revoked": True}, f"user_id=eq.{user_id}")
    await log_audit(
        request,
        "ban",
        admin["id"],
        admin["email"],
        "user",
        user_id,
        f"Banned {target['email']}: {payload.reason.strip()}",
    )
    return {"banned": True, "user_id": user_id}

#unbann



@app.post("/api/admin/users/{user_id}/unban")
async def admin_unban_user(
    user_id: str,
    request: Request,
    admin: dict = Depends(require_role(ROLE_ADMIN)),
):
    users = await sb_select("users", f"id=eq.{user_id}&select=*")
    if not users:
        raise HTTPException(status_code=404, detail="User not found")
    target = users[0]
    await sb_update("users", {"is_banned": False, "ban_reason": None}, f"id=eq.{user_id}")
    await log_audit(request, "unban", admin["id"], admin["email"], "user", user_id, f"Unbanned {target['email']}")
    return {"unbanned": True, "user_id": user_id}


@app.post("/api/admin/users/{user_id}/role")
async def admin_change_role(
    user_id: str,
    payload: RoleChangeRequest,
    request: Request,
    admin: dict = Depends(require_role(ROLE_ADMIN)),
):
    users = await sb_select("users", f"id=eq.{user_id}&select=*")
    if not users:
        raise HTTPException(status_code=404, detail="User not found")
    target = users[0]
    enforce_admin_target_safety(admin, target, "change role of")

    await sb_update("users", {"role": payload.role}, f"id=eq.{user_id}")
    await log_audit(
        request,
        "role_change",
        admin["id"],
        admin["email"],
        "user",
        user_id,
        f"Changed role of {target['email']} to {payload.role}",
    )
    return {"updated": True, "role": payload.role}

#revoke


@app.post("/api/admin/users/{user_id}/revoke-sessions")
async def admin_revoke_user_sessions(
    user_id: str,
    request: Request,
    admin: dict = Depends(require_role(ROLE_ADMIN)),
):
    await sb_update("sessions", {"revoked": True}, f"user_id=eq.{user_id}")
    await log_audit(
        request,
        "revoke_sessions",
        admin["id"],
        admin["email"],
        "user",
        user_id,
        "Admin revoked all user sessions",
    )
    return {"revoked": True}


@app.post("/api/admin/users/bulk-ban")
async def admin_bulk_ban(
    payload: BulkBanRequest,
    request: Request,
    admin: dict = Depends(require_role(ROLE_ADMIN)),
):
    affected = 0
    for uid in payload.user_ids:
        users = await sb_select("users", f"id=eq.{uid}&select=*")
        if not users:
            continue
        target = users[0]
        if target["id"] == admin["id"] or target.get("role") == ROLE_ADMIN:
            continue
        await sb_update(
            "users",
            {"is_banned": payload.ban, "ban_reason": payload.reason.strip() if payload.ban else None},
            f"id=eq.{uid}",
        )
        if payload.ban:
            await sb_update("sessions", {"revoked": True}, f"user_id=eq.{uid}")
        affected += 1

    await log_audit(
        request,
        "ban" if payload.ban else "unban",
        admin["id"],
        admin["email"],
        "bulk_users",
        ",".join(payload.user_ids),
        f"Bulk {'ban' if payload.ban else 'unban'} applied to {affected} users",
    )
    return {"affected": affected}


@app.get("/api/admin/content")
async def admin_content(
    search: str = "",
    status_filter: str = Query(default="all", alias="status"),
    admin: dict = Depends(require_role(ROLE_ADMIN)),
):
    crops = await sb_select("crop_listings", "order=id.desc&select=*")
    groups = await sb_select("groups", "order=created_at.desc&select=*")
    if search:
        q = search.lower()
        crops = [c for c in crops if q in c["crop_name"].lower() or q in c["farmer_name"].lower() or q in c["location"].lower()]
        groups = [g for g in groups if q in g["name"].lower() or q in g.get("description", "").lower()]
    if status_filter != "all":
        crops = [c for c in crops if c["status"] == status_filter]
    return {"crops": crops, "groups": groups}


@app.post("/api/admin/crops/bulk-delete")
async def admin_bulk_delete_crops(
    payload: BulkDeleteRequest,
    request: Request,
    admin: dict = Depends(require_role(ROLE_ADMIN)),
):
    for cid in payload.ids:
        await sb_delete("crop_listings", f"id=eq.{cid}")
    await log_audit(
        request,
        "delete",
        admin["id"],
        admin["email"],
        "crop_bulk",
        ",".join(str(i) for i in payload.ids),
        f"Admin deleted {len(payload.ids)} crop listings",
    )
    return {"deleted": len(payload.ids)}


@app.post("/api/admin/groups/bulk-delete")
async def admin_bulk_delete_groups(
    payload: BulkDeleteRequest,
    request: Request,
    admin: dict = Depends(require_role(ROLE_ADMIN)),
):
    for gid in payload.ids:
        await sb_delete("groups", f"id=eq.{gid}")
    await log_audit(
        request,
        "delete",
        admin["id"],
        admin["email"],
        "group_bulk",
        ",".join(str(i) for i in payload.ids),
        f"Admin deleted {len(payload.ids)} groups",
    )
    return {"deleted": len(payload.ids)}


def _filter_logs(logs: list[dict], action: str, search: str) -> list[dict]:
    out = logs
    if action and action != "all":
        out = [l for l in out if l["action"] == action]
    if search:
        q = search.lower()
        out = [
            l
            for l in out
            if q in l.get("user_email", "").lower()
            or q in l.get("ip_address", "").lower()
            or q in l.get("details", "").lower()
            or q in l.get("action", "").lower()
        ]
    return out


@app.get("/api/admin/audit-logs")
async def admin_audit_logs(
    action: str = "all",
    search: str = "",
    admin: dict = Depends(require_role(ROLE_ADMIN)),
):
    logs = await sb_select("audit_logs", "order=id.desc&limit=250&select=*")
    return _filter_logs(logs, action, search)


@app.get("/api/admin/security")
async def admin_security_summary(admin: dict = Depends(require_role(ROLE_ADMIN))):
    failed = await sb_select("audit_logs", "action=eq.failed_login&order=id.desc&limit=200&select=*")
    by_ip: dict[str, int] = {}
    by_account: dict[str, int] = {}
    for entry in failed:
        ip = entry.get("ip_address") or "unknown"
        acct = entry.get("user_email") or "unknown"
        by_ip[ip] = by_ip.get(ip, 0) + 1
        by_account[acct] = by_account.get(acct, 0) + 1
    return {
        "by_ip": [{"ip_address": k, "count": v} for k, v in sorted(by_ip.items(), key=lambda x: -x[1])],
        "by_account": [{"email": k, "count": v} for k, v in sorted(by_account.items(), key=lambda x: -x[1])],
        "recent_failures": failed[:20],
    }


def _csv_response(filename: str, headers: list[str], rows: list[list]) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/admin/export/{kind}")
async def admin_export_csv(
    kind: str,
    request: Request,
    search: str = "",
    role: str = "all",
    status_filter: str = Query(default="all", alias="status"),
    action: str = "all",
    admin: dict = Depends(require_role(ROLE_ADMIN)),
):
    await log_audit(request, "export", admin["id"], admin["email"], "csv", kind, f"Exported {kind} CSV")

    if kind == "users":
        users = _filter_users(await sb_select("users", "order=created_at.desc&select=*"), search, role, status_filter)
        return _csv_response(
            "digitalfarmers_users.csv",
            ["id", "email", "full_name", "district", "role", "is_banned", "ban_reason", "created_at"],
            [[u["id"], u["email"], u["full_name"], u.get("district"), u["role"], u["is_banned"], u.get("ban_reason") or "", u["created_at"]] for u in users],
        )

    if kind == "records":
        crops = await sb_select("crop_listings", "order=id.desc&select=*")
        if search:
            q = search.lower()
            crops = [c for c in crops if q in c["crop_name"].lower() or q in c["farmer_name"].lower()]
        if status_filter != "all":
            crops = [c for c in crops if c["status"] == status_filter]
        return _csv_response(
            "digitalfarmers_records.csv",
            ["id", "crop_name", "category", "farmer_name", "quantity_kg", "price_per_kg", "location", "status", "owner_id", "group_id", "created_at"],
            [[c["id"], c["crop_name"], c["category"], c["farmer_name"], c["quantity_kg"], c["price_per_kg"], c["location"], c["status"], c["owner_id"], c.get("group_id") or "", c["created_at"]] for c in crops],
        )

    if kind == "activity":
        logs = _filter_logs(await sb_select("audit_logs", "order=id.desc&limit=500&select=*"), action, search)
        return _csv_response(
            "digitalfarmers_activity.csv",
            ["id", "created_at", "user_email", "action", "target_type", "target_id", "details", "ip_address", "user_agent"],
            [[l["id"], l["created_at"], l["user_email"], l["action"], l["target_type"], l["target_id"], l["details"], l["ip_address"], l["user_agent"]] for l in logs],
        )

    raise HTTPException(status_code=400, detail="Export kind must be users, records, or activity")


FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")