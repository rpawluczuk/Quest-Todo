import assert from 'node:assert/strict'
import test from 'node:test'
import { getTaskEmptyStates } from '../src/taskEmptyState.ts'

test('shows first-task guidance when there are no tasks', () => {
  const states = getTaskEmptyStates(0, 0, 0)

  assert.deepEqual(states.focus, {
    message: 'Tutaj znajdą się zadania, na których chcesz się teraz skupić.',
    icon: 'target',
    centered: true,
  })
  assert.deepEqual(states.backlog, {
    message: 'Nie masz jeszcze zadań. Dodaj pierwsze, aby rozpocząć!',
    icon: 'list',
    prominent: true,
  })
})

test('guides from an empty Focus to tasks in Backlog', () => {
  const states = getTaskEmptyStates(0, 2, 2)

  assert.equal(states.focus.message, 'Wybierz zadanie z sekcji „Pozostałe zadania” i przenieś je do priorytetów.')
  assert.equal(states.focus.icon, undefined)
  assert.equal(states.backlog.prominent, undefined)
})

test('uses the standard Backlog message when only Focus has tasks', () => {
  const states = getTaskEmptyStates(2, 0, 2)

  assert.equal(states.backlog.message, 'Nie masz pozostałych zadań. Dodaj nowe zadanie lub przenieś tutaj zadanie z priorytetów.')
  assert.equal(states.backlog.prominent, undefined)
})

test('does not treat completed-task history as a new account', () => {
  const states = getTaskEmptyStates(0, 0, 1)

  assert.equal(states.focus.message, 'Tutaj znajdą się zadania, na których chcesz się teraz skupić.')
  assert.equal(states.focus.icon, undefined)
  assert.equal(states.focus.centered, undefined)
  assert.equal(states.backlog.prominent, undefined)
})

test('keeps regular empty-state configuration when both active lists contain tasks', () => {
  const states = getTaskEmptyStates(1, 1, 2)

  assert.equal(states.focus.icon, undefined)
  assert.equal(states.backlog.prominent, undefined)
})
