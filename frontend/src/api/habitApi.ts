import { apiFetch } from './apiFetch'
import type { Habit, HabitCompletionResult } from '../types/Habit'

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const problem = await response.json().catch(() => null) as { detail?: string } | null
  return problem?.detail ?? `${fallback} (HTTP ${response.status}).`
}

export async function getHabits(date: string, signal?: AbortSignal): Promise<Habit[]> {
  const response = await apiFetch(`/api/habits?date=${encodeURIComponent(date)}`, { signal })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się pobrać nawyków'))
  return response.json()
}

export async function setHabitCompletion(id: number, date: string, completed: boolean): Promise<HabitCompletionResult> {
  const response = await apiFetch(`/api/habits/${id}/completions/${encodeURIComponent(date)}`, {
    method: completed ? 'PUT' : 'DELETE',
  })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się zapisać wykonania nawyku'))
  return response.json()
}

export async function undoHabitAward(id: number, awardId: string): Promise<HabitCompletionResult> {
  const response = await apiFetch(`/api/habits/${id}/awards/${awardId}/undo`, { method: 'POST' })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się cofnąć nagrody'))
  return response.json()
}

export async function createHabit(name: string, targetDays: number, rewardPoints: number): Promise<Habit> {
  const response = await apiFetch('/api/habits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, targetDays, rewardPoints }),
  })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się dodać nawyku'))
  return response.json()
}

export async function updateHabit(id: number, name: string, targetDays: number, rewardPoints: number): Promise<Habit> {
  const response = await apiFetch(`/api/habits/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, targetDays, rewardPoints }),
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
