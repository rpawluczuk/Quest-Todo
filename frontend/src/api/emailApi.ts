import { apiFetch } from './apiFetch'

export type EmailStatus = { verifiedEmail: string | null; pendingEmail: string | null; expiresAt: string | null }

async function check(response: Response) {
  if (response.ok) return
  const error: { message?: string } = await response.json().catch(() => ({}))
  throw new Error(error.message ?? (response.status === 401 ? 'Zaloguj się ponownie.' : 'Nie udało się wykonać operacji. Spróbuj ponownie.'))
}

export async function getEmail(signal?: AbortSignal): Promise<EmailStatus> {
  const response = await apiFetch('/api/users/me/email', { signal })
  await check(response)
  return response.json()
}

export async function saveEmail(email: string, password: string, resend = false): Promise<void> {
  const response = await apiFetch(`/api/users/me/email${resend ? '/resend' : ''}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  })
  await check(response)
}

export async function confirmEmail(token: string): Promise<void> {
  const response = await apiFetch('/api/auth/email/confirm', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
  })
  await check(response)
}
