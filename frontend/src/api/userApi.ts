import { apiFetch } from './apiFetch'

export type User = { id: number; name: string; points: number }
export type Purchase = {
  id: number
  rewardId: number
  title: string
  cost: number
  purchasedAt: string | null
  usedAt: string | null
}

export async function getUser(signal?: AbortSignal): Promise<User> {
  const response = await apiFetch('/api/users/me', { signal })
  if (!response.ok) throw new Error('Nie udało się pobrać salda punktów.')
  return response.json()
}

export async function getPurchases(signal?: AbortSignal): Promise<Purchase[]> {
  const response = await apiFetch('/api/rewards/purchases', { signal })
  if (!response.ok) throw new Error('Nie udało się pobrać zakupów.')
  return response.json()
}

export async function purchaseReward(id: number): Promise<Purchase> {
  const response = await apiFetch(`/api/rewards/${id}/purchases`, { method: 'POST' })
  if (response.status === 409) throw new Error('Za mało punktów na tę nagrodę.')
  if (!response.ok) throw new Error('Nie udało się kupić nagrody.')
  return response.json()
}

export async function consumePurchase(id: number): Promise<Purchase> {
  const response = await apiFetch(`/api/rewards/purchases/${id}/use`, { method: 'POST' })
  if (response.status === 409) throw new Error('Ta nagroda została już wykorzystana.')
  if (response.status === 404) {
    const problem = await response.json().catch(() => null)
    throw new Error(problem?.detail === 'Zakup nie istnieje.'
      ? 'Nie znaleziono tego zakupu.'
      : 'Funkcja wykorzystania nagród jest obecnie niedostępna. Spróbuj ponownie później.')
  }
  if (!response.ok) throw new Error('Nie udało się wykorzystać nagrody. Spróbuj ponownie.')
  return response.json()
}
