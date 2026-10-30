import type { Habit } from './types/Habit'

// Protect status writes from older in-flight list responses, including across day changes.
export function createHabitStatusUpdates() {
  let version = 0
  const saved = new Map<number, { version: number; status: 'ACTIVE' | 'PAUSED' }>()
  const created = new Map<number, { version: number; habit: Habit }>()
  const pending = new Set<number>()
  return {
    begin(id: number) { if (pending.has(id)) return false; pending.add(id); return true },
    finish(id: number) { pending.delete(id) },
    pending: (id: number) => pending.has(id),
    pendingIds: () => new Set(pending),
    version: () => version,
    saved(id: number, status: 'ACTIVE' | 'PAUSED') { saved.set(id, { version: ++version, status }) },
    created(habit: Habit) { created.set(habit.id, { version: ++version, habit }) },
    merge(habits: Habit[], readVersion: number) {
      const ids = new Set(habits.map(habit => habit.id))
      const missing = [...created.values()].filter(item => item.version > readVersion && !ids.has(item.habit.id))
      return [...habits, ...missing.map(item => item.habit)].map(habit => {
        const update = saved.get(habit.id)
        return update && update.version > readVersion ? { ...habit, activityStatus: update.status } : habit
      })
    },
  }
}
