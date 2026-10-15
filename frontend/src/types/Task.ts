export type Task = {
  id: number
  title: string
  description: string | null
  points: number
  completed: boolean
  completedAt: string | null
  inFocus: boolean
  dueDate: string | null
  dueTime: string | null
  goalTitles: string[]
}
