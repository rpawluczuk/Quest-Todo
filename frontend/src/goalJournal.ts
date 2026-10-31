import type { GoalEntries, GoalEntryType } from './types/GoalEntry'

export const goalEntryLabels: Record<GoalEntryType, string> = {
  NOTE: 'Notatka', SUCCESS: 'Sukces', DIFFICULTY: 'Trudność', INSIGHT: 'Wniosek',
}

const entryDate = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Warsaw',
})
export function formatGoalEntryDate(value: string) { return entryDate.format(new Date(value)) }

// Owned by the goals page/session, not a module singleton. Only expanded journals load.
export function createGoalJournalStore(fetchEntries: (goalId: number) => Promise<GoalEntries>) {
  type Snapshot = { data: GoalEntries | null; loading: boolean; error: string }
  const empty: Snapshot = { data: null, loading: false, error: '' }
  const entries = new Map<number, Snapshot>()
  const requests = new Map<number, Promise<void>>()
  const listeners = new Set<() => void>()
  const get = (id: number) => entries.get(id) ?? empty
  function set(id: number, snapshot: Snapshot) {
    entries.set(id, snapshot)
    listeners.forEach(listener => listener())
  }
  return {
    get,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    load(id: number, retry = false): Promise<void> {
      if (requests.has(id)) return requests.get(id)!
      if (get(id).data || (get(id).error && !retry)) return Promise.resolve()
      set(id, { data: null, loading: true, error: '' })
      const request = fetchEntries(id).then(data => {
        set(id, { data, loading: false, error: '' })
      }).catch(failure => {
        set(id, { data: null, loading: false,
          error: failure instanceof Error ? failure.message : 'Nie udało się pobrać wpisów dziennika.' })
      }).finally(() => requests.delete(id))
      requests.set(id, request)
      return request
    },
  }
}
