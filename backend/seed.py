import asyncio
from db import sb_insert, sb_select
from security import hash_password

DEMO_USERS = [
    {
        "email": "admin1@digitalfarmers.test",
        "full_name": "Mahmud Admin",
        "district": "Dhaka",
        "password": "AdminPass123!",
        "role": "admin",
    },
    {
        "email": "admin2@digitalfarmers.test",
        "full_name": "Nusrat Moderator",
        "district": "Chattogram",
        "password": "AdminPass123!",
        "role": "admin",
    },
    {
        "email": "karim@digitalfarmers.test",
        "full_name": "Karim Mia",
        "district": "Dinajpur",
        "password": "FarmerPass123!",
        "role": "user",
    },
    {
        "email": "salma@digitalfarmers.test",
        "full_name": "Salma Begum",
        "district": "Bogura",
        "password": "FarmerPass123!",
        "role": "user",
    },
    {
        "email": "rafiq@digitalfarmers.test",
        "full_name": "Rafiqul Islam",
        "district": "Sylhet",
        "password": "FarmerPass123!",
        "role": "user",
    },
]


async def seed_demo_data() -> dict:
    created_users: dict[str, dict] = {}
    for u in DEMO_USERS:
        existing = await sb_select("users", f"email=eq.{u['email']}&select=*")
        if existing:
            created_users[u["email"]] = existing[0]
        else:
            inserted = await sb_insert(
                "users",
                {
                    "email": u["email"],
                    "full_name": u["full_name"],
                    "district": u["district"],
                    "password_hash": hash_password(u["password"]),
                    "role": u["role"],
                },
            )
            created_users[u["email"]] = inserted[0]

    karim = created_users["karim@digitalfarmers.test"]
    salma = created_users["salma@digitalfarmers.test"]
    rafiq = created_users["rafiq@digitalfarmers.test"]

    existing_groups = await sb_select("groups", "name=eq.North%20Bengal%20Agri%20Co-op&select=*")
    if existing_groups:
        coop = existing_groups[0]
    else:
        coop = (
            await sb_insert(
                "groups",
                {
                    "name": "North Bengal Agri Co-op",
                    "description": "Shared harvest group with mixed permissions (Owner: Karim, Editor+Creator: Salma, Assign-only Coordinator: Rafiq)",
                    "owner_id": karim["id"],
                },
            )
        )[0]

        await sb_insert(
            "group_members",
            [
                {
                    "group_id": coop["id"],
                    "user_id": karim["id"],
                    "member_role": "owner",
                    "can_create": True,
                    "can_edit": True,
                    "can_assign": True,
                },
                {
                    "group_id": coop["id"],
                    "user_id": salma["id"],
                    "member_role": "member",
                    "can_create": True,
                    "can_edit": True,
                    "can_assign": False,
                },
                {
                    "group_id": coop["id"],
                    "user_id": rafiq["id"],
                    "member_role": "member",
                    "can_create": False,
                    "can_edit": False,
                    "can_assign": True,
                },
            ],
        )

    existing_crops = await sb_select("crop_listings", "select=id&limit=1")
    if not existing_crops:
        await sb_insert(
            "crop_listings",
            [
                {
                    "owner_id": karim["id"],
                    "group_id": coop["id"],
                    "assigned_to": salma["id"],
                    "farmer_name": karim["full_name"],
                    "crop_name": "Miniket Rice (Co-op Batch)",
                    "category": "Grains",
                    "quantity_kg": 400,
                    "price_per_kg": 64,
                    "location": "Dinajpur",
                    "status": "available",
                },
                {
                    "owner_id": salma["id"],
                    "group_id": None,
                    "farmer_name": salma["full_name"],
                    "crop_name": "Deshi Red Tomato",
                    "category": "Vegetables",
                    "quantity_kg": 120,
                    "price_per_kg": 48,
                    "location": "Bogura",
                    "status": "available",
                },
                {
                    "owner_id": rafiq["id"],
                    "group_id": None,
                    "farmer_name": rafiq["full_name"],
                    "crop_name": "Sylheti Nagas Chilli",
                    "category": "Spices",
                    "quantity_kg": 55,
                    "price_per_kg": 190,
                    "location": "Sylhet",
                    "status": "reserved",
                },
            ],
        )

    return {"seeded": True, "users": len(created_users), "group": coop["name"]}


if __name__ == "__main__":
    print(asyncio.run(seed_demo_data()))