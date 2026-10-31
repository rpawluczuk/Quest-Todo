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
  assert.equal(store.get(1).data, before.data)
  assert.equal(store.get(1).busy, false)
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

test('PATCH replaces the server record in place without changing count, creation date or another goal', async () => {
  let reads = 0
  const initial = { entries: [3, 2, 1].map(id => data(id).entries[0]), totalElements: 8, hasMore: true }
  const store = createGoalJournalStore(async () => { reads++; return initial })
  await store.load(1); await store.load(2)
  const updated = { ...initial.entries[1], content: 'Updated', type: 'INSIGHT' as const, updatedAt: '2026-10-31T12:00:00Z' }
  await store.update(1, async () => updated)
  assert.deepEqual(store.get(1).data?.entries.map(item => item.id), [3, 2, 1])
  assert.deepEqual(store.get(1).data?.entries[1], updated)
  assert.equal(store.get(1).data?.totalElements, 8)
  assert.equal(store.get(2).data, initial)
  assert.equal(reads, 2)
})

test('a rejected PATCH or DELETE leaves confirmed records and count unchanged and releases the lock', async () => {
  const store = createGoalJournalStore(async () => data())
  await store.load(1)
  const original = store.get(1).data
  await assert.rejects(store.update(1, async () => { throw new Error('409') }), /409/)
  assert.equal(store.get(1).data, original)
  await assert.rejects(store.remove(1, 1, async () => { throw new Error('404') }), /404/)
  assert.equal(store.get(1).data, original)
  assert.equal(store.get(1).busy, false)
})

test('DELETE refills the first page and its total from the server, leaving other goals cached', async () => {
  let removed = false, reads = 0, writes = 0
  const page = (ids: number[], totalElements: number) => ({ entries: ids.map(id => data(id).entries[0]), totalElements, hasMore: totalElements > 3 })
  const store = createGoalJournalStore(async id => { reads++; return id === 1 && removed ? page([8, 6, 5], 7) : page([8, 7, 6], 8) })
  await store.load(1); await store.load(2)
  const other = store.get(2).data
  await store.remove(1, 7, async () => { writes++; removed = true })
  assert.equal(writes, 1); assert.equal(reads, 3)
  assert.deepEqual(store.get(1).data?.entries.map(item => item.id), [8, 6, 5])
  assert.equal(store.get(1).data?.totalElements, 7)
  assert.equal(store.get(2).data, other)
})

test('a failed refill after committed DELETE preserves the deletion and retries GET without repeating DELETE', async () => {
  let fail = false, writes = 0, removed = false
  const store = createGoalJournalStore(async () => {
    if (fail) throw new Error('Refill offline')
    return removed ? { entries: [], totalElements: 0, hasMore: false } : { ...data(), totalElements: 1, hasMore: false }
  })
  await store.load(1)
  await store.remove(1, 1, async () => { writes++; removed = true; fail = true })
  assert.equal(store.get(1).data?.totalElements, 0)
  assert.deepEqual(store.get(1).data?.entries, [])
  assert.equal(store.get(1).error, 'Refill offline')
  fail = false; await store.load(1, true)
  assert.equal(writes, 1); assert.equal(store.get(1).error, '')
  assert.equal(store.get(1).data?.totalElements, 0)
})

test('pending initial reads finish before PATCH and duplicate DELETEs share one mutation and refill', async () => {
  const pending = deferred<GoalEntries>()
  let writes = 0, reads = 0
  const store = createGoalJournalStore(async () => { reads++; return pending.promise })
  const loading = store.load(1)
  const updating = store.update(1, async () => { writes++; return { ...data().entries[0], content: 'Changed' } })
  assert.equal(store.get(1).busy, true); assert.equal(writes, 0)
  pending.resolve(data()); await loading; await updating
  assert.equal(store.get(1).data?.entries[0].content, 'Changed')
  const first = store.remove(1, 1, async () => { writes++ })
  const second = store.remove(1, 1, async () => { writes++ })
  assert.equal(first, second); await first
  assert.equal(writes, 2); assert.equal(reads, 2)
  assert.equal(store.get(1).busy, false)
})
