import { apiFetch } from './apiFetch'
import type { User } from './userApi'

export async function register(login: string, password: string): Promise<void> {
  const response = await apiFetch('/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: login.trim(), password }),
  })
  if (response.status === 400 || response.status === 409) {
    const error: { message?: string } = await response.json()
    throw new Error(error.message ?? 'Sprawdź login i hasło.')
  }
  if (!response.ok) throw new Error('Nie udało się utworzyć konta. Spróbuj ponownie.')
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
