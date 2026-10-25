import type { Subtask } from '../types/Subtask'
import { apiFetch } from './apiFetch'

export async function getSubtasks(taskId: number): Promise<Subtask[]> {
  const response = await apiFetch(`/api/tasks/${taskId}/subtasks`)
  if (!response.ok) throw new Error('Nie udało się pobrać podzadań. Spróbuj ponownie.')
  return response.json()
}
