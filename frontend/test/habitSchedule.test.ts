import assert from 'node:assert/strict'
import test from 'node:test'
import { canToggleHabit, habitEndDateLabel } from '../src/habitSchedule.ts'
import type { Habit } from '../src/types/Habit.ts'

const habit: Habit = {
  id: 1, name: 'Test', description: null, createdOn: '2026-10-14', startDate: '2026-10-01',
  endDate: null, completionLimit: 3, totalCompletions: 2, status: 'ACTIVE', completed: false,
  weeklyCompletedDays: 2, rewardPoints: 1, weeklyRewardGranted: false, target: null, latestTarget: null,
}

test('allows active habits until the lifetime limit, independently of weekly progress', () => {
  assert.equal(canToggleHabit(habit), true)
  assert.equal(canToggleHabit({ ...habit, totalCompletions: 3 }), false)
  assert.equal(canToggleHabit({ ...habit, completionLimit: null, totalCompletions: 100 }), true)
})

test('upcoming and finished habits cannot be checked but their history can be unchecked', () => {
  assert.equal(canToggleHabit({ ...habit, status: 'UPCOMING' }), false)
  assert.equal(canToggleHabit({ ...habit, status: 'FINISHED' }), false)
  assert.equal(canToggleHabit({ ...habit, status: 'FINISHED', completed: true }), true)
})

test('uses a compact end date and shows the year only when needed', () => {
  assert.equal(habitEndDateLabel('2026-10-28', '2026-10-14'), '28 paź')
  assert.equal(habitEndDateLabel('2027-10-28', '2026-10-14'), '28 paź 2027')
})
