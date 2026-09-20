import type { Task } from './Task'

export type TaskSectionData = {
  readonly id: 'focus' | 'backlog'
  readonly title: string
  readonly description: string
  readonly emptyMessage: string
  readonly tasks: readonly Task[]
}
