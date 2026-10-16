import type { Task } from './types/Task'

const polishCollator = new Intl.Collator('pl', { sensitivity: 'base', numeric: true })

function sortedGoalTitles(task: Task): string[] {
  return [...new Set(task.goalTitles ?? [])].sort(polishCollator.compare)
}

export function sortActiveTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((left, right) => {
    const leftGoals = sortedGoalTitles(left)
    const rightGoals = sortedGoalTitles(right)
    const leftGroup = leftGoals.length > 0 ? 0 : left.category ? 1 : 2
    const rightGroup = rightGoals.length > 0 ? 0 : right.category ? 1 : 2

    if (leftGroup !== rightGroup) return leftGroup - rightGroup

    if (leftGroup === 0) {
      const goalOrder = polishCollator.compare(leftGoals[0], rightGoals[0])
      if (goalOrder !== 0) return goalOrder
    } else if (leftGroup === 1) {
      const categoryOrder = polishCollator.compare(left.category!.name, right.category!.name)
      if (categoryOrder !== 0) return categoryOrder
    }

    return polishCollator.compare(left.title, right.title) || left.id - right.id
  })
}
