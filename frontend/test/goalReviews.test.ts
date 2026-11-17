import assert from 'node:assert/strict'
import test from 'node:test'
import { formatReviewDate, goalNeedsReview, goalReviewLabels, isGoalReviewFrequency, reviewCompletedByEntry, reviewFrequencyError } from '../src/goalReviews.ts'
import type { Goal } from '../src/types/Goal.ts'
import type { GoalEntry } from '../src/types/GoalEntry.ts'

const scheduled: Goal = { id: 1, title: 'Goal', completed: false, completedAt: null, currentState: null,
  desiredOutcome: null, reviewFrequency: 'MONTHLY', nextReviewDate: '2026-12-17', reviewDue: true }
const entry: GoalEntry = { id: 1, type: 'NOTE', content: 'Reflection', createdAt: '2026-12-20T12:00:00Z', updatedAt: '2026-12-20T12:00:00Z' }

test('review badges use the backend flag and exclude completed and disabled goals', () => {
  assert.equal(goalNeedsReview(scheduled), true)
  assert.equal(goalNeedsReview({ ...scheduled, completed: true }), false)
  assert.equal(goalNeedsReview({ ...scheduled, reviewFrequency: null }), false)
  assert.equal(goalNeedsReview({ ...scheduled, reviewDue: false, nextReviewDate: '2000-01-01' }), false)
})

test('review success requires a confirmed later deadline and an entry on or after the original deadline', () => {
  const after = { ...scheduled, reviewDue: false, nextReviewDate: '2027-01-20' }
  assert.equal(reviewCompletedByEntry(scheduled, after, entry), true)
  for (const different of [scheduled, { ...after, reviewFrequency: null }, { ...after, nextReviewDate: null },
    { ...after, nextReviewDate: scheduled.nextReviewDate }, { ...after, completed: true },
    { ...after, reviewFrequency: 'WEEKLY' as const }]) {
    assert.equal(reviewCompletedByEntry(scheduled, different, entry), false)
  }
  assert.equal(reviewCompletedByEntry(scheduled, after, { ...entry, createdAt: '2026-12-05T12:00:00Z' }), false)
})

test('review confirmation handles midnight when the old cached flag was false', () => {
  const before = { ...scheduled, reviewDue: false }
  const after = { ...before, nextReviewDate: '2027-01-17' }
  assert.equal(reviewCompletedByEntry(before, after, { ...entry, createdAt: '2026-12-16T23:00:00Z' }), true)
  assert.equal(reviewCompletedByEntry(before, after, { ...entry, createdAt: '2026-12-16T22:59:59Z' }), false)
})

test('review frequencies match the four API values and Polish labels', () => {
  assert.deepEqual(goalReviewLabels, {
    WEEKLY: 'Co tydzień', BIWEEKLY: 'Co 2 tygodnie', MONTHLY: 'Co miesiąc', QUARTERLY: 'Co 3 miesiące',
  })
  for (const frequency of Object.keys(goalReviewLabels)) {
    assert.equal(isGoalReviewFrequency(frequency), true)
    assert.equal(reviewFrequencyError(frequency), '')
  }
  assert.equal(reviewFrequencyError(null), '')
})

test('invalid frequencies cannot be saved as enabled reviews', () => {
  for (const invalid of ['', 'DAILY', 'monthly', 'toString', 'constructor', 1, {}, undefined]) {
    assert.equal(isGoalReviewFrequency(invalid), false)
    assert.equal(reviewFrequencyError(invalid), 'Wybierz prawidłową częstotliwość przeglądów.')
  }
})

test('review LocalDate formatting preserves the day across browser time zones and DST', () => {
  const original = process.env.TZ
  try {
    for (const zone of ['Europe/Warsaw', 'America/Los_Angeles', 'Pacific/Honolulu', 'Pacific/Kiritimati', 'UTC']) {
      process.env.TZ = zone
      for (const [date, expected] of [
        ['2026-12-17', '17 grudnia 2026'], ['2026-03-29', '29 marca 2026'],
        ['2026-10-25', '25 października 2026'], ['2024-02-29', '29 lutego 2024'],
        ['2027-01-01', '1 stycznia 2027'],
      ]) assert.equal(formatReviewDate(date), expected, `${date} in ${zone}`)
    }
  } finally {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  }
})
