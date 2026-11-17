import assert from 'node:assert/strict'
import test from 'node:test'
import { formatReviewDate, goalReviewLabels, isGoalReviewFrequency, reviewFrequencyError } from '../src/goalReviews.ts'

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
