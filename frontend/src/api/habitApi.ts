import { apiFetch } from './apiFetch'
import type { Habit } from '../types/Habit'

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const problem = await response.json().catch(() => null) as { detail?: string } | null
  return problem?.detail ?? `${fallback} (HTTP ${response.status}).`
}

export async function getHabits(signal?: AbortSignal): Promise<Habit[]> {
  const response = await apiFetch('/api/habits', { signal })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się pobrać nawyków'))
  return response.json()
}

export async function createHabit(name: string): Promise<Habit> {
  const response = await apiFetch('/api/habits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się dodać nawyku'))
  return response.json()
}

export async function updateHabit(id: number, name: string): Promise<Habit> {
  const response = await apiFetch(`/api/habits/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!response.ok) {
    if (response.status === 404) throw new Error('Nawyk nie istnieje. Odśwież stronę.')
    throw new Error(await errorMessage(response, 'Nie udało się zapisać nawyku'))
  }
  return response.json()
}

export async function deleteHabit(id: number): Promise<void> {
  const response = await apiFetch(`/api/habits/${id}`, { method: 'DELETE' })
  if (!response.ok && response.status !== 404) {
    throw new Error(await errorMessage(response, 'Nie udało się usunąć nawyku'))
  }
}
