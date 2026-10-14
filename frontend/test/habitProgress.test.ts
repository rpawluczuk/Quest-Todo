import assert from 'node:assert/strict'
import test from 'node:test'
import { hasReachedWeeklyTarget, sortHabitsForDay } from '../src/habitProgress.ts'
import { dateFromKey, selectedDayInWeek } from '../src/weekDates.ts'
import type { Habit } from '../src/types/Habit.ts'

function habit(count: number, goal: number | null = 2, completed = false, id = 1): Habit {
  return { id, name: `Nawyk ${id}`, description: null, createdOn: '2026-10-09', completed, rewardPoints: 1,
    weeklyRewardGranted: false, startDate: '2026-10-09', endDate: null, completionLimit: null,
    totalCompletions: count, status: 'ACTIVE',
    target: goal === null ? null : { targetDays: goal, effectiveFrom: '2026-10-05' },
    latestTarget: null, weeklyCompletedDays: count }
}

test('weekly achievement depends on count and target, independently of selected day', () => {
  assert.equal(hasReachedWeeklyTarget(habit(1, 2, true)), false)
  assert.equal(hasReachedWeeklyTarget(habit(2, 2, false)), true)
  assert.equal(hasReachedWeeklyTarget(habit(4, 2)), true)
  assert.equal(hasReachedWeeklyTarget(habit(6, 7)), false)
  assert.equal(hasReachedWeeklyTarget(habit(7, 7)), true)
  assert.equal(hasReachedWeeklyTarget(habit(7, null)), false)
})

test('sorts habits by day status and then by descending weekly frequency', () => {
  const sorted = sortHabitsForDay([
    habit(2, 2, true, 7),
    habit(1, 3, true, 5),
    habit(0, 1, false, 3),
    habit(0, 7, false, 1),
    habit(1, 7, true, 4),
    habit(3, 3, false, 6),
    habit(0, 4, false, 2),
  ])

  assert.deepEqual(sorted.map(item => item.id), [1, 2, 3, 4, 5, 6, 7])
})

test('keeps habits without an active target at the bottom of their status group', () => {
  const sorted = sortHabitsForDay([
    habit(0, null, false, 1),
    habit(0, 1, false, 2),
    habit(0, 7, false, 3),
  ])

  assert.deepEqual(sorted.map(item => item.id), [3, 2, 1])
})

test('week navigation selects the same weekday and clamps future days to today', () => {
  assert.equal(selectedDayInWeek('2026-10-09', dateFromKey('2026-09-28'), '2026-10-09'), '2026-10-02')
  assert.equal(selectedDayInWeek('2026-10-04', dateFromKey('2026-10-05'), '2026-10-09'), '2026-10-09')
  assert.equal(selectedDayInWeek('2026-12-28', dateFromKey('2027-01-04'), '2027-01-06'), '2027-01-04')
})
