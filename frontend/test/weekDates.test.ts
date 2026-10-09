import assert from 'node:assert/strict'
import test from 'node:test'
import { dateFromKey, dateKey, habitToday, moveWeek, startOfWeek, weekDays } from '../src/weekDates.ts'

test('habit dates follow Warsaw midnight in winter and summer', () => {
  assert.equal(habitToday(new Date('2026-01-09T22:59:59Z')), '2026-01-09')
  assert.equal(habitToday(new Date('2026-01-09T23:00:00Z')), '2026-01-10')
  assert.equal(habitToday(new Date('2026-07-09T21:59:59Z')), '2026-07-09')
  assert.equal(habitToday(new Date('2026-07-09T22:00:00Z')), '2026-07-10')
})

test('selected date sent to the API survives calendar conversion without UTC shifts', () => {
  for (const date of ['2026-03-29', '2026-10-25', '2027-01-01']) {
    assert.equal(dateKey(dateFromKey(date)), date)
  }
})

test('weeks start on Monday, including when today is Sunday', () => {
  for (let date = 5; date <= 11; date++) {
    const monday = startOfWeek(new Date(2026, 9, date))
    assert.equal(monday.getDate(), 5)
    assert.equal(monday.getDay(), 1)
    assert.deepEqual(weekDays(monday).map(day => day.getDay()), [1, 2, 3, 4, 5, 6, 0])
  }
})

test('navigation allows past weeks and returning, but blocks future weeks', () => {
  const today = new Date(2026, 9, 9)
  const current = startOfWeek(today)
  const previous = moveWeek(current, -1, today)
  assert.equal(previous.getMonth(), 8)
  assert.equal(previous.getDate(), 28)
  assert.equal(moveWeek(previous, 1, today).getTime(), current.getTime())
  assert.equal(moveWeek(current, 1, today).getTime(), current.getTime())
})

test('days remain consecutive across year and daylight-saving boundaries', () => {
  assert.deepEqual(weekDays(startOfWeek(new Date(2027, 0, 1))).map(day => day.getDate()), [28, 29, 30, 31, 1, 2, 3])
  assert.deepEqual(weekDays(startOfWeek(new Date(2026, 2, 29))).map(day => day.getDate()), [23, 24, 25, 26, 27, 28, 29])
  assert.deepEqual(weekDays(startOfWeek(new Date(2026, 9, 25))).map(day => day.getDate()), [19, 20, 21, 22, 23, 24, 25])
})
