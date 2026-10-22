import assert from 'node:assert/strict'
import test from 'node:test'
import { habitEndMode, scheduleWithEndMode } from '../src/habitScheduleForm.ts'
import type { HabitSchedule } from '../src/types/Habit.ts'

const schedule: HabitSchedule = {
  startDate: '2026-10-22',
  endDate: null,
  completionLimit: null,
  completionBonusPoints: null,
  requiredSuccessPercent: null,
}

test('selecting a dated ending keeps the end date empty until the user chooses it', () => {
  const result = scheduleWithEndMode(schedule, 'date', null)

  assert.equal(result.endDate, null)
  assert.equal(result.completionLimit, null)
  assert.equal(habitEndMode(result), 'none')
})

test('an existing end date is recognized and can be restored after changing modes', () => {
  const dated = { ...schedule, endDate: '2026-12-31' }

  assert.equal(habitEndMode(dated), 'date')
  const countBased = scheduleWithEndMode(dated, 'count', dated.endDate)
  assert.deepEqual(countBased, {
    ...schedule,
    completionLimit: 30,
  })
  assert.equal(scheduleWithEndMode(countBased, 'date', dated.endDate).endDate, dated.endDate)
})

test('changing the ending mode clears inactive bonus conditions', () => {
  const configured = {
    ...schedule,
    endDate: '2026-12-31',
    completionBonusPoints: 20,
    requiredSuccessPercent: 80,
  }

  assert.deepEqual(scheduleWithEndMode(configured, 'none', configured.endDate), schedule)
})

test('changing between dated and count endings preserves entered bonus points', () => {
  const dated = {
    ...schedule,
    endDate: '2026-12-31',
    completionBonusPoints: 20,
    requiredSuccessPercent: 80,
  }

  assert.deepEqual(scheduleWithEndMode(dated, 'count', dated.endDate), {
    ...schedule,
    completionLimit: 30,
    completionBonusPoints: 20,
  })
})
