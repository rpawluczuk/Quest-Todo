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
  let release
  const heldRequest = new Promise(resolve => { release = resolve })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() !== 'GET') writes.push(path)
    let body = []
    if (path === '/api/users/me') body = { id: 1, login: 'test', points: 0, theme: 'PURPLE' }
    else if (path === '/api/tasks/overview') body = { tasks, completedCount: 1 }
    else if (path === '/api/tasks/history') body = { tasks: [history], total: 1, hasMore: false }
    else if (/^\/api\/tasks\/\d+\/subtasks$/.test(path)) {
      const id = Number(path.split('/')[3])
      requests.push(id)
      if (id === 1) await heldRequest
      if (id === 3 && fail) return route.fulfill({ status: 503, json: {} })
      body = Array.from({ length: 4 }, (_, i) => ({ id: id * 10 + i, position: i,
        title: i === 3 ? 'Bardzo długa nazwa podzadania '.repeat(5) : `Krok ${id}.${i + 1}`,
        completed: id === 4 || (id === 1 && i < 2) }))
    }
    await route.fulfill({ json: body })
  })
  await page.goto(process.env.SUBTASKS_TEST_URL ?? 'http://127.0.0.1:5188')
  const card = title => page.locator('.task-card').filter({ has: page.locator('.task-card-title-text', { hasText: title }) })
  const priority = card('Priorytet z podzadaniami')
  const other = card('Pozostałe z podzadaniami')
  await priority.waitFor()
  assert.equal(await card('Bez podzadań').locator('.task-subtasks').count(), 0)
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
  assert.deepEqual(await priority.locator('.task-subtasks-list li span').allTextContents(),
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

  for (const width of [320, 375, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      controls: [...document.querySelectorAll('.task-subtasks-toggle')].map(el => el.getBoundingClientRect().height),
      rows: [...document.querySelectorAll('.task-subtasks-list')].map(el => el.scrollWidth > el.clientWidth),
    }))
    assert.equal(layout.overflow, false, `page overflow at ${width}`)
    assert.ok(layout.controls.every(height => height >= 40))
    assert.ok(layout.rows.every(overflow => !overflow), `list overflow at ${width}`)
  }
  await page.setViewportSize({ width: 375, height: 900 })
  await priority.screenshot({ path: '../.local-backups/subtasks-card.png' })
  assert.deepEqual(errors, [])
  console.log('PASS: counters, lazy loading, deduplication, keyboard, read-only status, retry, all task sections, mobile and desktop')
} finally {
  await browser.close()
}
