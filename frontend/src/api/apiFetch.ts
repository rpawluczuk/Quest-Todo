// Development uses the Vite proxy; published builds use the configured API origin.
const apiOrigin = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers)
  const method = (options.method ?? 'GET').toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // Fetch a fresh masked token, also after login/logout rotates the session token.
    const csrfResponse = await fetch(`${apiOrigin}/api/auth/csrf`, {
      credentials: 'include', cache: 'no-store', signal: options.signal,
    })
    if (!csrfResponse.ok) throw new Error('Nie udało się przygotować żądania. Spróbuj ponownie.')
    const csrf: { headerName: string; token: string } = await csrfResponse.json()
    headers.set(csrf.headerName, csrf.token)
  }
  const response = await fetch(`${apiOrigin}${path}`, {
    ...options, headers, credentials: 'include', cache: 'no-store',
  })
  if (response.status === 401 && !path.startsWith('/api/auth/')) {
    window.dispatchEvent(new Event('quest-session-expired'))
  }
  return response
}
