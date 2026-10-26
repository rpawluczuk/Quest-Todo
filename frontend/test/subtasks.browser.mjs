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
  const requests = []
  const writes = []
  let fail = true
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
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() !== 'GET') writes.push(path)
    let body = []
    if (path === '/api/users/me') body = { id: 1, login: 'test', points, theme: 'PURPLE' }
    else if (path === '/api/auth/csrf') body = { headerName: 'X-CSRF-TOKEN', token: 'test' }
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
  const card = title => page.locator('.task-card').filter({ has: page.locator('.task-card-title-text', { hasText: title }) })
  const priority = card('Priorytet z podzadaniami')
  const other = card('Pozostałe z podzadaniami')
  await priority.waitFor()
  assert.equal(await card('Bez podzadań').locator('.task-subtasks').isVisible(), false)
  assert.equal(await priority.getByRole('button', { name: '2/4 podzadań' }).count(), 1)
  assert.equal(await other.getByRole('button', { name: '0/4 podzadań' }).count(), 1)
  assert.deepEqual(requests, [])
  const toggle = priority.getByRole('button', { name: '2/4 podzadań' })
  await toggle.focus()
  await page.keyboard.press('Enter')
  await priority.getByRole('status').filter({ hasText: 'Ładowanie podzadań' }).waitFor()
  await toggle.click()
  await toggle.click()
  assert.deepEqual(requests, [1])
  release()
  await priority.getByText('Krok 1.1', { exact: true }).waitFor()
  assert.deepEqual(await priority.locator('.task-subtasks-list .subtask-title').allTextContents(),
    ['Krok 1.1', 'Krok 1.2', 'Krok 1.3', 'Bardzo długa nazwa podzadania '.repeat(5)])
  assert.equal(await priority.locator('.subtask-completed').count(), 2)
  assert.equal(await priority.locator('.subtask-check input').count(), 4)
  assert.equal(await priority.locator('.subtask-check input:checked').count(), 2)
  await priority.getByText('Krok 1.1', { exact: true }).click()
  assert.equal(await priority.locator('.task-card-description').isVisible(), false)
  assert.equal(await priority.locator(':scope > .task-card-check input').isChecked(), false)
  await toggle.click()
  assert.equal(await priority.getByText('Krok 1.1', { exact: true }).isVisible(), false)
  await toggle.click()
  assert.deepEqual(requests, [1])

  await other.getByRole('button', { name: '0/4 podzadań' }).click()
  await other.getByRole('alert').waitFor()
  fail = false
  await other.getByRole('button', { name: 'Spróbuj ponownie' }).click()
  await other.getByText('Krok 3.1', { exact: true }).waitFor()
  assert.equal(await priority.getByText('Krok 1.1', { exact: true }).isVisible(), true)
  await page.locator('.completed-toggle').click()
  const completed = card('Ukończone z podzadaniami')
  await completed.getByRole('button', { name: '4/4 podzadań' }).click()
  await completed.getByText('Krok 4.1', { exact: true }).waitFor()
  assert.equal(await completed.locator('.subtask-completed').count(), 4)
  assert.deepEqual(requests, [1, 3, 3, 4])
  assert.deepEqual(writes, [])

  const rowTitles = () => priority.locator('.subtask-title').allTextContents()
  const originalTitles = await rowTitles()
  async function keyboardMove() {
    await priority.locator('.subtask-grip').first().focus()
    await page.keyboard.press('Space')
    await priority.locator('.subtask-dragging').waitFor()
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(250)
    await page.keyboard.press('Space')
    await page.waitForFunction(() => ![...document.querySelectorAll('.subtask-grip')].some(el => el.disabled))
  }
  await keyboardMove()
  assert.deepEqual((await rowTitles()).slice(0, 2), ['Krok 1.2', 'Krok 1.1'])
  assert.equal(orderWrites, 1)
  await keyboardMove()
  assert.deepEqual(await rowTitles(), originalTitles)
  const beforeNoMove = orderWrites
  await priority.locator('.subtask-grip').first().focus()
  await page.keyboard.press('Space')
  await priority.locator('.subtask-dragging').waitFor()
  await page.waitForTimeout(100)
  await page.keyboard.press('Space')
  await priority.locator('.subtask-dragging').waitFor({ state: 'detached' })
  assert.equal(orderWrites, beforeNoMove)
  orderFailure = 503
  await keyboardMove()
  await priority.getByRole('alert').filter({ hasText: 'Nie udało się zapisać kolejności' }).waitFor()
  assert.deepEqual(await rowTitles(), originalTitles)
  orderFailure = 409
  await keyboardMove()
  await priority.getByRole('alert').filter({ hasText: 'Lista podzadań zmieniła się' }).waitFor()
  assert.deepEqual(await rowTitles(), originalTitles)
  orderFailure = 0
  const client = await page.context().newCDPSession(page)
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true })
  await priority.locator('.subtask-grip').first().scrollIntoViewIfNeeded()
  const start = await priority.locator('.subtask-grip').first().boundingBox()
  const end = await priority.locator('.subtask-grip').nth(1).boundingBox()
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x + 16, y: start.y + 20 }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + 16, y: start.y + 30 }] })
  await page.waitForTimeout(100)
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: end.x + 16, y: end.y + 20 }] })
  await page.waitForTimeout(250)
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForFunction(() => ![...document.querySelectorAll('.subtask-grip')].some(el => el.disabled))
  assert.deepEqual((await rowTitles()).slice(0, 2), ['Krok 1.2', 'Krok 1.1'])
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: false })
  const mouseStart = await priority.locator('.subtask-grip').first().boundingBox()
  const mouseEnd = await priority.locator('.subtask-grip').nth(1).boundingBox()
  await page.mouse.move(mouseStart.x + 16, mouseStart.y + 20)
  await page.mouse.down()
  await page.mouse.move(mouseStart.x + 16, mouseStart.y + 30, { steps: 3 })
  await page.mouse.move(mouseEnd.x + 16, mouseEnd.y + 20, { steps: 8 })
  await page.mouse.up()
  await page.waitForFunction(() => ![...document.querySelectorAll('.subtask-grip')].some(el => el.disabled))
  assert.deepEqual(await rowTitles(), originalTitles)

  // Two independent optimistic changes, responses arriving in reverse order.
  function hold(id, fail = false) {
    let resolve
    const promise = new Promise(done => { resolve = done })
    gates.set(id, { promise, fail })
    return () => { resolve(); gates.delete(id) }
  }
  const finishThird = hold(12, true)
  const finishFourth = hold(13)
  const checks = priority.locator('.subtask-check input')
  await checks.nth(2).focus()
  await page.keyboard.press('Space')
  assert.equal(await checks.nth(2).isChecked(), true)
  assert.equal(await checks.nth(2).isDisabled(), true)
  assert.equal(await checks.nth(3).isDisabled(), false)
  await priority.getByRole('button', { name: '3/4 podzadań' }).waitFor()
  await checks.nth(2).evaluate(el => { el.click(); el.click() })
  await checks.nth(3).check()
  await priority.getByRole('button', { name: '4/4 podzadań' }).waitFor()
  finishFourth()
  await page.waitForFunction(() => !document.querySelectorAll('.task-card-focus .subtask-check input')[3].disabled)
  finishThird()
  await priority.getByRole('alert').filter({ hasText: 'Błąd statusu' }).waitFor()
  assert.equal(await checks.nth(2).isChecked(), false)
  assert.equal(await checks.nth(3).isChecked(), true)
  await priority.getByRole('button', { name: '3/4 podzadań' }).waitFor()
  assert.equal(writes.filter(path => path.endsWith('/12')).length, 1)
  assert.equal(points, 0)
  assert.equal(await priority.locator(':scope > .task-card-check input').isChecked(), false)
  await checks.nth(3).uncheck()
  await priority.getByRole('button', { name: '2/4 podzadań' }).waitFor()
  await page.waitForFunction(() => !document.querySelectorAll('.task-card-focus .subtask-check input')[3].disabled)

  const empty = card('Bez podzadań')
  async function parentAdd(target) {
    await target.locator(':scope > .task-menu > button').click()
    await target.getByRole('menuitem', { name: 'Dodaj podzadanie' }).click()
    await target.getByRole('textbox', { name: 'Tytuł podzadania' }).waitFor()
  }
  async function itemMenu(target, title, action) {
    const row = target.locator('.task-subtasks-list li').filter({ has: page.locator('.subtask-title', { hasText: title }) })
    await row.locator('.task-menu-trigger').click()
    await row.getByRole('menuitem', { name: action, exact: true }).click()
  }
  await parentAdd(empty)
  let input = empty.getByRole('textbox')
  assert.equal(await input.evaluate(el => el === document.activeElement), true)
  await input.fill('   ')
  assert.equal(await empty.getByRole('button', { name: 'Dodaj', exact: true }).isDisabled(), true)
  await input.press('Escape')
  assert.equal(await input.count(), 0)
  await parentAdd(empty)
  input = empty.getByRole('textbox')
  await input.fill('Pierwsze')
  failWrite = true
  await input.press('Enter')
  await empty.getByRole('alert').waitFor()
  assert.equal(await input.inputValue(), 'Pierwsze')
  failWrite = false
  await input.press('Enter')
  await empty.getByRole('button', { name: '0/1 podzadań' }).waitFor()
  await empty.getByRole('button', { name: 'Dodaj podzadanie', exact: true }).click()
  await empty.getByRole('textbox').fill('Drugie')
  await empty.getByRole('textbox').press('Enter')
  await empty.getByRole('button', { name: '0/2 podzadań' }).waitFor()
  await itemMenu(empty, 'Pierwsze', 'Edytuj')
  const beforeUnchanged = writes.length
  await empty.getByRole('textbox').press('Enter')
  assert.equal(writes.length, beforeUnchanged)
  await itemMenu(empty, 'Pierwsze', 'Edytuj')
  await empty.getByRole('textbox').fill('Anulowana zmiana')
  await empty.getByRole('textbox').press('Escape')
  await itemMenu(empty, 'Pierwsze', 'Edytuj')
  await empty.getByRole('textbox').fill('Poprawione')
  failWrite = true
  await empty.getByRole('textbox').press('Enter')
  await empty.getByRole('alert').waitFor()
  assert.equal(await empty.getByRole('textbox').inputValue(), 'Poprawione')
  failWrite = false
  await empty.getByRole('textbox').press('Enter')
  await empty.locator('.subtask-title', { hasText: 'Poprawione' }).waitFor()
  page.once('dialog', dialog => dialog.dismiss())
  await itemMenu(empty, 'Poprawione', 'Usuń')
  assert.equal(await empty.locator('.subtask-title').count(), 2)
  failWrite = true
  page.once('dialog', dialog => dialog.accept())
  await itemMenu(empty, 'Poprawione', 'Usuń')
  await empty.getByRole('alert').waitFor()
  assert.equal(await empty.locator('.subtask-title').count(), 2)
  failWrite = false
  for (const title of ['Poprawione', 'Drugie']) {
    page.once('dialog', dialog => dialog.accept())
    await itemMenu(empty, title, 'Usuń')
    await empty.locator('.subtask-title', { hasText: title }).waitFor({ state: 'detached' })
  }
  assert.equal(await empty.locator('.task-subtasks-toggle:not(.subtask-add)').count(), 0)
  await parentAdd(empty)
  await empty.getByRole('button', { name: 'Anuluj', exact: true }).click()
  // Completed subtasks and completed parents remain editable; PATCH contains title only.
  await itemMenu(completed, 'Krok 4.1', 'Edytuj')
  await completed.getByRole('textbox').fill('Ukończony krok po edycji')
  await completed.getByRole('textbox').press('Enter')
  await completed.locator('.subtask-title', { hasText: 'Ukończony krok po edycji' }).waitFor()
  assert.equal(await completed.locator('.subtask-completed').count(), 4)
  assert.equal(await empty.locator(':scope > .task-card-check input').isChecked(), false)
  assert.equal(await empty.locator('.task-card-description').isVisible(), false)
  assert.ok(writes.every(path => path.includes('/subtasks')))
  assert.equal(await empty.locator('.task-card-points').textContent(), '5 pkt')
  await other.getByRole('button', { name: 'Dodaj podzadanie', exact: true }).click()
  await other.getByRole('textbox').fill('Nowe podzadanie z długim tytułem')

  for (const width of [320, 375, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      controls: [...document.querySelectorAll('.task-subtasks-toggle')].filter(el => el.checkVisibility()).map(el => el.getBoundingClientRect().height),
      rows: [...document.querySelectorAll('.task-subtasks-list')].map(el => el.scrollWidth > el.clientWidth),
    }))
    assert.equal(layout.overflow, false, `page overflow at ${width}`)
    assert.ok(layout.controls.every(height => height >= 40))
    assert.ok(layout.rows.every(overflow => !overflow), `list overflow at ${width}`)
  }
  await page.setViewportSize({ width: 375, height: 900 })
  await priority.screenshot({ path: '../.local-backups/subtasks-card.png' })
  await other.getByRole('button', { name: 'Anuluj', exact: true }).click()
  const parent = priority.locator(':scope > .task-card-check input')
  await parent.click()
  await page.getByRole('dialog', { name: 'Nie wszystkie podzadania są ukończone' }).waitFor()
  assert.equal(points, 0)
  await page.getByRole('button', { name: 'Anuluj', exact: true }).click()
  assert.equal(await parent.isChecked(), false)
  assert.ok(writes.every(path => path.includes('/subtasks')))
  const statuses = stored.get(1).map(item => item.completed)
  await parent.click()
  await page.getByRole('button', { name: 'Zakończ zadanie', exact: true }).click()
  await page.locator('.task-card-completed').filter({ hasText: 'Priorytet z podzadaniami' }).waitFor()
  assert.equal(points, 5)
  assert.deepEqual(stored.get(1).map(item => item.completed), statuses)
  await priority.getByRole('button', { name: '2/4 podzadań' }).click()
  await priority.locator('.subtask-check input').first().waitFor()
  await priority.locator(':scope > .task-card-check input').click()
  await page.locator('.task-card-focus').filter({ hasText: 'Priorytet z podzadaniami' }).waitFor()
  await page.locator('.task-card-completed').filter({ hasText: 'Priorytet z podzadaniami' }).waitFor({ state: 'detached' })
  assert.equal(points, 0)
  assert.deepEqual(stored.get(1).map(item => item.completed), statuses)
  await priority.getByRole('button', { name: '2/4 podzadań' }).click()
  await priority.locator('.subtask-check input').nth(2).check()
  await priority.locator('.subtask-check input').nth(3).check()
  await priority.getByRole('button', { name: '4/4 podzadań' }).waitFor()
  await page.waitForFunction(() => !document.querySelector('.task-card-focus:has(.task-subtasks) > .task-card-check input').disabled)
  assert.equal(points, 0)
  await priority.locator(':scope > .task-card-check input').click()
  await page.locator('.task-card-completed').filter({ hasText: 'Priorytet z podzadaniami' }).waitFor()
  assert.equal(await page.getByRole('dialog').count(), 0)
  await empty.locator(':scope > .task-card-check input').click()
  await page.locator('.task-card-completed').filter({ hasText: 'Bez podzadań' }).waitFor()
  assert.equal(await page.getByRole('dialog').count(), 0)
  await page.reload()
  await page.locator('.completed-toggle').click()
  await priority.getByRole('button', { name: '4/4 podzadań' }).click()
  await priority.locator('.subtask-check input').first().waitFor()
  assert.equal(await priority.locator('.subtask-check input:checked').count(), 4)
  assert.deepEqual(await rowTitles(), originalTitles)
  assert.deepEqual(errors, [])
  console.log('PASS: CRUD, optimistic checkboxes, concurrent rollback, counters, parent completion confirmation/undo, persistence, mobile and desktop')
} finally {
  await browser.close()
}
