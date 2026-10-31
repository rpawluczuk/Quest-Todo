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
export function createGoalJournalStore(fetchEntries: (goalId: number, page?: number, size?: number) => Promise<GoalEntries>) {
  type History = GoalEntries & { pages: number }
  type Snapshot = { data: GoalEntries | null; loading: boolean; error: string; busy?: boolean;
    full?: boolean; history?: History; historyLoading?: boolean; historyError?: string;
    historyStale?: boolean; historyTarget?: number }
  const empty: Snapshot = { data: null, loading: false, error: '' }
  const entries = new Map<number, Snapshot>()
  const requests = new Map<number, Promise<void>>()
  const saves = new Map<number, Promise<void>>()
  const historyRequests = new Map<number, Promise<void>>()
  const listeners = new Set<() => void>()
  const get = (id: number) => entries.get(id) ?? empty
  function set(id: number, snapshot: Snapshot) {
    entries.set(id, snapshot)
    listeners.forEach(listener => listener())
  }
  function mutate(id: number, operation: () => Promise<void>): Promise<void> {
    if (saves.has(id)) return saves.get(id)!
    const request = Promise.resolve().then(async () => {
      await historyRequests.get(id)
      await operation()
    }).finally(() => {
      saves.delete(id)
      set(id, { ...get(id), busy: false })
    })
    saves.set(id, request)
    set(id, { ...get(id), busy: true })
    return request
  }
  async function readHistoryRange(id: number, target: number): Promise<History> {
    // Revalidate the already loaded prefix when extending an offset-paginated
    // list: external insertions/deletions can otherwise skip or repeat records.
    // Reopening cached history itself never performs these requests.
    for (let attempt = 0; attempt < 2; attempt++) {
      const result: GoalEntry[] = []
      const ids = new Set<number>()
      let total: number | undefined, hasMore = false, consistent = true, pages = 0
      for (let page = 0; page < target; page++) {
        const response = await fetchEntries(id, page, 10)
        if (total !== undefined && total !== response.totalElements) { consistent = false; break }
        total = response.totalElements
        for (const entry of response.entries) {
          if (ids.has(entry.id)) consistent = false
          else { ids.add(entry.id); result.push(entry) }
        }
        pages++; hasMore = response.hasMore
        if (!hasMore) break
      }
      if (consistent) return { entries: result, totalElements: total ?? 0, hasMore, pages }
    }
    throw new Error('Dziennik zmienił się podczas pobierania. Spróbuj ponownie.')
  }
  function loadHistory(id: number, target: number): Promise<void> {
    if (historyRequests.has(id)) return historyRequests.get(id)!
    set(id, { ...get(id), historyLoading: true, historyError: '', historyTarget: target })
    const request = (async () => {
      await requests.get(id)
      const history = await readHistoryRange(id, target)
      set(id, { ...get(id), history, historyStale: false, historyLoading: false, historyError: '',
        full: history.totalElements > 3 && get(id).full,
        data: { entries: history.entries.slice(0, 3), totalElements: history.totalElements, hasMore: history.totalElements > 3 } })
    })().catch(failure => {
      set(id, { ...get(id), historyLoading: false,
        historyError: failure instanceof Error ? failure.message : 'Nie udało się pobrać historii.' })
    }).finally(() => historyRequests.delete(id))
    historyRequests.set(id, request)
    return request
  }
  const store = {
    get,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    showHistory(id: number): Promise<void> {
      if (get(id).busy) return Promise.resolve()
      set(id, { ...get(id), full: true })
      if (get(id).history && !get(id).historyStale && !get(id).historyError) return Promise.resolve()
      return loadHistory(id, get(id).history?.pages ?? 1)
    },
    more(id: number): Promise<void> {
      if (get(id).busy) return Promise.resolve()
      if (historyRequests.has(id)) return historyRequests.get(id)!
      if (get(id).historyError) return loadHistory(id, get(id).historyTarget ?? 1)
      const history = get(id).history
      if (!history?.hasMore) return Promise.resolve()
      return loadHistory(id, history.pages + 1)
    },
    showLess(id: number) { set(id, { ...get(id), full: false }) },
    load(id: number, retry = false, refresh = false): Promise<void> {
      if (requests.has(id)) return requests.get(id)!
      if (!refresh && ((get(id).data && !(retry && get(id).error)) || (get(id).error && !retry))) return Promise.resolve()
      set(id, { ...get(id), loading: true, error: '' })
      const request = fetchEntries(id).then(data => {
        set(id, { ...get(id), data, loading: false, error: '' })
      }).catch(failure => {
        set(id, { ...get(id), loading: false,
          error: failure instanceof Error ? failure.message : 'Nie udało się pobrać wpisów dziennika.' })
      }).finally(() => requests.delete(id))
      requests.set(id, request)
      return request
    },
    create(id: number, save: () => Promise<GoalEntry>): Promise<void> {
      return mutate(id, async () => {
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
        set(id, { ...get(id), data: { entries: updated, totalElements, hasMore: totalElements > 3 }, loading: false, error: '' })
        const history = get(id).history
        if (history) {
          const items = [entry, ...history.entries.filter(item => item.id !== entry.id)]
            .sort((a, b) => entryTimeKey(b.createdAt).localeCompare(entryTimeKey(a.createdAt)) || b.id - a.id)
            .slice(0, history.pages * 10)
          set(id, { ...get(id), history: { ...history, entries: items, totalElements, hasMore: items.length < totalElements }, historyStale: true })
          if (get(id).full) await loadHistory(id, history.pages)
        } else if (get(id).full) await loadHistory(id, 1)
      })
    },
    update(id: number, save: () => Promise<GoalEntry>): Promise<void> {
      return mutate(id, async () => {
        await store.load(id, true)
        if (!get(id).data) throw new Error(get(id).error)
        const entry = await save()
        const latest = get(id).data!
        const history = get(id).history
        set(id, { ...get(id), data: { ...latest, entries: latest.entries.map(item => item.id === entry.id ? entry : item) },
          history: history ? { ...history, entries: history.entries.map(item => item.id === entry.id ? entry : item) } : undefined })
      })
    },
    remove(id: number, entryId: number, remove: () => Promise<void>): Promise<void> {
      return mutate(id, async () => {
        await store.load(id, true)
        if (!get(id).data) throw new Error(get(id).error)
        await remove()
        const latest = get(id).data!
        const totalElements = Math.max(0, latest.totalElements - 1)
        set(id, { ...get(id), data: { entries: latest.entries.filter(item => item.id !== entryId),
          totalElements, hasMore: totalElements > 3 } })
        const history = get(id).history
        if (history) set(id, { ...get(id), history: { ...history,
          entries: history.entries.filter(item => item.id !== entryId), totalElements, hasMore: totalElements > history.entries.length - 1 }, historyStale: true })
        // DELETE is already committed. A failed refill must offer a GET retry,
        // never ask the user to repeat the successful deletion.
        if (get(id).full) await loadHistory(id, history?.pages ?? 1)
        else await store.load(id, true, true)
      })
    },
  }
  return store
}
