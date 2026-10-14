import type { Habit } from './types/Habit'

export function canToggleHabit(habit: Habit): boolean {
  return habit.completed || (habit.status === 'ACTIVE'
    && (habit.completionLimit === null || habit.totalCompletions < habit.completionLimit))
}
