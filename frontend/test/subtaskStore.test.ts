import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSubtaskStore } from '../src/subtaskStore.ts'

const items = [{ id: 1, title: 'Krok', completed: false, position: 0 }]
test('subtasks share a lazy cache across views and deduplicate reads', async () => {
  let calls = 0
  const store = createSubtaskStore(async () => { calls++; return items })
  assert.equal(calls, 0)
  await Promise.all([store.load(1), store.load(1)])
  await store.load(1)
  assert.equal(calls, 1)
  assert.equal(store.get(1).items, items)
})
test('subtask mutations notify both views and preserve titles, status and order', () => {
  const store = createSubtaskStore(async () => [])
  let first = 0; let second = 0
  store.subscribe(() => first++)
  store.subscribe(() => second++)
  store.set(1, items)
  const updated = [{ ...items[0], title: 'Zmieniony', completed: true }]
  store.set(1, updated)
  assert.equal(store.get(1).items, updated)
  assert.equal(first, 2); assert.equal(second, 2)
})
test('late reads cannot overwrite a newer subtask mutation', async () => {
  let resolve!: (value: typeof items) => void
  const store = createSubtaskStore(() => new Promise(done => { resolve = done }))
  const read = store.load(1)
  const newer = [{ ...items[0], completed: true }]
  store.set(1, newer)
  resolve(items)
  assert.equal(await read, newer)
  assert.equal(store.get(1).items, newer)
})
test('failed subtask loads can be retried and caches are isolated per session', async () => {
  let fail = true
  const store = createSubtaskStore(async () => { if (fail) throw new Error('offline'); return items })
  await assert.rejects(store.load(1))
  fail = false
  await store.load(1)
  assert.equal(createSubtaskStore(async () => []).get(1).items, null)
})
test('another view cannot mutate the same task until its owner releases it', () => {
  const store = createSubtaskStore(async () => [])
  const a = Symbol(), b = Symbol()
  assert.equal(store.claim(1, a), true)
  assert.equal(store.claim(1, a), true)
  assert.equal(store.claim(1, b), false)
  store.release(1, b)
  assert.equal(store.get(1).owner, a)
  store.release(1, a)
  assert.equal(store.claim(1, b), true)
})
