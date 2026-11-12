import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const base = { createdOn: '2026-10-01', startDate: '2026-10-01', endDate: null, endedOn: null, endReason: null,
    status: 'ACTIVE', activityStatus: 'ACTIVE', completed: false, weeklyRewardGranted: false, rewardPoints: 3,
    description: '', completionLimit: null, completionBonusPoints: null, requiredSuccessPercent: null,
    totalCompletions: 42, weeklyCompletedDays: 2, target: { targetDays: 3, effectiveFrom: '2026-10-26' },
    latestTarget: { targetDays: 3, effectiveFrom: '2026-10-26' }, category: null, goalIds: [1, 2, 3], goalTitles: [],
    regularity: null, completionBonusGranted: false, completionBonusEverGranted: false,
    completionBonusConditionsLocked: false, completionBonusTargetLocked: false,
    completionBonusSettledOn: null, completionBonusAwardPoints: null }
  const habits = [
    { ...base, id: 1, name: 'Aktywny', description: 'Notatka nawyku' },
    { ...base, id: 2, name: 'Wstrzymany', activityStatus: 'PAUSED' },
    { ...base, id: 3, name: 'Zaplanowany', activityStatus: 'PLANNED' },
    { ...base, id: 4, name: 'Zakończony', status: 'FINISHED', endedOn: '2026-10-28', endReason: 'ACHIEVED' },
    { ...base, id: 5, name: 'Usunięty' },
  ]
  const entry = (id, type = 'NOTE') => ({ id, type, content: `Treść ${id}\nDrugi akapit`,
    createdAt: `2026-10-${String(id + 10).padStart(2, '0')}T12:00:00Z`, updatedAt: '2026-10-25T12:00:00Z' })
  const records = { 1: [8, 7, 6, 5, 4, 3, 2, 1].map(id => entry(id)), 2: [entry(1)], 3: [], 4: [entry(1)], 5: [] }
  const writes = [], reads = [], errors = []
  let failure = 0, gate, release, refillFails = false, nextId = 20
  page.on('pageerror', error => errors.push(error.message))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname
    if (path === '/api/auth/csrf') return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'test' } })
    const match = path.match(/^\/api\/habits\/(\d+)\/entries(?:\/(\d+))?$/)
    if (match) {
      const habitId = Number(match[1]), id = Number(match[2]), method = req.method()
      if (method === 'GET') {
        reads.push(habitId)
        assert.equal(url.searchParams.get('page'), '0'); assert.equal(url.searchParams.get('size'), '3')
        if (refillFails) return route.fulfill({ status: 503, json: { detail: 'Błąd odświeżania' } })
        return route.fulfill({ json: { entries: records[habitId].slice(0, 3), totalElements: records[habitId].length, hasMore: records[habitId].length > 3 } })
      }
      const body = method === 'DELETE' ? undefined : req.postDataJSON()
      writes.push({ method, habitId, id, body })
      assert.equal(req.headers()['x-csrf-token'], 'test')
      if (body) assert.deepEqual(Object.keys(body).sort(), ['content', 'type'])
      if (gate) await gate
      if (failure === -1) return route.abort('internetdisconnected')
      if (failure) return route.fulfill({ status: failure, json: { detail: failure === 409 ? 'Dziennik zakończonego nawyku jest dostępny tylko do odczytu.' : 'Błąd zapisu wpisu' } })
      if (method === 'PATCH') {
        const updated = { ...records[habitId].find(item => item.id === id), ...body, updatedAt: '2026-11-10T12:00:00Z' }
        records[habitId] = records[habitId].map(item => item.id === id ? updated : item)
        return route.fulfill({ json: updated })
      }
      if (method === 'DELETE') {
        records[habitId] = records[habitId].filter(item => item.id !== id)
        return route.fulfill({ status: 204 })
      }
      const created = { ...entry(9), id: nextId++, ...body, createdAt: new Date().toISOString() }
      records[habitId].unshift(created)
      return route.fulfill({ status: 201, json: created })
    }
    if (req.method() !== 'GET') throw new Error(`Unexpected write outside journal: ${path}`)
    return route.fulfill({ json: path === '/api/habits' ? habits
      : path === '/api/users/me' ? { id: 1, login: 'test', points: 100, theme: 'PURPLE' }
      : path === '/api/tasks/overview' ? { tasks: [], completedCount: 0 } : [] })
  })
  const panel = id => page.locator(`#habit-journal-${id}`)
  const item = (habit, id) => panel(habit).locator(`[data-entry-id="${id}"]`)
  const form = id => panel(id).getByRole('form')
  const text = id => form(id).getByRole('textbox', { name: /Treść/ })
  const plus = id => panel(id).getByRole('button', { name: 'Dodaj wpis do dziennika', exact: true })
  const card = id => page.locator('li').filter({ has: page.getByRole('button', { name: `Więcej opcji dla nawyku „${habits[id - 1].name}”`, exact: true }) }).first()
  async function open(id) {
    await card(id).locator('.task-menu-trigger').first().click()
    await page.getByRole('menuitem', { name: 'Dziennik nawyku', exact: true }).click()
  }
  async function action(habit, id, label) {
    await item(habit, id).locator('.task-menu-trigger').click()
    await page.getByRole('menuitem', { name: label, exact: true }).click()
  }
  async function type(id, label) {
    await form(id).getByRole('combobox').click()
    await page.getByRole('option', { name: label, exact: true }).click()
  }
  async function waitClosed(id) { await form(id).waitFor({ state: 'detached' }) }
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5197')
  await page.getByRole('navigation', { name: 'Widoki aplikacji' }).getByRole('button', { name: 'Nawyki', exact: true }).click()
  await open(1)
  await item(1, 8).waitFor()
  const originalHeight = (await card(1).boundingBox()).height
  const progress = await card(1).locator('.habit-progress-summary').innerText()
  const week = await page.locator('.week-range').innerText()
  await plus(1).click()
  assert.equal(await text(1).evaluate(el => el === document.activeElement), true)
  assert.equal(await text(1).getAttribute('placeholder'), 'Co nowego w realizacji nawyku?')
  assert.equal(await form(1).getByRole('combobox').innerText(), 'Notatka')
  assert.equal(await form(1).getByRole('button', { name: 'Dodaj', exact: true }).isDisabled(), true)
  await text(1).fill('  \n ')
  assert.equal(await form(1).getByRole('button', { name: 'Dodaj', exact: true }).isDisabled(), true)
  await text(1).fill('x'.repeat(5000))
  await text(1).press('End'); await text(1).press('x')
  assert.equal((await text(1).inputValue()).length, 5000)
  await text(1).press('Escape'); await waitClosed(1)
  assert.equal(writes.length, 0)
  for (const [apiType, label] of [['NOTE', 'Notatka'], ['SUCCESS', 'Sukces'], ['DIFFICULTY', 'Trudność'], ['INSIGHT', 'Wniosek']]) {
    await plus(1).click(); await type(1, label)
    await text(1).fill('  Pierwszy akapit')
    await text(1).press('Enter'); await text(1).pressSequentially('Drugi akapit  ')
    assert.equal(writes.filter(w => w.method === 'POST').length, nextId - 20)
    await form(1).getByRole('button', { name: 'Dodaj', exact: true }).click(); await waitClosed(1)
    assert.equal(writes.at(-1).body.type, apiType)
    assert.equal(writes.at(-1).body.content, 'Pierwszy akapit\nDrugi akapit')
    assert.equal(await panel(1).locator('.goal-journal-entry').count(), 3)
    assert.equal(await panel(1).getByRole('heading').innerText(), `Dziennik nawyku (${records[1].length})`)
  }
  await page.getByText('Wpis został dodany', { exact: true }).waitFor()
  let latest = records[1][0].id
  await action(1, latest, 'Edytuj')
  const count = writes.length, dates = await panel(1).locator('time').evaluateAll(items => items.map(el => el.dateTime))
  const order = await panel(1).locator('.goal-journal-entry').evaluateAll(items => items.map(el => el.dataset.entryId))
  await form(1).getByRole('button', { name: 'Zapisz', exact: true }).click(); await waitClosed(1)
  assert.equal(writes.length, count)
  for (const change of ['content', 'type', 'both']) {
    await action(1, latest, 'Edytuj')
    if (change !== 'type') await text(1).fill(`Nowa treść ${change}`)
    if (change !== 'content') await type(1, change === 'type' ? 'Sukces' : 'Trudność')
    await form(1).getByRole('button', { name: 'Zapisz', exact: true }).click(); await waitClosed(1)
    assert.equal(writes.at(-1).method, 'PATCH')
    assert.deepEqual(await panel(1).locator('time').evaluateAll(items => items.map(el => el.dateTime)), dates)
    assert.deepEqual(await panel(1).locator('.goal-journal-entry').evaluateAll(items => items.map(el => el.dataset.entryId)), order)
  }
  await action(1, latest, 'Edytuj'); await text(1).fill('Niezapisany szkic')
  await plus(1).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Kontynuuj edycję' }).click()
  assert.equal(await text(1).inputValue(), 'Niezapisany szkic')
  await panel(1).getByRole('button', { name: 'Zamknij dziennik nawyku' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Kontynuuj edycję' }).click()
  await page.locator('.habit-waiting-section > summary').click()
  await open(2)
  await page.getByRole('dialog').getByRole('button', { name: 'Kontynuuj edycję' }).click()
  assert.equal(await panel(2).count(), 0)
  assert.equal(await text(1).inputValue(), 'Niezapisany szkic')
  // A calendar change also protects the draft.
  await page.getByRole('button', { name: 'Poprzedni tydzień', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Kontynuuj edycję' }).click()
  assert.equal(await page.locator('.week-range').innerText(), week)
  await plus(1).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Odrzuć zmiany' }).click()
  assert.equal(await text(1).inputValue(), '')
  for (const status of [500, 409, 403, 404, -1]) {
    failure = status; await text(1).fill(`Zachowaj ${status}`)
    await form(1).getByRole('button', { name: 'Dodaj', exact: true }).click()
    await form(1).getByRole('alert').waitFor()
    assert.equal(await text(1).inputValue(), `Zachowaj ${status}`)
    assert.equal(records[1].length, 12)
  }
  failure = 0
  gate = new Promise(resolve => { release = resolve })
  const beforeSave = writes.length
  await form(1).evaluate(el => { el.requestSubmit(); el.requestSubmit() })
  await page.waitForRequest(req => req.method() === 'POST' && req.url().includes('/entries'))
  assert.equal(await panel(1).getByRole('button', { name: 'Zamknij dziennik nawyku' }).isDisabled(), true)
  release(); gate = null; await waitClosed(1)
  assert.equal(writes.length, beforeSave + 1)
  latest = records[1][0].id
  await action(1, latest, 'Edytuj'); await text(1).fill('Zmiana po błędzie')
  failure = 500
  await form(1).getByRole('button', { name: 'Zapisz', exact: true }).click()
  await form(1).getByRole('alert').waitFor()
  assert.notEqual(records[1][0].content, 'Zmiana po błędzie')
  failure = 0
  await form(1).getByRole('button', { name: 'Zapisz', exact: true }).click(); await waitClosed(1)
  await action(1, latest, 'Usuń')
  await page.getByRole('dialog').getByRole('button', { name: 'Anuluj' }).click()
  await page.waitForFunction(id => document.querySelector(`#habit-journal-1 [data-entry-id="${id}"] .task-menu-trigger`) === document.activeElement, latest)
  assert.equal(await item(1, latest).locator('.task-menu-trigger').evaluate(el => el === document.activeElement), true)
  await action(1, latest, 'Usuń'); failure = 500
  await page.getByRole('dialog').getByRole('button', { name: 'Usuń', exact: true }).click()
  await page.getByRole('dialog').getByRole('alert').waitFor()
  assert.equal(records[1][0].id, latest)
  failure = 0; gate = new Promise(resolve => { release = resolve })
  const beforeDelete = writes.length
  await page.getByRole('dialog').getByRole('button', { name: 'Usuń', exact: true }).evaluate(el => { el.click(); el.click() })
  await page.waitForRequest(req => req.method() === 'DELETE')
  release(); gate = null
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  assert.equal(writes.length, beforeDelete + 1)
  assert.equal(await panel(1).locator('.goal-journal-entry').count(), 3)
  assert.equal(await panel(1).getByRole('heading').innerText(), 'Dziennik nawyku (12)')
  assert.equal(await item(1, latest).count(), 0)
  // A failed refill must keep the successful delete and offer GET retry only.
  latest = records[1][0].id; await action(1, latest, 'Usuń'); refillFails = true
  await page.getByRole('dialog').getByRole('button', { name: 'Usuń', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  await panel(1).getByRole('alert').waitFor()
  assert.equal(await item(1, latest).count(), 0)
  refillFails = false
  await panel(1).getByRole('button', { name: 'Spróbuj ponownie' }).click()
  await panel(1).getByRole('alert').waitFor({ state: 'detached' })
  await panel(1).locator('.goal-journal-entry').nth(2).waitFor()
  assert.equal(await panel(1).locator('.goal-journal-entry').count(), 3)
  for (const id of [2, 3]) {
    await open(id)
    if (id === 3) await panel(id).getByRole('button', { name: '+ Dodaj pierwszy wpis', exact: true }).click()
    else await plus(id).click()
    await text(id).fill(`Nawyk ${id}`)
    await form(id).getByRole('button', { name: 'Dodaj', exact: true }).click(); await waitClosed(id)
    const created = records[id][0].id
    await action(id, created, 'Edytuj'); await text(id).fill('Edytowany')
    await form(id).getByRole('button', { name: 'Zapisz', exact: true }).click(); await waitClosed(id)
    await action(id, created, 'Usuń')
    await page.getByRole('dialog').getByRole('button', { name: 'Usuń', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    if (id === 3) await panel(id).getByText('Brak wpisów w dzienniku', { exact: true }).waitFor()
    assert.equal(writes.at(-1).habitId, id)
  }
  await page.locator('.habit-finished-section:not(.habit-waiting-section) > summary').click()
  await open(4); await item(4, 1).waitFor()
  assert.equal(await plus(4).count(), 0)
  assert.equal(await panel(4).locator('.task-menu-trigger').count(), 0)
  await open(1); await plus(1).click(); await text(1).fill('Tekst '.repeat(500))
  for (const width of [320, 360, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.ok(await form(1).evaluate(el => el.scrollWidth <= el.clientWidth))
    await form(1).getByRole('combobox').click()
    assert.ok(await page.getByRole('listbox').evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth }))
    await page.keyboard.press('Escape')
    if (width === 360) await panel(1).screenshot({ path: '../.local-backups/habit-journal-form.png' })
  }
  await text(1).press('Escape'); await waitClosed(1)
  assert.equal(await card(1).locator('.habit-progress-summary').innerText(), progress)
  assert.equal(await card(1).getByRole('checkbox').isChecked(), false)
  assert.equal(await page.locator('.week-range').innerText(), week)
  await page.getByText('Saldo 100 pkt', { exact: true }).waitFor()
  // Local status actions must not silently discard an open draft.
  await plus(1).click(); await text(1).fill('Szkic przed zakończeniem')
  await card(1).locator('.task-menu-trigger').first().click()
  await page.getByRole('menuitem', { name: 'Zakończ nawyk', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Kontynuuj edycję' }).click()
  assert.equal(await text(1).inputValue(), 'Szkic przed zakończeniem')
  assert.equal(await page.locator('.end-habit-dialog').count(), 0)
  await card(1).locator('.task-menu-trigger').first().click()
  await page.getByRole('menuitem', { name: 'Zakończ nawyk', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Odrzuć zmiany' }).click()
  await page.locator('.end-habit-dialog').getByRole('button', { name: 'Anuluj', exact: true }).click()
  await waitClosed(1)
  // A past-day ACTIVE snapshot must not unlock an actually finished habit.
  // Reload through the week bar to simulate configuration changed in another session.
  habits[0].endDate = '2026-10-31'
  await page.getByRole('button', { name: 'Poprzedni tydzień', exact: true }).click()
  await open(1); await item(1, records[1][0].id).waitFor()
  assert.equal(await plus(1).count(), 0)
  assert.equal(await panel(1).locator('.task-menu-trigger').count(), 0)
  habits[0].endDate = '2099-12-31'
  await page.getByRole('button', { name: 'Następny tydzień', exact: true }).click()
  await open(1); await plus(1).waitFor()
  assert.equal(await panel(1).locator('.task-menu-trigger').count(), 3)
  assert.equal(await panel(1).getByRole('heading').innerText(), `Dziennik nawyku (${records[1].length})`)
  assert.ok(originalHeight > 0)
  assert.deepEqual(errors, [])
  console.log('PASS: habit create all types/validation/errors/dedup, edit/no-op/order, dirty close/switch/week guards, delete/refill/retry/last entry, CRUD active/paused/planned, finished read-only, focus, mobile, no non-journal writes')
} finally { await browser.close() }
