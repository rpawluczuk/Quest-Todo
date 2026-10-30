import type { Habit } from './types/Habit'

export function habitActivityStatus(habit: Pick<Habit, 'activityStatus'>) {
  // Older API responses during a rolling deployment represent existing active habits.
  return habit.activityStatus ?? 'ACTIVE'
}

export function partitionHabits(habits: Habit[]) {
  return {
    active: habits.filter(habit => habitActivityStatus(habit) === 'ACTIVE'),
    paused: habits.filter(habit => habitActivityStatus(habit) === 'PAUSED'),
    planned: habits.filter(habit => habitActivityStatus(habit) === 'PLANNED'),
  }
}
