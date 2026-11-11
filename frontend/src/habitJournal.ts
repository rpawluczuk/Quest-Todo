import { createGoalJournalStore } from './goalJournal.ts'
import type { GoalEntries } from './types/GoalEntry'

// A separate instance namespaces habit data from goals and other sessions.
// Reuse the journal cache's preview slot (page=0, size=3), deduplication and
// per-parent snapshots. History remains unavailable in the habit journal.
export function createHabitJournalStore(fetchEntries: (id: number, page: number, size: number) => Promise<GoalEntries>) {
  const store = createGoalJournalStore(id => fetchEntries(id, 0, 3))
  return { get: store.get, subscribe: store.subscribe, load: store.load,
    create: store.create, update: store.update, remove: store.remove }
}

export type HabitJournalStore = ReturnType<typeof createHabitJournalStore>

// The list's status describes the selected calendar day. Journal permissions
// instead follow today's schedule, including a manual ending and lifetime limit.
export function habitJournalReadOnly(habit: Pick<import('./types/Habit').Habit,
  'endedOn' | 'startDate' | 'endDate' | 'completionLimit' | 'totalCompletions'>, today: string) {
  if (habit.endedOn && habit.endedOn <= today) return true
  if (habit.startDate > today) return false
  return !!(habit.endDate && habit.endDate < today)
    || (habit.completionLimit !== null && habit.totalCompletions >= habit.completionLimit)
}
