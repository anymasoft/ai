const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:7001"

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: any
  ) {
    super(`API Error: ${status} ${statusText}`)
  }
}

interface FetchOptions extends RequestInit {
  headers?: Record<string, string>
}

export async function fetchJSON<T = any>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new ApiError(response.status, response.statusText, errorData)
  }

  return response.json()
}

export function getApiBaseUrl() {
  return API_BASE_URL
}
