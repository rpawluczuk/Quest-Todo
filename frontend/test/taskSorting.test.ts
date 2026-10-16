import assert from 'node:assert/strict'
import test from 'node:test'
import { sortActiveTasks } from '../src/taskSorting.ts'
import type { Task } from '../src/types/Task.ts'

function task(id: number, title: string, goalTitles: string[] = [], categoryName?: string): Task {
  return {
    id,
    title,
    description: null,
    points: 1,
    completed: false,
    completedAt: null,
    inFocus: false,
    dueDate: null,
    dueTime: null,
    category: categoryName
      ? { id: id + 100, name: categoryName, icon: 'OTHER', color: 'PURPLE' }
      : null,
    goalIds: goalTitles.map((_, index) => index + 1),
    goalTitles,
  }
}

test('sorts active tasks by goals, then categories, then unassigned tasks', () => {
  const source = [
    task(1, 'Żadne B'),
    task(2, 'Zdrowie B', [], 'Zdrowie'),
    task(3, 'Plecy B', ['Naprawić plecy']),
    task(4, 'Praca A', [], 'Praca'),
    task(5, 'Finanse A', ['Finanse']),
    task(6, 'Plecy A', ['Naprawić plecy']),
    task(7, 'Zdrowie A', [], 'Zdrowie'),
    task(8, 'Żadne A'),
  ]

  assert.deepEqual(sortActiveTasks(source).map(item => item.id), [5, 6, 3, 4, 7, 2, 8, 1])
  assert.deepEqual(source.map(item => item.id), [1, 2, 3, 4, 5, 6, 7, 8])
})

test('goal assignment takes precedence over a category and uses the first alphabetical goal as its group', () => {
  const sorted = sortActiveTasks([
    task(1, 'Tylko kategoria', [], 'Zdrowie'),
    task(2, 'Cel i kategoria', ['Zdrowie', 'Aktywność'], 'Zdrowie'),
    task(3, 'Ten sam główny cel', ['Aktywność']),
  ])

  assert.deepEqual(sorted.map(item => item.id), [2, 3, 1])
})
