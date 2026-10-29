import type { Subtask } from './types/Subtask'

export function createSubtaskStore(fetchItems: (taskId: number) => Promise<Subtask[]>) {
  type Entry = { items: Subtask[] | null; owner: symbol | null }
  const empty: Entry = { items: null, owner: null }
  const entries = new Map<number, Entry>()
  const requests = new Map<number, Promise<Subtask[]>>()
  const listeners = new Set<() => void>()
  const get = (id: number) => entries.get(id) ?? empty
  function emit() { listeners.forEach(listener => listener()) }
  function set(id: number, items: Subtask[] | null) {
    entries.set(id, { ...get(id), items }); emit()
  }
  return {
    get, set,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    claim(id: number, owner: symbol) {
      if (get(id).owner && get(id).owner !== owner) return false
      entries.set(id, { ...get(id), owner }); emit(); return true
    },
    release(id: number, owner: symbol) {
      if (get(id).owner === owner) { entries.set(id, { ...get(id), owner: null }); emit() }
    },
    load(id: number, refresh = false): Promise<Subtask[]> {
      if (!refresh && get(id).items) return Promise.resolve(get(id).items!)
      if (requests.has(id)) return requests.get(id)!
      const before = get(id).items
      const request = fetchItems(id).then(items => {
        // A mutation published since this read began must win over the old response.
        if (get(id).items === before) set(id, items)
        return get(id).items ?? items
      }).finally(() => { requests.delete(id) })
      requests.set(id, request)
      return request
    },
  }
}
