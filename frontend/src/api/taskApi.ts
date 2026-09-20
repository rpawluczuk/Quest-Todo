import type { Task } from '../types/Task'

export async function getTasks(signal: AbortSignal): Promise<Task[]> {
  const response = await fetch('/api/tasks', { signal })

  if (!response.ok) {
    throw new Error(`Pobieranie zadań nie powiodło się (HTTP ${response.status}).`)
  }

  return response.json()
}
