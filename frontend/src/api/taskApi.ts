import type { Task } from '../types/Task'

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
