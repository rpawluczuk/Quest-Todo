import { apiFetch } from './apiFetch'
import type { Goal } from '../types/Goal'
import type { Task } from '../types/Task'
import type { GoalEntries, GoalEntry, GoalEntryType } from '../types/GoalEntry'

export async function createGoalEntry(goalId: number, type: GoalEntryType, content: string): Promise<GoalEntry> {
  try {
    const response = await apiFetch(`/api/goals/${goalId}/entries`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, content: content.trim() }),
    })
    if (response.status === 401) throw new Error('Sesja wygasła. Zaloguj się ponownie.')
    if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się dodać wpisu'))
    return response.json()
  } catch (failure) {
    if (failure instanceof TypeError) throw new Error('Brak połączenia. Sprawdź sieć i spróbuj ponownie.')
    throw failure
  }
}

export async function getGoalEntries(goalId: number): Promise<GoalEntries> {
  const response = await apiFetch(`/api/goals/${goalId}/entries?page=0&size=3`)
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się pobrać wpisów dziennika'))
  return response.json()
}

export type Milestone = { id: number; title: string; completed: boolean; position: number }

export class MilestoneOrderConflict extends Error {}

export async function reorderMilestones(goalId: number, milestoneIds: number[]): Promise<Milestone[]> {
  const response = await apiFetch(`/api/goals/${goalId}/milestones/order`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ milestoneIds }),
  })
  if (!response.ok) {
    const message = await errorMessage(response, 'Nie udało się zapisać kolejności kamieni milowych')
    if (response.status === 409) throw new MilestoneOrderConflict(message)
    throw new Error(message)
  }
  return response.json()
}

export async function renameMilestone(goalId: number, id: number, title: string): Promise<Milestone> {
  const response = await apiFetch(`/api/goals/${goalId}/milestones/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }),
  })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się zapisać nazwy kamienia milowego'))
  return response.json()
}

export async function deleteMilestone(goalId: number, id: number): Promise<void> {
  const response = await apiFetch(`/api/goals/${goalId}/milestones/${id}`, { method: 'DELETE' })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się usunąć kamienia milowego'))
}

export async function setMilestoneCompleted(goalId: number, id: number, completed: boolean): Promise<Milestone> {
  const response = await apiFetch(`/api/goals/${goalId}/milestones/${id}/completion`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed }),
  })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się zapisać ukończenia kamienia milowego'))
  return response.json()
}

export async function getMilestones(goalId: number, signal?: AbortSignal): Promise<Milestone[]> {
  const response = await apiFetch(`/api/goals/${goalId}/milestones`, { signal })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się pobrać kamieni milowych'))
  return response.json()
}

export async function createMilestone(goalId: number, title: string): Promise<Milestone> {
  const response = await apiFetch(`/api/goals/${goalId}/milestones`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }),
  })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się dodać kamienia milowego'))
  return response.json()
}

export type GoalHabit = { id: number; name: string }
export type AvailableGoalHabits = { habits: GoalHabit[]; hasMore: boolean }

export async function getGoalHabits(goalId: number, signal?: AbortSignal): Promise<GoalHabit[]> {
  const response = await apiFetch(`/api/goals/${goalId}/habits`, { signal })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się pobrać nawyków celu'))
  return response.json()
}

export async function getAvailableGoalHabits(
  goalId: number, query: string, page: number, signal?: AbortSignal,
): Promise<AvailableGoalHabits> {
  const params = new URLSearchParams({ query, page: String(page), size: '20' })
  const response = await apiFetch(`/api/goals/${goalId}/habits/available?${params}`, { signal })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się pobrać nawyków do przypięcia'))
  return response.json()
}

export async function setGoalHabit(goalId: number, habitId: number, attached: boolean): Promise<void> {
  const response = await apiFetch(`/api/goals/${goalId}/habits/${habitId}`, { method: attached ? 'PUT' : 'DELETE' })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się zmienić przypięcia nawyku'))
}

export type AvailableGoalTasks = {
  tasks: Task[]
  hasMore: boolean
}

export async function getGoalTasks(goalId: number, signal?: AbortSignal): Promise<Task[]> {
  const response = await apiFetch(`/api/goals/${goalId}/tasks`, { signal })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się pobrać zadań celu'))
  return response.json()
}

export async function getAvailableGoalTasks(
  goalId: number,
  completed: boolean,
  query: string,
  page: number,
  signal?: AbortSignal,
): Promise<AvailableGoalTasks> {
  const params = new URLSearchParams({ completed: String(completed), query, page: String(page), size: '20' })
  const response = await apiFetch(`/api/goals/${goalId}/tasks/available?${params}`, { signal })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się pobrać zadań do przypięcia'))
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

export async function createGoal(title: string, currentState: string, desiredOutcome: string): Promise<Goal> {
  const response = await apiFetch('/api/goals', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, currentState, desiredOutcome }),
  })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się dodać celu'))
  return response.json()
}

export async function updateGoal(id: number, title: string, currentState: string, desiredOutcome: string): Promise<Goal> {
  const response = await apiFetch(`/api/goals/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, currentState, desiredOutcome }),
  })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się zapisać celu'))
  return response.json()
}

export async function updateGoalCompletion(id: number, completed: boolean): Promise<Goal> {
  const response = await apiFetch(`/api/goals/${id}/completion`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed }),
  })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się zmienić statusu celu'))
  return response.json()
}

export async function deleteGoal(id: number): Promise<void> {
  const response = await apiFetch(`/api/goals/${id}`, { method: 'DELETE' })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się usunąć celu'))
}
