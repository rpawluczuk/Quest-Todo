export type GoalEntryType = 'NOTE' | 'SUCCESS' | 'DIFFICULTY' | 'INSIGHT'

export type GoalEntry = {
  id: number
  type: GoalEntryType
  content: string
  createdAt: string
  updatedAt: string
  // Only POST supplies this transaction result; older servers and history omit it.
  readonly reviewCompleted?: boolean
}

export type GoalEntries = { entries: GoalEntry[]; hasMore: boolean; totalElements: number }
