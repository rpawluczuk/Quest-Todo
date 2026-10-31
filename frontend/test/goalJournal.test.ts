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

test('a confirmed create updates only its journal, keeps three latest records and increments the full total once', async () => {
  const store = createGoalJournalStore(async () => ({ ...data(), entries: [3, 2, 1].map(id => ({ ...data(id).entries[0], id })) }))
  await store.load(1); await store.load(2)
  const entry = { ...data(4).entries[0], createdAt: '2026-10-30T12:00:00Z' }
  await store.create(1, async () => entry)
  assert.equal(store.get(1).data?.totalElements, 9)
  assert.deepEqual(store.get(1).data?.entries.map(item => item.id), [4, 3, 2])
  assert.equal(store.get(2).data?.totalElements, 8)
  await store.load(1)
  assert.equal(store.get(1).data?.entries[0].id, 4)
})

test('create waits for an older initial read and deduplicates simultaneous submissions', async () => {
  const read = deferred<GoalEntries>(), saved = deferred<GoalEntries['entries'][number]>()
  const store = createGoalJournalStore(() => read.promise)
  let writes = 0
  void store.load(1)
  const first = store.create(1, () => { writes++; return saved.promise })
  const duplicate = store.create(1, () => { writes++; return saved.promise })
  assert.equal(first, duplicate); assert.equal(writes, 0)
  read.resolve({ entries: [], totalElements: 0, hasMore: false })
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(writes, 1)
  saved.resolve(data(9).entries[0]); await first
  assert.equal(store.get(1).data?.totalElements, 1)
  assert.equal(store.get(1).data?.entries[0].id, 9)
})

test('a failed POST leaves count and entries intact and permits retry', async () => {
  const store = createGoalJournalStore(async () => data())
  await store.load(1)
  const before = store.get(1)
  await assert.rejects(store.create(1, async () => { throw new Error('Conflict') }), /Conflict/)
  assert.equal(store.get(1), before)
  await store.create(1, async () => data(9).entries[0])
  assert.equal(store.get(1).data?.totalElements, 9)
})

test('an unavailable initial history cannot fabricate a total or send a write, and retry recovers', async () => {
  let fail = true, writes = 0
  const store = createGoalJournalStore(async () => {
    if (fail) throw new Error('Offline')
    return { entries: [], totalElements: 0, hasMore: false }
  })
  const save = async () => { writes++; return data().entries[0] }
  await assert.rejects(store.create(1, save), /Offline/)
  assert.equal(writes, 0); assert.equal(store.get(1).data, null)
  fail = false; await store.create(1, save)
  assert.equal(writes, 1); assert.equal(store.get(1).data?.totalElements, 1)
})

test('new entries retain Instant precision and break timestamp ties by descending id', async () => {
  const record = (id: number, createdAt: string) => ({ ...data(id).entries[0], createdAt })
  const store = createGoalJournalStore(async () => ({ entries: [
    record(2, '2026-10-31T12:00:00.000002Z'), record(1, '2026-10-31T12:00:00Z'),
  ], totalElements: 2, hasMore: false }))
  await store.create(1, async () => record(3, '2026-10-31T12:00:00.000003Z'))
  assert.deepEqual(store.get(1).data?.entries.map(item => item.id), [3, 2, 1])
  await store.create(1, async () => record(4, '2026-10-31T12:00:00.000003Z'))
  assert.deepEqual(store.get(1).data?.entries.map(item => item.id), [4, 3, 2])
})
