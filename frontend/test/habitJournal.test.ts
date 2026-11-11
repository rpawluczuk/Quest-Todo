import assert from 'node:assert/strict'
import test from 'node:test'
import { createHabitJournalStore, habitJournalReadOnly } from '../src/habitJournal.ts'
import { createGoalJournalStore } from '../src/goalJournal.ts'
import type { GoalEntries } from '../src/types/GoalEntry.ts'

const data = (id: number): GoalEntries => ({ entries: [{ id, type: 'NOTE', content: `Habit ${id}`,
  createdAt: '2026-11-10T10:00:00Z', updatedAt: '2026-11-10T10:00:00Z' }], totalElements: 12, hasMore: true })

test('habit preview is lazy, requests page 0 size 3, deduplicates and caches reopens', async () => {
  const calls: number[][] = []
  const store = createHabitJournalStore(async (...args) => { calls.push(args); return data(args[0]) })
  assert.deepEqual(calls, [])
  const request = store.load(7)
  assert.equal(store.load(7), request)
  await request
  await store.load(7)
  assert.deepEqual(calls, [[7, 0, 3]])
  assert.equal(store.get(7).data?.totalElements, 12)
  assert.equal(store.get(7).data?.entries.length, 1)
})

test('habit mutations wait for initial reads, deduplicate saves and preserve other habits', async () => {
  let release!: (value: GoalEntries) => void
  const pending = new Promise<GoalEntries>(resolve => { release = resolve })
  const store = createHabitJournalStore(id => id === 1 ? pending : Promise.resolve(data(id)))
  const initial = store.load(1)
  await store.load(2)
  let saves = 0
  const save = () => { saves++; return Promise.resolve({ ...data(9).entries[0], createdAt: '2026-11-11T10:00:00Z' }) }
  const created = store.create(1, save)
  assert.equal(store.create(1, save), created)
  assert.equal(saves, 0)
  release(data(1)); await initial; await created
  assert.equal(saves, 1)
  assert.equal(store.get(1).data?.totalElements, 13)
  assert.equal(store.get(1).data?.entries[0].id, 9)
  assert.equal(store.get(2).data?.totalElements, 12)
  const before = store.get(1).data!
  await store.update(1, async () => ({ ...before.entries[1], type: 'INSIGHT', content: 'Updated' }))
  assert.deepEqual(store.get(1).data?.entries.map(e => e.id), [9, 1])
  assert.equal(store.get(1).data?.totalElements, 13)
  assert.equal(store.get(1).data?.entries[1].createdAt, before.entries[1].createdAt)
})

test('delete refills preview; failed refill retries GET without repeating DELETE', async () => {
  let calls = 0, deletes = 0, fail = false
  const store = createHabitJournalStore(async (_id, page, size) => {
    assert.equal(page, 0); assert.equal(size, 3); calls++
    if (fail) throw new Error('Refill unavailable')
    return { entries: [data(3).entries[0], data(2).entries[0], data(1).entries[0]], totalElements: 8, hasMore: true }
  })
  await store.load(1)
  fail = true
  await store.remove(1, 3, async () => { deletes++ })
  assert.equal(store.get(1).data?.totalElements, 7)
  assert.deepEqual(store.get(1).data?.entries.map(e => e.id), [2, 1])
  assert.equal(store.get(1).error, 'Refill unavailable')
  fail = false; await store.load(1, true)
  assert.equal(deletes, 1); assert.equal(calls, 3)
  assert.equal(store.get(1).data?.entries.length, 3)
})

test('failed writes keep confirmed cache and allow retries', async () => {
  const store = createHabitJournalStore(async id => data(id))
  await store.load(1)
  const confirmed = store.get(1).data
  const failure = async (): Promise<never> => { throw new Error('409 read-only') }
  for (const write of [() => store.create(1, failure), () => store.update(1, failure), () => store.remove(1, 1, failure)]) {
    await assert.rejects(write, /409/)
    assert.equal(store.get(1).data, confirmed)
    assert.equal(store.get(1).busy, false)
  }
})

test('journal permissions use today even on a past week, including limits and reactivation', () => {
  const habit = { endedOn: null, startDate: '2026-10-01', endDate: null, completionLimit: null, totalCompletions: 10 }
  const today = '2026-11-10'
  assert.equal(habitJournalReadOnly(habit, today), false)
  assert.equal(habitJournalReadOnly({ ...habit, endedOn: today }, today), true)
  assert.equal(habitJournalReadOnly({ ...habit, endDate: '2026-11-09' }, today), true)
  assert.equal(habitJournalReadOnly({ ...habit, endDate: today }, today), false)
  assert.equal(habitJournalReadOnly({ ...habit, completionLimit: 10 }, today), true)
  assert.equal(habitJournalReadOnly({ ...habit, completionLimit: 11 }, today), false)
  assert.equal(habitJournalReadOnly({ ...habit, startDate: '2026-11-11', completionLimit: 10 }, today), false)
})

test('late responses remain with their habit and caches do not cross entity types or sessions', async () => {
  let release!: (data: GoalEntries) => void
  const pending = new Promise<GoalEntries>(resolve => { release = resolve })
  const store = createHabitJournalStore(id => id === 1 ? pending : Promise.resolve(data(id)))
  const first = store.load(1)
  await store.load(2)
  release(data(1)); await first
  assert.equal(store.get(2).data?.entries[0].id, 2)
  const goals = createGoalJournalStore(async id => data(id))
  const nextSession = createHabitJournalStore(async id => data(id))
  assert.equal(goals.get(1).data, null)
  assert.equal(nextSession.get(1).data, null)
})

test('failed previews retry explicitly, support empty data and unsubscribe safely', async () => {
  let calls = 0, notifications = 0
  const store = createHabitJournalStore(async () => {
    if (++calls === 1) throw new Error('Unavailable')
    return { entries: [], totalElements: 0, hasMore: false }
  })
  const stop = store.subscribe(() => notifications++)
  await store.load(1)
  assert.equal(store.get(1).error, 'Unavailable')
  assert.equal(store.get(1).loading, false)
  await store.load(1)
  assert.equal(calls, 1)
  stop()
  const before = notifications
  await store.load(1, true)
  assert.equal(notifications, before)
  assert.equal(store.get(1).error, '')
  assert.equal(store.get(1).data?.totalElements, 0)
})
