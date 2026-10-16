import { apiFetch } from './apiFetch'
import type { Category, CategoryColor, CategoryIcon } from '../types/Category'

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const problem = await response.json().catch(() => null) as { detail?: string } | null
  return problem?.detail ?? `${fallback} (HTTP ${response.status}).`
}

export async function getCategories(signal?: AbortSignal): Promise<Category[]> {
  const response = await apiFetch('/api/categories', { signal })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się pobrać kategorii'))
  return response.json()
}

export async function createCategory(
  name: string, icon: CategoryIcon, color: CategoryColor,
): Promise<Category> {
  const response = await apiFetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, icon, color }),
  })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się utworzyć kategorii'))
  return response.json()
}

export async function updateCategory(
  id: number, name: string, icon: CategoryIcon, color: CategoryColor,
): Promise<Category> {
  const response = await apiFetch(`/api/categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, icon, color }),
  })
  if (!response.ok) throw new Error(await errorMessage(response, 'Nie udało się zapisać kategorii'))
  return response.json()
}

export async function deleteCategory(id: number): Promise<void> {
  const response = await apiFetch(`/api/categories/${id}`, { method: 'DELETE' })
  if (!response.ok && response.status !== 404) {
    throw new Error(await errorMessage(response, 'Nie udało się usunąć kategorii'))
  }
}
