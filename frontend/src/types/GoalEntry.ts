export type GoalEntryType = 'NOTE' | 'SUCCESS' | 'DIFFICULTY' | 'INSIGHT'

export type GoalEntry = {
  id: number
  type: GoalEntryType
  content: string
  createdAt: string
  updatedAt: string
}

export type GoalEntries = { entries: GoalEntry[]; hasMore: boolean; totalElements: number }
