import type { Subtask } from '../types/Subtask'
import { apiFetch } from './apiFetch'

export async function getSubtasks(taskId: number): Promise<Subtask[]> {
  const response = await apiFetch(`/api/tasks/${taskId}/subtasks`)
  if (!response.ok) throw new Error('Nie udało się pobrać podzadań. Spróbuj ponownie.')
  return response.json()
}

async function write(taskId: number, id: number | null, method: string, body?: { title: string } | { completed: boolean }): Promise<Subtask | undefined> {
  const response = await apiFetch(`/api/tasks/${taskId}/subtasks${id === null ? '' : `/${id}`}`, {
    method, headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (!response.ok) {
    let message = 'Nie udało się zapisać podzadania. Spróbuj ponownie.'
    try { const body = await response.json(); if (typeof body.detail === 'string') message = body.detail } catch { /* Non-JSON error. */ }
    throw new Error(message)
  }
  return method === 'DELETE' ? undefined : response.json()
}
export async function createSubtask(taskId: number, title: string): Promise<Subtask> {
  return (await write(taskId, null, 'POST', { title }))!
}
export async function renameSubtask(taskId: number, id: number, title: string): Promise<Subtask> {
  return (await write(taskId, id, 'PATCH', { title }))!
}
export async function setSubtaskCompleted(taskId: number, id: number, completed: boolean): Promise<Subtask> {
  return (await write(taskId, id, 'PATCH', { completed }))!
}
export async function deleteSubtask(taskId: number, id: number): Promise<void> {
  await write(taskId, id, 'DELETE')
}

export class SubtaskOrderConflict extends Error {}
export async function reorderSubtasks(taskId: number, subtaskIds: number[]): Promise<Subtask[]> {
  const response = await apiFetch(`/api/tasks/${taskId}/subtasks/order`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subtaskIds }),
  })
  if (response.status === 409) throw new SubtaskOrderConflict('Lista podzadań zmieniła się. Spróbuj ponownie po jej odświeżeniu.')
  if (!response.ok) throw new Error('Nie udało się zapisać kolejności. Spróbuj ponownie.')
  return response.json()
}
