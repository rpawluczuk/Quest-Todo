import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 850 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const base = { description: 'Notatka rodzica', points: 5, completed: false, completedAt: null,
    inFocus: true, dueDate: null, dueTime: null, category: null, goalId: null, goalTitle: null }
  const tasks = [
    { ...base, id: 1, title: 'Priorytet z podzadaniami', subtaskCount: 4, completedSubtaskCount: 2 },
    { ...base, id: 2, title: 'Bez podzadań', subtaskCount: 0, completedSubtaskCount: 0 },
    { ...base, id: 3, title: 'Pozostałe z podzadaniami', inFocus: false, subtaskCount: 4, completedSubtaskCount: 0 },
  ]
  const history = { ...base, id: 4, title: 'Ukończone z podzadaniami', completed: true,
    completedAt: '2026-10-25T12:00:00Z', subtaskCount: 4, completedSubtaskCount: 4 }
  const goals = [
    { id: 1, title: 'Cel testowy', completed: false, currentState: '', desiredOutcome: '', completedAt: null },
    { id: 2, title: 'Cel osiągnięty', completed: true, currentState: '', desiredOutcome: '', completedAt: '2026-10-25T12:00:00Z' },
  ]
  tasks[0].goalId = 1; tasks[1].goalId = 1; history.goalId = 2
  const requests = []
  const writes = []
  let fail = false
  let failWrite = false
  let nextId = 100
  let orderFailure = 0
  let orderWrites = 0
  const stored = new Map()
  const gates = new Map()
  let points = 0
  const allTasks = [...tasks, history]
  function syncCounts(id) {
    const task = allTasks.find(task => task.id === id)
    const items = stored.get(id) ?? []
    task.subtaskCount = items.length
    task.completedSubtaskCount = items.filter(item => item.completed).length
  }
  let release
  const heldRequest = new Promise(resolve => { release = resolve })
  release()
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() !== 'GET') writes.push(path)
    let body = []
    if (path === '/api/users/me') body = { id: 1, login: 'test', points, theme: 'PURPLE' }
    else if (path === '/api/auth/csrf') body = { headerName: 'X-CSRF-TOKEN', token: 'test' }
    else if (path === '/api/goals') body = goals
    else if (/^\/api\/goals\/\d+\/completion$/.test(path)) {
      body = goals.find(goal => goal.id === Number(path.split('/')[3]))
      body.completed = request.postDataJSON().completed
    }
    else if (/^\/api\/goals\/\d+\/tasks$/.test(path)) body = allTasks.filter(task => task.goalId === Number(path.split('/')[3]))
    else if (/^\/api\/goals\/\d+\/tasks\/available$/.test(path)) body = { tasks: allTasks.filter(task => task.goalId !== Number(path.split('/')[3])), hasMore: false }
    else if (/^\/api\/goals\/\d+\/tasks\/\d+$/.test(path)) {
      allTasks.find(task => task.id === Number(path.split('/')[5])).goalId = request.method() === 'PUT' ? Number(path.split('/')[3]) : null
      return route.fulfill({ status: 204 })
    }
    else if (path === '/api/tasks/overview') body = { tasks: allTasks.filter(task => !task.completed), completedCount: allTasks.filter(task => task.completed).length }
    else if (path === '/api/tasks/history') body = { tasks: allTasks.filter(task => task.completed), total: allTasks.filter(task => task.completed).length, hasMore: false }
    else if (/^\/api\/tasks\/\d+(?:\/completion)?$/.test(path)) {
      body = allTasks.find(task => task.id === Number(path.split('/')[3]))
      if (request.method() === 'PATCH') {
        const completed = request.postDataJSON().completed
        if (completed !== body.completed) points += completed ? body.points : -body.points
        body.completed = completed
        body.completedAt = completed ? new Date().toISOString() : null
      }
    }
    else if (/^\/api\/tasks\/\d+\/subtasks\/order$/.test(path)) {
      orderWrites++
      if (orderFailure) return route.fulfill({ status: orderFailure, json: {} })
      const id = Number(path.split('/')[3])
      const ids = request.postDataJSON().subtaskIds
      body = ids.map((subtaskId, position) => ({ ...stored.get(id).find(item => item.id === subtaskId), position }))
      stored.set(id, body)
    }
    else if (/^\/api\/tasks\/\d+\/subtasks(?:\/\d+)?$/.test(path)) {
      const id = Number(path.split('/')[3])
      if (request.method() !== 'GET') {
        if (failWrite) return route.fulfill({ status: 503, json: { detail: 'Błąd testowy zapisu' } })
        const items = stored.get(id) ?? []
        const subtaskId = Number(path.split('/')[5])
        if (request.method() === 'POST') {
          body = { id: nextId++, title: request.postDataJSON().title, completed: false,
            position: Math.max(-1, ...items.map(item => item.position)) + 1 }
          items.push(body)
        } else if (request.method() === 'PATCH') {
          const payload = request.postDataJSON()
          assert.deepEqual(Object.keys(payload), 'completed' in payload ? ['completed'] : ['title'])
          const gate = gates.get(subtaskId)
          if (gate) {
            await gate.promise
            if (gate.fail) return route.fulfill({ status: 503, json: { detail: 'Błąd statusu' } })
          }
          body = items.find(item => item.id === subtaskId)
          Object.assign(body, payload)
        } else {
          stored.set(id, items.filter(item => item.id !== subtaskId))
          syncCounts(id)
          return route.fulfill({ status: 204 })
        }
        stored.set(id, items)
        syncCounts(id)
        return route.fulfill({ status: request.method() === 'POST' ? 201 : 200, json: body })
      }
      requests.push(id)
      if (id === 1) await heldRequest
      if (id === 3 && fail) return route.fulfill({ status: 503, json: {} })
      body = stored.get(id) ?? Array.from({ length: id === 2 ? 0 : 4 }, (_, i) => ({ id: id * 10 + i, position: i,
        title: i === 3 ? 'Bardzo długa nazwa podzadania '.repeat(5) : `Krok ${id}.${i + 1}`,
        completed: id === 4 || (id === 1 && i < 2) }))
      stored.set(id, body)
    }
    await route.fulfill({ json: body })
  })
  await page.goto(process.env.SUBTASKS_TEST_URL ?? 'http://127.0.0.1:5188')
  const nav = page.getByRole('navigation', { name: 'Widoki aplikacji' })
  const goal = page.locator('.goal-card').filter({ has: page.getByRole('button', { name: 'Cel testowy', exact: true }) })
  const row = title => page.locator('#goal-tasks-1 .goal-linked-task').filter({ has: page.locator('.goal-linked-item-title', { hasText: title }) })
  const priority = row(tasks[0].title)
  const empty = row(tasks[1].title)
  await nav.getByRole('button', { name: 'Cele', exact: true }).click()
  await page.getByRole('button', { name: 'Cel testowy', exact: true }).click()
  await page.locator('#goal-tab-tasks-1').click()
  await priority.waitFor()
  assert.deepEqual(requests, [])
  assert.equal(await empty.locator('.task-subtasks').isVisible(), false)
  await priority.getByRole('button', { name: '2/4 podzadań' }).click()
  await priority.getByText('Krok 1.1', { exact: true }).waitFor()
  assert.deepEqual(requests, [1])
  await priority.getByRole('button', { name: '2/4 podzadań' }).click()
  await priority.getByRole('button', { name: '2/4 podzadań' }).click()
  assert.deepEqual(requests, [1])
  assert.equal(await priority.locator(':scope > input').isChecked(), false)

  async function menu(target, action) {
    await target.locator(':scope > .task-menu > button').click()
    await target.getByRole('menuitem', { name: action, exact: true }).click()
  }
  async function add(target, name, first = false) {
    if (first) await menu(target, 'Dodaj podzadanie')
    else await target.getByRole('button', { name: 'Dodaj podzadanie', exact: true }).click()
    const input = target.getByRole('textbox', { name: 'Tytuł podzadania' })
    await input.fill(name); await input.press('Enter')
    await input.waitFor({ state: 'detached' })
  }
  await add(empty, 'Pierwszy krok', true)
  await add(empty, 'Drugi krok')
  await empty.getByRole('button', { name: '0/2 podzadań' }).waitFor()
  const subrow = () => empty.locator('.task-subtasks-list li').filter({ hasText: 'Pierwszy krok' })
  await menu(subrow(), 'Edytuj')
  await empty.getByRole('textbox').fill('Zmieniony krok')
  await empty.getByRole('textbox').press('Enter')
  await empty.getByText('Zmieniony krok', { exact: true }).waitFor()
  page.once('dialog', dialog => dialog.accept())
  await menu(empty.locator('.task-subtasks-list li').filter({ hasText: 'Drugi krok' }), 'Usuń')
  await empty.getByRole('button', { name: '0/1 podzadań' }).waitFor()
  await empty.getByRole('checkbox', { name: 'Podzadanie: Zmieniony krok' }).check()
  await empty.getByRole('button', { name: '1/1 podzadań' }).waitFor()
  await empty.locator(':scope > input').click()
  await page.locator('#goal-tasks-1').getByRole('button', { name: 'Ukończone (1)' }).click()
  await empty.waitFor()
  assert.equal(await page.getByRole('dialog').count(), 0)
  await empty.getByRole('button', { name: '1/1 podzadań' }).click()
  assert.equal(await empty.getByRole('checkbox', { name: 'Podzadanie: Zmieniony krok' }).isChecked(), true)
  await empty.locator(':scope > input').click()
  await page.locator('.goal-task-todo .goal-linked-task').filter({ hasText: tasks[1].title }).waitFor()
  assert.equal(points, 0)

  await priority.locator(':scope > input').click()
  await page.getByRole('dialog').getByText('Nie wszystkie podzadania są ukończone', { exact: true }).waitFor()
  await page.getByRole('dialog').getByRole('button', { name: 'Anuluj' }).click()
  assert.equal(await priority.locator(':scope > input').isChecked(), false)
  await priority.locator(':scope > input').click()
  await page.getByRole('dialog').getByRole('button', { name: 'Zakończ zadanie' }).click()
  await page.locator('#goal-tasks-1').getByRole('button', { name: 'Ukończone (1)' }).click()
  await priority.locator(':scope > input').click()
  await page.locator('.goal-task-todo .goal-linked-task').filter({ hasText: tasks[0].title }).waitFor()
  await priority.getByRole('button', { name: '2/4 podzadań' }).click()
  await priority.getByRole('checkbox', { name: 'Podzadanie: Krok 1.3' }).check()
  await priority.getByRole('button', { name: '3/4 podzadań' }).waitFor()
  failWrite = true
  await priority.getByRole('checkbox', { name: 'Podzadanie: Krok 1.3' }).uncheck()
  await priority.getByRole('alert').waitFor()
  assert.equal(await priority.getByRole('checkbox', { name: 'Podzadanie: Krok 1.3' }).isChecked(), true)
  failWrite = false

  await priority.locator('.subtask-grip').first().focus()
  await page.keyboard.press('Space')
  await priority.locator('.subtask-dragging').waitFor()
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(250); await page.keyboard.press('Space')
  await page.waitForFunction(() => !document.querySelector('#goal-tasks-1 .subtask-grip')?.disabled)
  const reordered = await priority.locator('.subtask-title').allTextContents()
  assert.equal(reordered[0], 'Krok 1.2')
  const beforeSwitch = requests.length
  await nav.getByRole('button', { name: 'Zadania', exact: true }).click()
  const main = page.locator('.task-card').filter({ has: page.locator('.task-card-title-text', { hasText: tasks[0].title }) })
  await main.getByRole('button', { name: '3/4 podzadań' }).click()
  assert.deepEqual(await main.locator('.subtask-title').allTextContents(), reordered)
  assert.equal(requests.length, beforeSwitch)
  await main.getByRole('checkbox', { name: 'Podzadanie: Krok 1.3' }).uncheck()
  await main.getByRole('button', { name: '2/4 podzadań' }).waitFor()
  await nav.getByRole('button', { name: 'Cele', exact: true }).click()
  await priority.getByRole('button', { name: '2/4 podzadań' }).waitFor()
  assert.equal(await priority.getByRole('checkbox', { name: 'Podzadanie: Krok 1.3' }).isChecked(), false)
  assert.equal(await page.locator('#goal-tab-tasks-1').innerText(), 'Zadania\n2')

  for (const width of [320, 375, 390, 1280]) {
    await page.setViewportSize({ width, height: 850 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  }
  await page.setViewportSize({ width: 375, height: 850 })
  await priority.screenshot({ path: '../.local-backups/goal-subtasks.png' })
  await menu(priority, 'Odepnij od celu')
  await priority.waitFor({ state: 'detached' })
  assert.equal(stored.get(1).length, 4)
  await page.getByRole('button', { name: 'Dodaj zadanie do celu', exact: true }).click()
  await page.getByRole('menuitem', { name: /Przypnij istniejące/ }).click()
  await page.getByRole('button', { name: `Przypnij zadanie: ${tasks[0].title}`, exact: true }).click()
  await page.getByRole('button', { name: 'Gotowe', exact: true }).click()
  await priority.getByRole('button', { name: '2/4 podzadań' }).click()
  assert.deepEqual(await priority.locator('.subtask-title').allTextContents(), reordered)
  assert.equal(requests.length, beforeSwitch)

  await page.locator('.goal-achieved-toggle').click()
  await page.getByRole('button', { name: 'Cel osiągnięty', exact: true }).click()
  await page.locator('#goal-tab-tasks-2').click()
  await page.locator('#goal-tasks-2').getByRole('button', { name: 'Ukończone (1)' }).click()
  const readonly = page.locator('#goal-tasks-2 .goal-linked-task')
  await readonly.getByRole('button', { name: '4/4 podzadań' }).click()
  await readonly.getByText('Krok 4.1', { exact: true }).waitFor()
  assert.equal(await readonly.locator('.subtask-check input:disabled').count(), 4)
  assert.equal(await readonly.locator('.subtask-grip').count(), 0)
  assert.equal(await readonly.getByRole('button', { name: 'Dodaj podzadanie', exact: true }).count(), 0)
  await readonly.getByRole('button', { name: '4/4 podzadań' }).click()
  await readonly.getByRole('button', { name: '4/4 podzadań' }).click()
  const achieved = page.locator('.goal-card').filter({ has: page.getByRole('button', { name: 'Cel osiągnięty', exact: true }) })
  await achieved.locator('.goal-header-actions .task-menu-trigger').click()
  await page.getByRole('menuitem', { name: 'Wznów cel' }).click()
  await page.getByRole('button', { name: 'Cel osiągnięty', exact: true }).click()
  await page.locator('#goal-tab-tasks-2').click()
  await page.locator('#goal-tasks-2').getByRole('button', { name: 'Ukończone (1)' }).click()
  await readonly.getByRole('button', { name: '4/4 podzadań' }).click()
  assert.equal(await readonly.locator('.subtask-check input:disabled').count(), 0)
  assert.deepEqual(errors, [])
  console.log('PASS: goal subtasks CRUD, completion/undo, shared cache/order, attach/detach, read-only/resume, mobile')
} finally { await browser.close() }
