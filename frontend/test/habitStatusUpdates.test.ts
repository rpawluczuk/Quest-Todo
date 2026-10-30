import assert from 'node:assert/strict'
import test from 'node:test'
import { createHabitStatusUpdates } from '../src/habitStatusUpdates.ts'
import type { Habit } from '../src/types/Habit.ts'
const habit = (id: number, activityStatus: Habit['activityStatus']) => ({ id, activityStatus, weeklyCompletedDays: 2, totalCompletions: 42 } as Habit)

test('a pending status write blocks only duplicate or contradictory operations for its own habit', () => {
  const updates = createHabitStatusUpdates()
  assert.equal(updates.begin(1), true)
  assert.equal(updates.begin(1), false)
  assert.equal(updates.begin(2), true)
  updates.finish(1)
  assert.equal(updates.begin(1), true)
  assert.deepEqual([...updates.pendingIds()], [2, 1])
})
test('a delayed list response cannot overwrite a newly saved status', () => {
  const updates = createHabitStatusUpdates()
  const before = updates.version()
  updates.saved(1, 'PAUSED')
  const list = updates.merge([habit(1, 'ACTIVE'), habit(2, 'ACTIVE')], before)
  assert.equal(list[0].activityStatus, 'PAUSED')
  assert.equal(list[1].activityStatus, 'ACTIVE')
  assert.equal(list[0].weeklyCompletedDays, 2)
  assert.equal(list[0].totalCompletions, 42)
})
test('a fresh authoritative response can reflect a later change from another session', () => {
  const updates = createHabitStatusUpdates()
  updates.saved(1, 'PAUSED')
  const read = updates.version()
  assert.equal(updates.merge([habit(1, 'ACTIVE')], read)[0].activityStatus, 'ACTIVE')
})
test('multiple independent status writes and resuming preserve the newest response across day changes', () => {
  const updates = createHabitStatusUpdates()
  const read = updates.version()
  updates.saved(1, 'PAUSED'); updates.saved(2, 'PAUSED'); updates.saved(1, 'ACTIVE')
  const merged = updates.merge([habit(1, 'PAUSED'), habit(2, 'ACTIVE')], read)
  assert.deepEqual(merged.map(h => h.activityStatus), ['ACTIVE', 'PAUSED'])
})

test('a read started before creation cannot remove a new planned habit or revert its later start', () => {
  const updates = createHabitStatusUpdates()
  const read = updates.version()
  updates.created(habit(3, 'PLANNED'))
  assert.deepEqual(updates.merge([], read).map(h => h.activityStatus), ['PLANNED'])
  updates.saved(3, 'ACTIVE')
  assert.deepEqual(updates.merge([], read).map(h => h.activityStatus), ['ACTIVE'])
  assert.equal(updates.merge([habit(3, 'ACTIVE')], read).length, 1)
  assert.deepEqual(updates.merge([], updates.version()), []) // A later authoritative deletion wins.
})
