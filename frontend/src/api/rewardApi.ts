import type { Reward } from '../types/Reward'
import { apiFetch } from './apiFetch'

export async function createReward(title: string, cost: number): Promise<Reward> {
  return saveReward('/api/rewards', 'POST', title, cost)
}

export async function updateReward(id: number, title: string, cost: number): Promise<Reward> {
  return saveReward(`/api/rewards/${id}`, 'PATCH', title, cost)
}

async function saveReward(url: string, method: 'POST' | 'PATCH', title: string, cost: number): Promise<Reward> {
  const response = await apiFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, cost }),
  })
  if (!response.ok) {
    let message = `Nie udało się zapisać nagrody (HTTP ${response.status}).`
    try {
      const body: unknown = await response.json()
      if (typeof body === 'object' && body !== null && 'detail' in body && typeof body.detail === 'string') {
        message = body.detail
      }
    } catch {
      // The proxy may return a non-JSON error when the backend is unavailable.
    }
    throw new Error(message)
  }
  return response.json()
}

export async function getRewards(signal: AbortSignal): Promise<Reward[]> {
  const response = await apiFetch('/api/rewards', { signal })
  if (!response.ok) {
    throw new Error(`Pobieranie nagród nie powiodło się (HTTP ${response.status}).`)
  }
  return response.json()
}
