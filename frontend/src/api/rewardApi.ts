import type { Reward } from '../types/Reward'

export async function getRewards(signal: AbortSignal): Promise<Reward[]> {
  const response = await fetch('/api/rewards', { signal })
  if (!response.ok) {
    throw new Error(`Pobieranie nagród nie powiodło się (HTTP ${response.status}).`)
  }
  return response.json()
}
