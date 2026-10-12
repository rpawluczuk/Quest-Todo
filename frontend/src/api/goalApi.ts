import { apiFetch } from './apiFetch'
import type { Goal } from '../types/Goal'
import type { Task } from '../types/Task'

export async function getGoalTasks(goalId: number, signal?: AbortSignal): Promise<Task[]> {
  const response = await apiFetch(`/api/goals/${goalId}/tasks`, { signal })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się pobrać zadań celu'))
  return response.json()
}

export async function setGoalTask(goalId: number, taskId: number, attached: boolean): Promise<void> {
  const response = await apiFetch(`/api/goals/${goalId}/tasks/${taskId}`, { method: attached ? 'PUT' : 'DELETE' })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się zmienić przypięcia zadania'))
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const problem = await response.json().catch(() => null) as { detail?: string } | null
  return problem?.detail ?? `${fallback} (HTTP ${response.status}).`
}

export async function getGoals(signal?: AbortSignal): Promise<Goal[]> {
  const response = await apiFetch('/api/goals', { signal })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się pobrać celów'))
  return response.json()
}

export async function createGoal(title: string): Promise<Goal> {
  const response = await apiFetch('/api/goals', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }),
  })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się dodać celu'))
  return response.json()
}

export async function updateGoal(id: number, title: string): Promise<Goal> {
  const response = await apiFetch(`/api/goals/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }),
  })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się zapisać celu'))
  return response.json()
}

export async function deleteGoal(id: number): Promise<void> {
  const response = await apiFetch(`/api/goals/${id}`, { method: 'DELETE' })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się usunąć celu'))
}
