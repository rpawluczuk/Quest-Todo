import { apiFetch } from './apiFetch'
import type { GoalEntryType } from '../types/GoalEntry'

export async function journalMutation(path: string, method: string, body?: { type: GoalEntryType; content: string },
  unavailable = 'Wpis lub cel nie jest już dostępny. Mógł zostać usunięty albo nie masz do niego dostępu.') {
  try {
    const response = await apiFetch(path, {
      method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    })
    if (response.status === 401) throw new Error('Sesja wygasła. Zaloguj się ponownie.')
    if (response.status === 404 || response.status === 403) throw new Error(unavailable)
    if (!response.ok) {
      const problem = await response.json().catch(() => null) as { detail?: string } | null
      throw new Error(problem?.detail ?? `Nie udało się zapisać zmian w dzienniku (HTTP ${response.status}).`)
    }
    return response
  } catch (failure) {
    if (failure instanceof TypeError) throw new Error('Brak połączenia. Sprawdź sieć i spróbuj ponownie.')
    throw failure
  }
}
