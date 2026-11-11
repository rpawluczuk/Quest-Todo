import { createGoalJournalStore } from './goalJournal.ts'
import type { GoalEntries } from './types/GoalEntry'
import type { JournalDraft } from './types/JournalDraft'

// A separate instance namespaces habit data from goals and other sessions.
// Reuse the journal cache's preview slot (page=0, size=3), deduplication and
// per-parent snapshots and history pages, without sharing data with goals.
export function createHabitJournalStore(fetchEntries: (id: number, page: number, size: number) => Promise<GoalEntries>) {
  return { ...createGoalJournalStore((id, page = 0, size = 3) => fetchEntries(id, page, size)),
    // A refreshed habit may move between lists and remount its panel.
    // Keep unsaved text within this session, separate from confirmed API data.
    drafts: new Map<number, JournalDraft>() }
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
