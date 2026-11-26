let accessToken: string | null = null
let onSessionExpired: (() => void) | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler
}

async function refreshAccessToken(): Promise<string | null> {
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  })
  if (!res.ok) return null
  const data = await res.json()
  accessToken = data.access_token
  return accessToken
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  retryOn401 = true
): Promise<Response> {
  const headers = new Headers(options.headers || {})
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`)
  }
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }


  
  let res = await fetch(path, {
    ...options,
    headers,
    credentials: "include",
  })

  if (res.status === 401 && retryOn401 && !path.startsWith("/api/auth/login") && !path.startsWith("/api/auth/refresh")) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`)
      res = await fetch(path, {
        ...options,
        headers,
        credentials: "include",
      })
    } else if (onSessionExpired) {
      onSessionExpired()
    }
  }

  return res
}

export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, options)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail || `Request failed (${res.status})`)
  }
  return res.json()
}