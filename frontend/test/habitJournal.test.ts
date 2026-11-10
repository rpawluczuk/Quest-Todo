import assert from 'node:assert/strict'
import test from 'node:test'
import { createHabitJournalStore } from '../src/habitJournal.ts'
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
