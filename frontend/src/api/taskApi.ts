import type { Task } from '../types/Task'

export async function updateTask(id: number, title: string, points: number): Promise<Task> {
  const response = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, points }),
  })

  if (!response.ok) {
    if (response.status === 404) throw new Error('Zadanie nie istnieje na serwerze. Odśwież stronę.')
    if (response.status === 409) throw new Error('Nie można edytować wykonanego zadania.')
    throw new Error(`Nie udało się zapisać zmian (HTTP ${response.status}).`)
  }

  return response.json()
}

export async function createTask(title: string, points: number): Promise<Task> {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, points }),
  })

  if (!response.ok) {
    throw new Error(`Zapis zadania nie powiódł się (HTTP ${response.status}).`)
  }

  return response.json()
}

export async function getTasks(signal: AbortSignal): Promise<Task[]> {
  const response = await fetch('/api/tasks', { signal })

  if (!response.ok) {
    throw new Error(`Pobieranie zadań nie powiodło się (HTTP ${response.status}).`)
  }

  return response.json()
}
