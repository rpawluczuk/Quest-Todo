import assert from 'node:assert/strict'
import test from 'node:test'
import { partitionHabits } from '../src/habitLists.ts'
import { canToggleHabit } from '../src/habitSchedule.ts'
import type { Habit, HabitActivityStatus } from '../src/types/Habit.ts'

const habit = (id: number, activityStatus: HabitActivityStatus, status: Habit['status'] = 'ACTIVE') =>
  ({ id, activityStatus, status, completed: false, completionLimit: null, totalCompletions: 0 } as Habit)

test('partitions by activity status independently of completion and calendar ending status', () => {
  const all = [habit(1, 'ACTIVE'), habit(2, 'PAUSED'), habit(3, 'PLANNED'), habit(4, 'ACTIVE', 'FINISHED'),
    habit(5, 'PAUSED', 'FINISHED'), habit(6, 'ACTIVE', 'UPCOMING')]
  const lists = partitionHabits(all)
  assert.deepEqual(lists.active.map(h => h.id), [1, 4, 6])
  assert.deepEqual(lists.paused.map(h => h.id), [2, 5])
  assert.deepEqual(lists.planned.map(h => h.id), [3])
  assert.equal(lists.active.length + lists.paused.length + lists.planned.length, all.length)
})
test('preserves input ordering within waiting room groups and does not mutate shared data', () => {
  const all = [habit(9, 'PLANNED'), habit(3, 'PAUSED'), habit(2, 'PLANNED'), habit(8, 'PAUSED')]
  const lists = partitionHabits(all)
  assert.deepEqual(lists.paused.map(h => h.id), [3, 8])
  assert.deepEqual(lists.planned.map(h => h.id), [9, 2])
  assert.deepEqual(all.map(h => h.id), [9, 3, 2, 8])
  assert.equal(lists.paused[0], all[1])
})
test('derives counts immediately from updated statuses without storing separate lists', () => {
  const initial = [habit(1, 'ACTIVE'), habit(2, 'PLANNED')]
  const next = initial.map(h => h.id === 1 ? { ...h, activityStatus: 'PAUSED' as const } : h)
  assert.equal(partitionHabits(initial).active.length, 1)
  assert.equal(partitionHabits(next).active.length, 0)
  assert.equal(partitionHabits(next).paused.length, 1)
  assert.equal(partitionHabits(next).planned.length, 1)
})
test('empty lists and legacy responses retain their existing active interpretation', () => {
  assert.deepEqual(partitionHabits([]), { active: [], paused: [], planned: [] })
  assert.equal(partitionHabits([{ id: 1 } as Habit]).active.length, 1)
})
test('paused and planned habits cannot be toggled even when completed or calendar-active', () => {
  for (const activityStatus of ['PAUSED', 'PLANNED'] as const) {
    assert.equal(canToggleHabit(habit(1, activityStatus)), false)
    assert.equal(canToggleHabit({ ...habit(1, activityStatus), completed: true }), false)
  }
  assert.equal(canToggleHabit(habit(1, 'ACTIVE')), true)
  assert.equal(canToggleHabit(habit(1, 'ACTIVE', 'UPCOMING')), false)
  assert.equal(canToggleHabit({ ...habit(1, 'ACTIVE', 'FINISHED'), completed: true }), true)
})
