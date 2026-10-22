import assert from 'node:assert/strict'
import test from 'node:test'
import { habitFormChanged, type HabitFormValues } from '../src/habitFormState.ts'

function values(): HabitFormValues {
  return {
    name: 'Czytanie',
    targetDays: 3,
    rewardPoints: '5',
    description: 'Minimum dziesięć stron',
    schedule: { startDate: '2026-10-22', endDate: null, completionLimit: 30,
      completionBonusPoints: 10, requiredSuccessPercent: null },
    categoryId: 4,
    goalIds: [7, 9],
  }
}

test('unchanged habit form does not require discard confirmation', () => {
  const initial = values()
  assert.equal(habitFormChanged({ ...initial, schedule: { ...initial.schedule }, goalIds: [9, 7] }, initial), false)
})

test('habit form detects changes to its regular and completion fields', () => {
  const initial = values()
  assert.equal(habitFormChanged({ ...initial, rewardPoints: '6' }, initial), true)
  assert.equal(habitFormChanged({ ...initial, schedule: { ...initial.schedule, completionLimit: 31 } }, initial), true)
  assert.equal(habitFormChanged({ ...initial, goalIds: [7] }, initial), true)
})

test('restoring the initial habit value clears the changed state', () => {
  const initial = values()
  const changed = { ...initial, targetDays: 5 }
  assert.equal(habitFormChanged(changed, initial), true)
  assert.equal(habitFormChanged({ ...changed, targetDays: initial.targetDays }, initial), false)
})
