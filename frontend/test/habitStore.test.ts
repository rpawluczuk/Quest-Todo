import assert from 'node:assert/strict'
import test from 'node:test'
import { createHabitStore, habitStatusAction } from '../src/habitStore.ts'
import type { Habit } from '../src/types/Habit.ts'

const habit = (activityStatus: Habit['activityStatus'] = 'ACTIVE') => ({ id: 1, name: 'Czytanie', activityStatus,
  totalCompletions: 42, weeklyCompletedDays: 2, goalIds: [1, 2], goalTitles: ['First', 'Second'] } as Habit)
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

test('goals and daily view share one cached read and mutations are immediately visible to both subscribers', async () => {
  let reads = 0, notifications = 0
  const store = createHabitStore(async () => { reads++; return [habit()] }, async () => habit('PAUSED'))
  const stopA = store.subscribe(() => notifications++)
  const stopB = store.subscribe(() => notifications++)
  await Promise.all([store.load('today'), store.load('today')])
  await store.load('today')
  assert.equal(reads, 1)
  await store.changeStatus(habit(), 'PAUSED')
  assert.equal(store.get('today')![0].activityStatus, 'PAUSED')
  assert.deepEqual(store.get('today')![0].goalIds, [1, 2])
  assert.ok(notifications >= 6)
  stopA(); stopB()
})

test('status changes update all cached dates while preserving each dates own progress', async () => {
  const store = createHabitStore(async () => [], async () => ({ ...habit('ACTIVE'), weeklyCompletedDays: 7 }))
  store.set('today', [habit('PAUSED')])
  store.set('past', [{ ...habit('PAUSED'), weeklyCompletedDays: 1 }])
  await store.changeStatus(habit('PAUSED'), 'ACTIVE')
  assert.equal(store.get('today')![0].weeklyCompletedDays, 2)
  assert.equal(store.get('past')![0].weeklyCompletedDays, 1)
  assert.equal(store.get('past')![0].activityStatus, 'ACTIVE')
  assert.equal(store.get('past')![0].totalCompletions, 42)
})

test('old reads cannot undo a status write, edit, completion or creation', async () => {
  const read = deferred<Habit[]>()
  const store = createHabitStore(() => read.promise, async () => habit('PAUSED'))
  store.set('today', [habit()])
  const pending = store.load('today', true)
  await store.changeStatus(habit(), 'PAUSED')
  store.set('today', items => [{ ...items[0], totalCompletions: 43 }, { ...habit('PLANNED'), id: 2 }])
  read.resolve([habit()]); await pending
  assert.equal(store.get('today')![0].activityStatus, 'PAUSED')
  assert.equal(store.get('today')![0].totalCompletions, 43)
  assert.equal(store.get('today')!.length, 2)
})

test('a status write from either view prevents duplicate and contradictory writes from another view', async () => {
  const response = deferred<Habit>()
  let writes = 0
  const store = createHabitStore(async () => [], () => { writes++; return response.promise })
  const pending = store.changeStatus(habit(), 'PAUSED')
  assert.equal(store.statusUpdates.pending(1), true)
  assert.equal(await store.changeStatus(habit(), 'PAUSED'), null)
  assert.equal(await store.changeStatus(habit('PAUSED'), 'ACTIVE'), null)
  response.resolve(habit('PAUSED')); await pending
  assert.equal(writes, 1); assert.equal(store.statusUpdates.pending(1), false)
})

test('failed status saves retain data, release the shared lock and allow retry', async () => {
  let fail = true
  const store = createHabitStore(async () => [], async () => {
    if (fail) throw new Error('409')
    return habit('ACTIVE')
  })
  store.set('today', [habit('PLANNED')])
  await assert.rejects(store.changeStatus(habit('PLANNED'), 'ACTIVE'), /409/)
  assert.equal(store.get('today')![0].activityStatus, 'PLANNED')
  assert.equal(store.statusUpdates.pending(1), false)
  fail = false; await store.changeStatus(habit('PLANNED'), 'ACTIVE')
  assert.equal(store.get('today')![0].activityStatus, 'ACTIVE')
})

test('both views use the same status action and separate sessions cannot share habits', () => {
  assert.equal(habitStatusAction(habit('PLANNED')).label, 'Rozpocznij nawyk')
  assert.equal(habitStatusAction(habit('PAUSED')).label, 'Wznów nawyk')
  assert.equal(habitStatusAction(habit()).label, 'Wstrzymaj nawyk')
  const create = () => createHabitStore(async () => [], async () => habit())
  const first = create(), second = create()
  first.set('today', [habit()])
  assert.equal(second.get('today'), undefined)
})

test('unlinking in a goal updates every cached edit draft source without losing other goal links or status', () => {
  const store = createHabitStore(async () => [], async () => habit())
  store.set('today', [habit('PLANNED')]); store.set('past', [habit('PLANNED')])
  store.updateGoalLink(1, 1, 'First', false)
  assert.deepEqual(store.get('today')![0].goalIds, [2])
  assert.deepEqual(store.get('past')![0].goalTitles, ['Second'])
  store.updateGoalLink(1, 3, 'Third', true); store.updateGoalLink(1, 3, 'Third', true)
  assert.deepEqual(store.get('today')![0].goalIds, [2, 3])
  assert.equal(store.get('today')![0].activityStatus, 'PLANNED')
})

test('editing from a goal updates names and configuration in past weeks without replacing their daily counters', () => {
  const store = createHabitStore(async () => [], async () => habit())
  store.set('today', [habit()]); store.set('past', [{ ...habit(), weeklyCompletedDays: 1 }])
  store.update({ ...habit(), name: 'Edited', completionBonusPoints: 15 }, 'today')
  assert.equal(store.get('past')![0].name, 'Edited')
  assert.equal(store.get('past')![0].completionBonusPoints, 15)
  assert.equal(store.get('past')![0].weeklyCompletedDays, 1)
})
