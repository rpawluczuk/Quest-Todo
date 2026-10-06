import { apiFetch } from './apiFetch'
import type { User } from './userApi'

export async function changePassword(currentPassword: string, newPassword: string, confirmation: string): Promise<void> {
  const response = await apiFetch('/api/auth/password', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword, confirmation }),
  })
  if (response.status === 401) {
    window.dispatchEvent(new Event('quest-session-expired'))
    throw new Error('Sesja wygasła. Zaloguj się ponownie.')
  }
  if (response.status === 400) {
    const error: { message?: string } = await response.json()
    throw new Error(error.message ?? 'Sprawdź wpisane hasła.')
  }
  if (!response.ok) throw new Error('Nie udało się zmienić hasła. Spróbuj ponownie.')
}

export async function register(login: string, password: string, email: string): Promise<string> {
  const response = await apiFetch('/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: login.trim(), password, email: email.trim() }),
  })
  if (response.status === 400 || response.status === 409) {
    const error: { message?: string } = await response.json()
    throw new Error(error.message ?? 'Sprawdź login i hasło.')
  }
  if (!response.ok) throw new Error('Nie udało się utworzyć konta. Spróbuj ponownie.')
  const result: { message: string } = await response.json()
  return result.message
}

export async function readSession(signal?: AbortSignal): Promise<User | null> {
  const response = await apiFetch('/api/users/me', { signal })
  if (response.status === 401) return null
  if (!response.ok) throw new Error('Nie udało się połączyć z aplikacją. Spróbuj ponownie.')
  return response.json()
}

export async function login(username: string, password: string): Promise<User> {
  const response = await apiFetch('/api/auth/login', {
    method: 'POST', body: new URLSearchParams({ username: username.trim(), password }),
  })
  if (response.status === 401) throw new Error('Nieprawidłowy login lub hasło.')
  if (response.status === 403) throw new Error('Nie udało się potwierdzić sesji. Odśwież stronę i spróbuj ponownie.')
  if (!response.ok) throw new Error('Nie udało się zalogować. Spróbuj ponownie.')
  const user = await readSession()
  if (!user) throw new Error('Przeglądarka nie zachowała sesji. Sprawdź, czy zezwala na ciasteczka tej strony.')
  return user
}

export async function logout(): Promise<void> {
  const response = await apiFetch('/api/auth/logout', { method: 'POST' })
  if (!response.ok) throw new Error('Nie udało się wylogować. Spróbuj ponownie.')
}
