import type { Task } from './Task'
import type { TaskEmptyState } from '../taskEmptyState'

export type TaskSectionData = {
  readonly id: 'focus' | 'backlog' | 'completed'
  readonly title: string
  readonly description: string
  readonly emptyState: TaskEmptyState
  readonly tasks: readonly Task[]
}
