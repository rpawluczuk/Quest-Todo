import assert from 'node:assert/strict'
import test from 'node:test'
import { createGoalJournalStore, formatGoalEntryDate, goalEntryLabels } from '../src/goalJournal.ts'
import type { GoalEntries } from '../src/types/GoalEntry.ts'

const data = (id = 1): GoalEntries => ({ entries: [{ id, type: 'NOTE', content: 'Entry',
  createdAt: '2026-10-29T12:00:00Z', updatedAt: '2026-10-29T12:00:00Z' }], hasMore: true, totalElements: 8 })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

test('journal is lazy, deduplicates concurrent loads and caches reopens without deriving a total from visible entries', async () => {
  const pending = deferred<GoalEntries>()
  const calls: number[] = []
  const store = createGoalJournalStore(id => { calls.push(id); return pending.promise })
  assert.deepEqual(calls, [])
  const first = store.load(1), second = store.load(1)
  assert.equal(first, second); assert.equal(store.get(1).loading, true)
  pending.resolve(data()); await first
  await store.load(1)
  assert.deepEqual(calls, [1])
  assert.equal(store.get(1).data?.totalElements, 8)
  assert.equal(store.get(1).data?.entries.length, 1)
})

test('late responses are isolated by goal and never replace the currently opened goals data', async () => {
  const first = deferred<GoalEntries>(), second = deferred<GoalEntries>()
  const store = createGoalJournalStore(id => id === 1 ? first.promise : second.promise)
  const loadA = store.load(1), loadB = store.load(2)
  second.resolve(data(2)); await loadB
  assert.equal(store.get(2).data?.entries[0].id, 2)
  first.resolve(data(1)); await loadA
  assert.equal(store.get(2).data?.entries[0].id, 2)
})

test('failed loads expose an error, release pending state and retry only on request', async () => {
  let fail = true, calls = 0
  const store = createGoalJournalStore(async () => {
    calls++; if (fail) throw new Error('Błąd odczytu')
    return { entries: [], hasMore: false, totalElements: 0 }
  })
  await store.load(1)
  assert.equal(store.get(1).loading, false); assert.equal(store.get(1).error, 'Błąd odczytu')
  await store.load(1); assert.equal(calls, 1)
  fail = false; await store.load(1, true)
  assert.equal(calls, 2); assert.equal(store.get(1).error, '')
  assert.equal(store.get(1).data?.totalElements, 0)
})

test('cache does not cross sessions and subscription cleanup stops notifications', async () => {
  const make = () => createGoalJournalStore(async () => data())
  const first = make(), second = make()
  let notifications = 0
  const stop = first.subscribe(() => notifications++)
  await first.load(1); assert.equal(notifications, 2)
  stop(); await first.load(2); assert.equal(notifications, 2)
  assert.equal(second.get(1).data, null)
})

test('journal dates use Polish labels and Warsaw midnight independently of browser timezone', () => {
  assert.equal(formatGoalEntryDate('2026-10-29T12:00:00Z'), '29 paź 2026')
  assert.equal(formatGoalEntryDate('2026-10-29T23:30:00Z'), '30 paź 2026')
  assert.equal(formatGoalEntryDate('2026-06-01T22:30:00Z'), '2 cze 2026')
  assert.deepEqual(Object.values(goalEntryLabels), ['Notatka', 'Sukces', 'Trudność', 'Wniosek'])
})
