import assert from 'node:assert/strict'
import test from 'node:test'
import { getTaskDuePresentation } from '../src/taskDue.ts'

function due(dueDate: string, dueTime: string | null = null, completed = false) {
  return { dueDate, dueTime, completed }
}

test('shows friendly labels for today and tomorrow', () => {
  const now = new Date('2026-10-13T08:30:00Z')
  assert.deepEqual(getTaskDuePresentation(due('2026-10-13'), now), { label: 'Dzisiaj', overdue: false })
  assert.deepEqual(getTaskDuePresentation(due('2026-10-14', '18:15:00'), now), { label: 'Jutro, 18:15', overdue: false })
})

test('date-only deadline becomes overdue after that calendar day', () => {
  const now = new Date('2026-10-13T08:30:00Z')
  assert.deepEqual(getTaskDuePresentation(due('2026-10-12'), now), {
    label: 'Po terminie · 12 paź',
    overdue: true,
  })
  assert.equal(getTaskDuePresentation(due('2026-10-13'), now)?.overdue, false)
})

test('deadline with time becomes overdue later on the same day', () => {
  const now = new Date('2026-10-13T08:30:00Z')
  assert.deepEqual(getTaskDuePresentation(due('2026-10-13', '09:00'), now), {
    label: 'Po terminie · Dzisiaj, 09:00',
    overdue: true,
  })
  assert.equal(getTaskDuePresentation(due('2026-10-13', '11:00'), now)?.overdue, false)
})

test('completed tasks do not receive overdue styling', () => {
  const result = getTaskDuePresentation(due('2026-10-12', null, true), new Date('2026-10-13T08:30:00Z'))
  assert.equal(result?.overdue, false)
  assert.equal(result?.label, '12 paź')
})

test('uses Warsaw calendar date around UTC midnight', () => {
  const afterWarsawMidnight = new Date('2026-10-12T22:30:00Z')
  assert.deepEqual(getTaskDuePresentation(due('2026-10-13'), afterWarsawMidnight), {
    label: 'Dzisiaj',
    overdue: false,
  })
})
