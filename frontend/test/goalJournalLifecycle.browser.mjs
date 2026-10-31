import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const goals = [1, 2].map(id => ({ id, title: `Cel ${id}`, currentState: 'Stan początkowy', desiredOutcome: 'Kryterium', completed: false }))
  const long = ('<script>alert("test")</script>\nZażółć gęślą jaźń & < >\n\n\nhttps://example.test/' + 'dlugiwyraz'.repeat(40) + '\n').repeat(12).slice(0, 5000)
  const original = { id: 1, type: 'SUCCESS', content: long, createdAt: '2026-10-25T22:30:00Z', updatedAt: '2026-10-25T22:30:00Z' }
  const records = { 1: [], 2: [original] }
  const writes = [], errors = []
  let externallyCompleted = false
  page.on('pageerror', error => errors.push(error.message))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (path === '/api/auth/csrf') return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'test' } })
    const entry = path.match(/^\/api\/goals\/(\d+)\/entries(?:\/(\d+))?$/)
    if (entry) {
      const id = Number(entry[1])
      if (req.method() === 'GET') return route.fulfill({ json: { entries: records[id], totalElements: records[id].length, hasMore: false } })
      writes.push({ path, method: req.method() })
      if (externallyCompleted) return route.fulfill({ status: 409, json: { detail: 'Osiągnięty cel jest dostępny tylko do odczytu. Wznów cel, aby go zmieniać.' } })
      const added = { ...original, type: 'NOTE', ...req.postDataJSON() }
      records[id].unshift(added)
      return route.fulfill({ status: 201, json: added })
    }
    const completion = path.match(/^\/api\/goals\/(\d+)\/completion$/)
    if (completion) {
      const goal = goals.find(goal => goal.id === Number(completion[1]))
      goal.completed = req.postDataJSON().completed
      goal.completedAt = goal.completed ? '2026-10-31T12:00:00Z' : null
      writes.push({ path, method: req.method() })
      return route.fulfill({ json: goal })
    }
    return route.fulfill({ json: path === '/api/goals' ? goals
      : path === '/api/users/me' ? { id: 1, login: 'test', points: 0, theme: 'PURPLE' }
      : path === '/api/tasks/overview' ? { tasks: [], completedCount: 0 } : [] })
  })
  const card = id => page.locator(`#goal-card-${id}`)
  const journal = id => card(id).locator('.goal-journal')
  const toggle = id => journal(id).getByRole('button', { name: /^Dziennik celu/ })
  const plus = id => journal(id).getByRole('button', { name: 'Dodaj wpis do dziennika', exact: true })
  const form = id => journal(id).getByRole('form')
  const text = id => form(id).getByRole('textbox', { name: /Treść/ })
  const dialog = () => page.getByRole('dialog')
  async function goalAction(id, name) {
    await card(id).locator('.goal-header-actions .task-menu-trigger').click()
    await page.getByRole('menuitem', { name, exact: true }).click()
  }
  async function openGoal(id) {
    await page.getByRole('button', { name: `Cel ${id}`, exact: true }).click()
    assert.equal(await toggle(id).getAttribute('aria-expanded'), 'false')
    await toggle(id).click()
  }
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5197')
  await page.getByRole('navigation', { name: 'Widoki aplikacji' }).getByRole('button', { name: 'Cele', exact: true }).click()
  await openGoal(1)
  await journal(1).getByText('Zapisuj tutaj obserwacje, sukcesy i wnioski z realizacji celu.', { exact: true }).waitFor()
  await plus(1).focus(); await page.keyboard.press('Enter')
  await text(1).fill('Niezapisany wpis')
  for (const tab of ['tasks', 'habits', 'milestones']) await page.locator(`#goal-tab-${tab}-1`).click()
  assert.equal(await text(1).inputValue(), 'Niezapisany wpis')
  await toggle(1).click(); await toggle(1).click()
  assert.equal(await text(1).inputValue(), 'Niezapisany wpis')
  await goalAction(1, 'Oznacz jako osiągnięty')
  assert.equal(await dialog().getByRole('heading').innerText(), 'Odrzucić zmiany?')
  await dialog().getByRole('button', { name: 'Kontynuuj edycję' }).click()
  assert.equal(await text(1).inputValue(), 'Niezapisany wpis')
  assert.equal(writes.length, 0)
  await goalAction(1, 'Oznacz jako osiągnięty')
  await dialog().getByRole('button', { name: 'Odrzuć zmiany' }).click()
  await dialog().getByRole('button', { name: 'Tak, cel osiągnięty' }).click()
  await dialog().waitFor({ state: 'detached' })
  await page.getByRole('button', { name: /Osiągnięte \(/ }).click()
  await openGoal(1)
  await journal(1).getByText('Brak wpisów w dzienniku', { exact: true }).waitFor()
  assert.equal(await journal(1).locator('small').count(), 0)
  assert.equal(await plus(1).count(), 0); assert.equal(await form(1).count(), 0)
  await goalAction(1, 'Wznów cel'); await openGoal(1)
  await plus(1).click(); await text(1).fill(long)
  await form(1).getByRole('button', { name: 'Dodaj', exact: true }).click()
  await form(1).waitFor({ state: 'detached' })
  assert.equal(await journal(1).locator('.goal-journal-entry p').textContent(), long.trim())
  assert.equal(await journal(1).locator('script').count(), 0)
  const dates = await journal(1).locator('time').allTextContents()
  await goalAction(1, 'Oznacz jako osiągnięty')
  await dialog().getByRole('button', { name: 'Tak, cel osiągnięty' }).click()
  await dialog().waitFor({ state: 'detached' })
  await openGoal(1)
  assert.equal(await journal(1).locator('.task-menu-trigger').count(), 0)
  assert.deepEqual(await journal(1).locator('time').allTextContents(), dates)
  await goalAction(1, 'Wznów cel'); await openGoal(1)
  assert.equal(await journal(1).locator('.task-menu-trigger').count(), 1)
  assert.equal(await journal(1).locator('.goal-journal-entry p').textContent(), long.trim())
  for (const width of [320, 360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await plus(1).click(); await text(1).fill('Szkic na telefonie')
    assert.ok(await form(1).evaluate(el => el.scrollWidth <= el.clientWidth))
    await form(1).getByRole('button', { name: 'Anuluj' }).click()
    await journal(1).locator('.goal-journal-entry .task-menu-trigger').focus()
    await page.keyboard.press('Enter'); await page.getByRole('menuitem', { name: 'Edytuj', exact: true }).waitFor()
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
    await dialog().getByRole('heading', { name: 'Usunąć wpis z dziennika?' }).waitFor()
    assert.ok(await dialog().evaluate(el => el.getBoundingClientRect().left >= 0 && el.getBoundingClientRect().right <= innerWidth))
    await page.keyboard.press('Escape'); await dialog().waitFor({ state: 'detached' })
  }
  await openGoal(2)
  await journal(2).locator('.task-menu-trigger').click()
  await page.getByRole('menuitem', { name: 'Edytuj', exact: true }).click()
  await text(2).fill('Niezapisana edycja')
  await goalAction(2, 'Oznacz jako osiągnięty')
  await dialog().getByRole('button', { name: 'Kontynuuj edycję' }).click()
  assert.equal(await text(2).inputValue(), 'Niezapisana edycja')
  externallyCompleted = true
  await form(2).getByRole('button', { name: 'Zapisz', exact: true }).click()
  await form(2).getByRole('alert').filter({ hasText: 'tylko do odczytu' }).waitFor()
  assert.equal(await text(2).inputValue(), 'Niezapisana edycja')
  assert.deepEqual(records[2], [original])
  assert.deepEqual(errors, [])
  console.log('PASS: dirty creation/edit status guard, complete/resume preserving entries/dates, active/achieved empty states, external 409 keeps draft, 5000-character safe text, keyboard menu/dialog, 320/360/390/tablet/desktop')
} finally { await browser.close() }
