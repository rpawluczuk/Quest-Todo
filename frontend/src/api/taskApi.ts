import type { Task } from '../types/Task'

async function responseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (typeof body === 'object' && body !== null && 'detail' in body && typeof body.detail === 'string') {
      return body.detail
    }
  } catch {
    // Odpowiedź błędu nie zawsze zawiera JSON, np. gdy backend jest niedostępny za proxy.
  }
  return `${fallback} (HTTP ${response.status}).`
}

export async function deleteTask(id: number): Promise<void> {
  const response = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
  // Zadanie mogło zostać usunięte w innym oknie lub podczas poprzedniej próby.
  if (!response.ok && response.status !== 404) {
    throw new Error(`Nie udało się usunąć zadania (HTTP ${response.status}).`)
  }
}

async function updateTaskState(id: number, endpoint: string, body: object): Promise<Task> {
  const response = await fetch(`/api/tasks/${id}/${endpoint}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    if (response.status === 404) throw new Error('Zadanie nie istnieje na serwerze. Odśwież stronę.')
    throw new Error(`Nie udało się zapisać zmiany (HTTP ${response.status}).`)
  }
  return response.json()
}

export function updateTaskCompletion(id: number, completed: boolean): Promise<Task> {
  return updateTaskState(id, 'completion', { completed })
}

export function updateTaskFocus(id: number, inFocus: boolean): Promise<Task> {
  return updateTaskState(id, 'focus', { inFocus })
}

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
    throw new Error(await responseErrorMessage(response, 'Zapis zadania nie powiódł się'))
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
