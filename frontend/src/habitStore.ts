import { createHabitStatusUpdates } from './habitStatusUpdates.ts'
import type { Habit } from './types/Habit'

export function habitStatusAction(habit: Pick<Habit, 'activityStatus'>) {
  if (habit.activityStatus === 'PLANNED') return { next: 'ACTIVE' as const, label: 'Rozpocznij nawyk', message: 'Nawyk został rozpoczęty', icon: 'play' as const }
  if (habit.activityStatus === 'PAUSED') return { next: 'ACTIVE' as const, label: 'Wznów nawyk', message: 'Nawyk został wznowiony', icon: 'play' as const }
  return { next: 'PAUSED' as const, label: 'Wstrzymaj nawyk', message: 'Nawyk został wstrzymany', icon: 'pause' as const }
}

// Session-scoped, shared by the daily view and every goal. Counts remain date-specific.
export function createHabitStore(fetchHabits: (date: string) => Promise<Habit[]>,
  saveStatus: (id: number, status: 'ACTIVE' | 'PAUSED') => Promise<Habit>) {
  const entries = new Map<string, Habit[]>()
  const generations = new Map<string, number>()
  const requests = new Map<string, Promise<Habit[]>>()
  const listeners = new Set<() => void>()
  const statusUpdates = createHabitStatusUpdates()
  let revision = 0
  const emit = () => { revision++; listeners.forEach(listener => listener()) }
  const get = (date: string) => entries.get(date)
  function set(date: string, value: Habit[] | ((current: Habit[]) => Habit[])) {
    entries.set(date, typeof value === 'function' ? value(get(date) ?? []) : value)
    generations.set(date, (generations.get(date) ?? 0) + 1)
    emit()
  }
  return {
    get, set, statusUpdates,
    update(habit: Habit, sourceDate: string) {
      for (const [date, items] of entries) {
        if (!items.some(item => item.id === habit.id)) continue
        set(date, items.map(item => item.id !== habit.id ? item : date === sourceDate ? habit : {
          ...habit, completed: item.completed, weeklyCompletedDays: item.weeklyCompletedDays,
          weeklyRewardGranted: item.weeklyRewardGranted, target: item.target, status: item.status,
          regularity: item.regularity,
        }))
      }
    },
    updateGoalLink(id: number, goalId: number, goalTitle: string, attached: boolean) {
      for (const [date, items] of entries) {
        if (!items.some(item => item.id === id)) continue
        set(date, items.map(item => {
          if (item.id !== id) return item
          const links = new Map(item.goalIds.map((id, index) => [id, item.goalTitles[index]]))
          if (attached) links.set(goalId, goalTitle)
          else links.delete(goalId)
          const sorted = [...links].sort(([a], [b]) => a - b)
          return { ...item, goalIds: sorted.map(([id]) => id), goalTitles: sorted.map(([, title]) => title) }
        }))
      }
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    revision: () => revision,
    load(date: string, refresh = false): Promise<Habit[]> {
      if (requests.has(date)) return requests.get(date)!
      if (!refresh && get(date)) return Promise.resolve(get(date)!)
      const generation = generations.get(date) ?? 0
      const version = statusUpdates.version()
      const request = fetchHabits(date).then(items => {
        if ((generations.get(date) ?? 0) === generation) set(date, statusUpdates.merge(items, version))
        return get(date) ?? []
      }).finally(() => requests.delete(date))
      requests.set(date, request)
      return request
    },
    async changeStatus(habit: Habit, next: 'ACTIVE' | 'PAUSED') {
      const action = habitStatusAction(habit)
      if (action.next !== next || !statusUpdates.begin(habit.id)) return null
      emit()
      try {
        const saved = await saveStatus(habit.id, next)
        statusUpdates.saved(saved.id, saved.activityStatus as 'ACTIVE' | 'PAUSED')
        // PATCH counters refer to today; never replace a selected historical week's counts.
        for (const [date, items] of entries) {
          if (items.some(item => item.id === saved.id))
            set(date, items.map(item => item.id === saved.id ? { ...item, activityStatus: saved.activityStatus } : item))
        }
        return saved
      } finally { statusUpdates.finish(habit.id); emit() }
    },
  }
}
