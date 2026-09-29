// Development uses the Vite proxy; published builds use the configured API origin.
const apiOrigin = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

export function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${apiOrigin}${path}`, options)
}
