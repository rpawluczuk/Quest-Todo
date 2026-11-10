import { createGoalJournalStore } from './goalJournal.ts'
import type { GoalEntries } from './types/GoalEntry'

// A separate instance namespaces habit data from goals and other sessions.
// Reuse the journal cache's preview slot (page=0, size=3), deduplication and
// per-parent snapshots. Expose only reads in this stage.
export function createHabitJournalStore(fetchEntries: (id: number, page: number, size: number) => Promise<GoalEntries>) {
  const store = createGoalJournalStore(id => fetchEntries(id, 0, 3))
  return { get: store.get, subscribe: store.subscribe, load: store.load }
}

export type HabitJournalStore = ReturnType<typeof createHabitJournalStore>
