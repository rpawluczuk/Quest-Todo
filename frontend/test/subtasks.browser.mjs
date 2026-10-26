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
  const stored = new Map()
  let release
  const heldRequest = new Promise(resolve => { release = resolve })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() !== 'GET') writes.push(path)
    let body = []
    if (path === '/api/users/me') body = { id: 1, login: 'test', points: 0, theme: 'PURPLE' }
    else if (path === '/api/auth/csrf') body = { headerName: 'X-CSRF-TOKEN', token: 'test' }
    else if (path === '/api/tasks/overview') body = { tasks, completedCount: 1 }
    else if (path === '/api/tasks/history') body = { tasks: [history], total: 1, hasMore: false }
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
          assert.deepEqual(Object.keys(request.postDataJSON()), ['title'])
          body = items.find(item => item.id === subtaskId)
          body.title = request.postDataJSON().title
        } else {
          stored.set(id, items.filter(item => item.id !== subtaskId))
          return route.fulfill({ status: 204 })
        }
        stored.set(id, items)
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
  assert.equal(await priority.locator('.task-subtasks input, .task-subtasks [role="checkbox"]').count(), 0)
  assert.equal(await priority.getByRole('img', { name: 'Ukończone', exact: true }).count(), 2)
  await priority.getByText('Krok 1.1', { exact: true }).click()
  assert.equal(await priority.locator('.task-card-description').isVisible(), false)
  assert.equal(await priority.locator('input[type="checkbox"]').isChecked(), false)
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
  assert.equal(await empty.locator('input[type="checkbox"]').isChecked(), false)
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
  assert.deepEqual(errors, [])
  console.log('PASS: CRUD, validation, Enter/Escape, confirmations, API errors, counters, lazy loading, read-only status, all sections, mobile and desktop')
} finally {
  await browser.close()
}
