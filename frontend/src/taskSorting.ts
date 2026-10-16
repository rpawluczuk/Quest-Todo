import type { Task } from './types/Task'

const polishCollator = new Intl.Collator('pl', { sensitivity: 'base', numeric: true })

export function sortActiveTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((left, right) => {
    const leftGroup = left.goalTitle ? 0 : left.category ? 1 : 2
    const rightGroup = right.goalTitle ? 0 : right.category ? 1 : 2

    if (leftGroup !== rightGroup) return leftGroup - rightGroup

    if (leftGroup === 0) {
      const goalOrder = polishCollator.compare(left.goalTitle!, right.goalTitle!)
      if (goalOrder !== 0) return goalOrder
    } else if (leftGroup === 1) {
      const categoryOrder = polishCollator.compare(left.category!.name, right.category!.name)
      if (categoryOrder !== 0) return categoryOrder
    }

    return polishCollator.compare(left.title, right.title) || left.id - right.id
  })
}
