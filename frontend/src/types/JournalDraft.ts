import type { GoalEntry, GoalEntryType } from './GoalEntry'

export type JournalDraft = { entry?: GoalEntry; type: GoalEntryType; content: string }
