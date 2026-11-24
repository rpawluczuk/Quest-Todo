import assert from 'node:assert/strict'
import test from 'node:test'
import { historyDateLabel, historyDayDescription, historyMonths, historyWeekPresentation } from '../src/habitHistoryCalendar.ts'
import type { HabitHistoryWeek } from '../src/types/HabitHistory.ts'

test('Sunday start leaves six blank slots and leap day is included exactly once', () => {
  const months = historyMonths(2024)
  assert.equal(months.length, 12)
  assert.equal(months[0].name, 'Styczeń')
  assert.equal(months[11].name, 'Grudzień')
  assert.deepEqual(months[8].rows[0].days, [null, null, null, null, null, null, { date: '2024-09-01', number: 1 }])
  const dates = months.flatMap(month => month.rows.flatMap(row => row.days.filter(day => day !== null).map(day => day.date)))
  assert.equal(dates.length, 366)
  assert.equal(new Set(dates).size, 366)
  assert.equal(dates.filter(date => date === '2024-02-29').length, 1)
  assert.equal(historyMonths(2026).flatMap(month => month.rows.flatMap(row => row.days.filter(Boolean))).length, 365)
})

test('month and year boundaries use the same Monday key without filling adjacent-month slots', () => {
  const months = historyMonths(2026)
  assert.equal(months[0].rows[0].weekStart, '2025-12-29')
  assert.equal(months[11].rows.at(-1)?.weekStart, '2026-12-28')
  assert.equal(historyMonths(2027)[0].rows[0].weekStart, '2026-12-28')
  assert.equal(months[2].rows.at(-1)?.weekStart, months[3].rows[0].weekStart)
  assert.equal(months[2].rows.at(-1)?.days[2], null)
  assert.equal(months[3].rows[0].days[0], null)
  assert.equal(historyMonths(1)[0].rows[0].days[0]?.date, '0001-01-01')
})

test('all four markers obey server status and requiredDays, even with a different target', () => {
  const week: HabitHistoryWeek = { weekStart: '2026-10-05', completedDays: 2, targetDays: 7, requiredDays: 3, status: 'IN_PROGRESS' }
  assert.equal(historyWeekPresentation(week).mark, '2/3')
  assert.match(historyWeekPresentation(week).description, /2 z 3/)
  // Do not infer status even when counts alone would suggest a different result.
  assert.equal(historyWeekPresentation({ ...week, status: 'MET' }).mark, '✓')
  assert.equal(historyWeekPresentation({ ...week, status: 'MISSED', completedDays: 7 }).mark, '×')
  const neutral = historyWeekPresentation({ ...week, status: 'NEUTRAL', targetDays: null, requiredDays: null, completedDays: 0 })
  assert.equal(neutral.mark, '—')
  assert.match(neutral.description, /Brak wymaganego progu/)
  assert.doesNotMatch(neutral.description, /0\/0/)
})

test('day descriptions preserve saved completion independently of activity and do not invent an inactive reason', () => {
  assert.match(historyDayDescription({ date: '2024-02-29', completed: true, status: 'INACTIVE' }), /Zapisane wykonanie.*Dzień nieaktywny/)
  assert.match(historyDayDescription({ date: '2024-02-29', completed: false, status: 'ACTIVE' }), /Brak zapisanego wykonania.*Dzień aktywny/)
  assert.match(historyDayDescription({ date: '2024-02-29', completed: false, status: 'FUTURE' }), /Dzień przyszły/)
})

test('calendar layout and date labels are identical in distant browser timezones and across DST', () => {
  const previous = process.env.TZ
  try {
    const results = ['Pacific/Kiritimati', 'Pacific/Honolulu', 'Europe/Warsaw'].map(zone => {
      process.env.TZ = zone
      return { months: historyMonths(2026), labels: ['2026-03-29', '2026-10-25', '2024-02-29'].map(historyDateLabel) }
    })
    assert.deepEqual(results[0], results[1])
    assert.deepEqual(results[1], results[2])
    assert.match(results[0].labels[2], /29 lutego 2024/)
  } finally {
    if (previous === undefined) delete process.env.TZ
    else process.env.TZ = previous
  }
})
