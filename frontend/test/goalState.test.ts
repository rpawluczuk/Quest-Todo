import assert from 'node:assert/strict'
import test from 'node:test'
import { createGoalState } from '../src/goalState.ts'
import type { Goal } from '../src/types/Goal.ts'

const goal = (id: number, title = `Goal ${id}`): Goal => ({ id, title, currentState: null, desiredOutcome: null,
  completed: false, completedAt: null, reviewFrequency: 'MONTHLY', nextReviewDate: '2026-12-17', reviewDue: true })
function setup() { const state = createGoalState(); state.acceptList(state.beginList(), [goal(1), goal(2)]); return state }

test('late list reads preserve newer detail reads and edits without changing goal order', () => {
  const state = setup(), list = state.beginList(), detail = state.beginRead(1)
  state.acceptRead(1, detail, { ...goal(1), reviewDue: false, nextReviewDate: '2027-01-20' })
  state.put(goal(2, 'Renamed'))
  state.acceptList(list, [goal(1), goal(2)])
  assert.deepEqual(state.get().map(item => item.id), [1, 2])
  assert.equal(state.get()[0].reviewDue, false)
  assert.equal(state.get()[0].nextReviewDate, '2027-01-20')
  assert.equal(state.get()[1].title, 'Renamed')
})

test('late reads cannot resurrect deleted goals or remove a newly created goal', () => {
  const state = setup(), detail = state.beginRead(1), list = state.beginList()
  state.remove(1); state.put(goal(3))
  assert.equal(state.acceptRead(1, detail, goal(1)), false)
  state.acceptList(list, [goal(1), goal(2)])
  assert.deepEqual(state.get().map(item => item.id), [2, 3])
})

test('newer reads win over earlier detail and list responses', () => {
  const state = setup(), oldList = state.beginList(), oldRead = state.beginRead(1), read = state.beginRead(1)
  assert.equal(state.acceptRead(1, oldRead, goal(1, 'Old')), false)
  state.acceptRead(1, read, goal(1, 'New'))
  const list = state.beginList()
  state.acceptList(list, [goal(1, 'Newest'), goal(2)])
  assert.equal(state.acceptList(oldList, [goal(1)]), false)
  assert.equal(state.acceptRead(1, read, goal(1, 'New')), false)
  assert.equal(state.get()[0].title, 'Newest')
})

test('a configuration or completion response supersedes an in-flight status refresh', () => {
  const state = setup(), read = state.beginRead(1)
  state.put({ ...goal(1), completed: true, reviewDue: false, nextReviewDate: null })
  assert.equal(state.acceptRead(1, read, goal(1)), false)
  assert.equal(state.get()[0].completed, true)
  assert.equal(state.get()[0].nextReviewDate, null)
})

test('list refresh applies external additions/deletions but never mixes goal IDs', () => {
  const state = setup(), read = state.beginRead(1)
  assert.equal(state.acceptRead(1, read, goal(2)), false)
  state.acceptList(state.beginList(), [goal(2), goal(3)])
  assert.deepEqual(state.get().map(item => item.id), [2, 3])
})

test('a list started before a detail refresh cannot replace that goal while the refresh is pending', () => {
  const state = setup(), list = state.beginList()
  state.beginRead(1)
  state.acceptList(list, [goal(1, 'Stale'), goal(2, 'Updated')])
  assert.equal(state.get()[0].title, 'Goal 1')
  assert.equal(state.get()[1].title, 'Updated')
})
