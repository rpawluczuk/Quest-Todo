import assert from 'node:assert/strict'
import test from 'node:test'
import { hasReachedWeeklyTarget } from '../src/habitProgress.ts'
import { dateFromKey, selectedDayInWeek } from '../src/weekDates.ts'
import type { Habit } from '../src/types/Habit.ts'

function habit(count: number, goal: number | null = 2, completed = false): Habit {
  return { id: 1, name: 'Spacer', createdOn: '2026-10-09', completed, rewardPoints: 1,
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

test('week navigation selects the same weekday and clamps future days to today', () => {
  assert.equal(selectedDayInWeek('2026-10-09', dateFromKey('2026-09-28'), '2026-10-09'), '2026-10-02')
  assert.equal(selectedDayInWeek('2026-10-04', dateFromKey('2026-10-05'), '2026-10-09'), '2026-10-09')
  assert.equal(selectedDayInWeek('2026-12-28', dateFromKey('2027-01-04'), '2027-01-06'), '2027-01-04')
})
