import assert from 'node:assert/strict'
import test from 'node:test'
import { moveWeek, startOfWeek, weekDays } from '../src/weekDates.ts'

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
