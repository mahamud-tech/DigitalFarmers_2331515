import os
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from dotenv import load_dotenv
from fastapi import HTTPException
import httpx

load_dotenv(Path(__file__).resolve().parent / ".env")

_RAW_URL = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
if _RAW_URL.endswith("/rest/v1"):
    _RAW_URL = _RAW_URL[: -len("/rest/v1")]

SUPABASE_URL = _RAW_URL
SUPABASE_KEY = (os.getenv("SUPABASE_KEY") or "").strip()


def _headers() -> dict[str, str]:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase URL or API key is missing in backend/.env",
        )
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _build_url(table: str, filters: dict[str, Any] | str | None = None) -> str:
    clean_table = table.strip().lstrip("/")
    url = f"{SUPABASE_URL}/rest/v1/{clean_table}"
    if isinstance(filters, str):
        q = filters.strip().lstrip("?")
        if q:
            url = f"{url}?{q}"
    elif isinstance(filters, dict) and filters:
        encoded = urlencode(
            {k: v for k, v in filters.items() if v is not None},
            doseq=True,
        )
        if encoded:
            url = f"{url}?{encoded}"
    return url


def _parse_json_list(res: httpx.Response, operation: str, table: str) -> list[dict[str, Any]]:
    if not res.text or not res.text.strip():
        return []
    try:
        parsed = res.json()
    except ValueError as exc:
        print(f"[{operation} JSON ERROR] table={table} error={exc} body={res.text}")
        raise HTTPException(status_code=502, detail=f"Database {operation.lower()} operation failed")
    if isinstance(parsed, list):
        return parsed
    if isinstance(parsed, dict):
        return [parsed]
    return []


async def sb_select(
    table: str,
    params: dict[str, Any] | str | None = None,
) -> list[dict[str, Any]]:
    url = _build_url(table, params)
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(url, headers=_headers())
    except httpx.HTTPError as exc:
        print(f"[DB READ NETWORK ERROR] table={table} url={url} error={exc}")
        raise HTTPException(status_code=502, detail="Database read operation failed")

    if res.status_code >= 400:
        print(f"[DB READ ERROR] table={table} status={res.status_code} url={url} body={res.text}")
        raise HTTPException(status_code=502, detail="Database read operation failed")

    return _parse_json_list(res, "READ", table)


async def sb_insert(
    table: str,
    payload: dict[str, Any] | list[dict[str, Any]],
) -> list[dict[str, Any]]:
    url = _build_url(table)
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, headers=_headers(), json=payload)
    except httpx.HTTPError as exc:
        print(f"[DB INSERT NETWORK ERROR] table={table} url={url} error={exc}")
        raise HTTPException(status_code=502, detail="Database write operation failed")

    if res.status_code >= 400:
        print(f"[DB INSERT ERROR] table={table} status={res.status_code} url={url} body={res.text}")
        raise HTTPException(status_code=502, detail="Database write operation failed")

    return _parse_json_list(res, "INSERT", table)


async def sb_update(
    table: str,
    payload: dict[str, Any],
    params: dict[str, Any] | str | None = None,
) -> list[dict[str, Any]]:
    url = _build_url(table, params)
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.patch(url, headers=_headers(), json=payload)
    except httpx.HTTPError as exc:
        print(f"[DB UPDATE NETWORK ERROR] table={table} url={url} error={exc}")
        raise HTTPException(status_code=502, detail="Database update operation failed")

    if res.status_code >= 400:
        print(f"[DB UPDATE ERROR] table={table} status={res.status_code} url={url} body={res.text}")
        raise HTTPException(status_code=502, detail="Database update operation failed")

    return _parse_json_list(res, "UPDATE", table)


async def sb_delete(
    table: str,
    params: dict[str, Any] | str | None = None,
) -> list[dict[str, Any]]:
    url = _build_url(table, params)
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.delete(url, headers=_headers())
    except httpx.HTTPError as exc:
        print(f"[DB DELETE NETWORK ERROR] table={table} url={url} error={exc}")
        raise HTTPException(status_code=502, detail="Database delete operation failed")

    if res.status_code >= 400:
        print(f"[DB DELETE ERROR] table={table} status={res.status_code} url={url} body={res.text}")
        raise HTTPException(status_code=502, detail="Database delete operation failed")

    return _parse_json_list(res, "DELETE", table)