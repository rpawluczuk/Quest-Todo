import test from 'node:test'
import assert from 'node:assert/strict'
import { habitHistoryPath, mainPagePath, readAppRoute } from '../src/appRoute.ts'

test('history links survive direct entry with their habit and year', () => {
  const url = new URL(habitHistoryPath(42, 2025), 'https://quest.test')
  assert.deepEqual(readAppRoute(url), { page: 'habit-history', habitId: 42, year: 2025 })
  assert.deepEqual(readAppRoute(new URL('/habits/42/history?year=1', url)), { page: 'habit-history', habitId: 42, year: 1 })
  assert.deepEqual(readAppRoute(new URL('/habits/42/history?year=9999', url)), { page: 'habit-history', habitId: 42, year: 9999 })
})

test('bad or missing URL years are rejected without inventing a different year', () => {
  for (const query of ['', '?year=', '?year=0', '?year=-1', '?year=10000', '?year=2025.5', '?year=abc', '?year=2025&year=2026']) {
    assert.equal((readAppRoute(new URL(`/habits/42/history${query}`, 'https://quest.test')) as { year: number | null }).year, null)
  }
})

test('invalid IDs stay in the history view to show an error instead of loading a different habit', () => {
  for (const id of ['0', '-1', 'abc', '9007199254740993']) {
    assert.deepEqual(readAppRoute(new URL(`/habits/${id}/history?year=2026`, 'https://quest.test')),
      { page: 'habit-history', habitId: null, year: 2026 })
  }
})

test('main page links preserve direct navigation and a deterministic habits return', () => {
  for (const page of ['tasks', 'habits', 'goals', 'rewards'] as const)
    assert.deepEqual(readAppRoute(new URL(mainPagePath(page), 'https://quest.test')), { page })
})
