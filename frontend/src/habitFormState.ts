import type { HabitSchedule } from './types/Habit'

export type HabitFormValues = {
  readonly name: string
  readonly targetDays: number
  readonly rewardPoints: string
  readonly description: string
  readonly schedule: HabitSchedule
  readonly categoryId: number | null
  readonly goalIds: readonly number[]
}

function sameSchedule(left: HabitSchedule, right: HabitSchedule) {
  return left.startDate === right.startDate && left.endDate === right.endDate &&
    left.completionLimit === right.completionLimit &&
    left.completionBonusPoints === right.completionBonusPoints &&
    left.requiredSuccessPercent === right.requiredSuccessPercent
}

function sameIds(left: readonly number[], right: readonly number[]) {
  return left.length === right.length && left.every(id => right.includes(id))
}

export function habitFormChanged(current: HabitFormValues, initial: HabitFormValues) {
  return current.name !== initial.name || current.targetDays !== initial.targetDays ||
    current.rewardPoints !== initial.rewardPoints || current.description !== initial.description ||
    current.categoryId !== initial.categoryId || !sameIds(current.goalIds, initial.goalIds) ||
    !sameSchedule(current.schedule, initial.schedule)
}
