export type User = { id: number; name: string; points: number }
export type Purchase = { id: number; rewardId: number; title: string; cost: number }

export async function getUser(signal?: AbortSignal): Promise<User> {
  const response = await fetch('/api/users/me', { signal })
  if (!response.ok) throw new Error('Nie udało się pobrać salda punktów.')
  return response.json()
}

export async function getPurchases(signal?: AbortSignal): Promise<Purchase[]> {
  const response = await fetch('/api/rewards/purchases', { signal })
  if (!response.ok) throw new Error('Nie udało się pobrać zakupów.')
  return response.json()
}

export async function purchaseReward(id: number): Promise<Purchase> {
  const response = await fetch(`/api/rewards/${id}/purchases`, { method: 'POST' })
  if (response.status === 409) throw new Error('Za mało punktów na tę nagrodę.')
  if (!response.ok) throw new Error('Nie udało się kupić nagrody.')
  return response.json()
}
