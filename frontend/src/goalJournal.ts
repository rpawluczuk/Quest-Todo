import type { GoalEntries, GoalEntry, GoalEntryType } from './types/GoalEntry'

export const goalEntryLabels: Record<GoalEntryType, string> = {
  NOTE: 'Notatka', SUCCESS: 'Sukces', DIFFICULTY: 'Trudność', INSIGHT: 'Wniosek',
}

const entryDate = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Warsaw',
})
export function formatGoalEntryDate(value: string) { return entryDate.format(new Date(value)) }

// Instant serializes fractional seconds with variable precision. Normalize them
// before comparing, retaining the database's sub-millisecond ordering.
function entryTimeKey(value: string) {
  return value.replace(/(?:\.(\d+))?Z$/, (_match, fraction: string = '') => `.${fraction.padEnd(9, '0')}Z`)
}

// Owned by the goals page/session, not a module singleton. Only expanded journals load.
export function createGoalJournalStore(fetchEntries: (goalId: number) => Promise<GoalEntries>) {
  type Snapshot = { data: GoalEntries | null; loading: boolean; error: string }
  const empty: Snapshot = { data: null, loading: false, error: '' }
  const entries = new Map<number, Snapshot>()
  const requests = new Map<number, Promise<void>>()
  const saves = new Map<number, Promise<void>>()
  const listeners = new Set<() => void>()
  const get = (id: number) => entries.get(id) ?? empty
  function set(id: number, snapshot: Snapshot) {
    entries.set(id, snapshot)
    listeners.forEach(listener => listener())
  }
  const store = {
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
    create(id: number, save: () => Promise<GoalEntry>): Promise<void> {
      if (saves.has(id)) return saves.get(id)!
      const request = (async () => {
        // Finish the initial read before writing: its late response must not replace
        // the new entry, and the total cannot be inferred from the three visible rows.
        await store.load(id, true)
        const current = get(id).data
        if (!current) throw new Error(get(id).error)
        const entry = await save()
        const latest = get(id).data ?? current
        const alreadyPresent = latest.entries.some(item => item.id === entry.id)
        const totalElements = latest.totalElements + (alreadyPresent ? 0 : 1)
        const updated = [entry, ...latest.entries.filter(item => item.id !== entry.id)]
          .sort((a, b) => entryTimeKey(b.createdAt).localeCompare(entryTimeKey(a.createdAt)) || b.id - a.id).slice(0, 3)
        set(id, { data: { entries: updated, totalElements, hasMore: totalElements > 3 }, loading: false, error: '' })
      })().finally(() => saves.delete(id))
      saves.set(id, request)
      return request
    },
  }
  return store
}
