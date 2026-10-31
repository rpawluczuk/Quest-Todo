import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const goals = [1, 2, 3].map(id => ({ id, title: `Cel ${id}`, currentState: '', desiredOutcome: '', completed: id === 3 }))
  const entry = (id, type = 'NOTE') => ({ id, type, content: `Treść ${id}\nDrugi akapit`,
    createdAt: `2026-10-${String(id + 10).padStart(2, '0')}T12:00:00Z`, updatedAt: '2026-10-25T12:00:00Z' })
  const records = { 1: [entry(8, 'SUCCESS'), entry(7, 'DIFFICULTY'), entry(6, 'INSIGHT'), entry(5), entry(4), entry(3), entry(2), entry(1)],
    2: [entry(1)], 3: [entry(1)] }
  const writes = [], reads = [], errors = []
  let failure = 0, gate, release, refillFails = false
  page.on('pageerror', error => errors.push(error.message))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (path === '/api/auth/csrf') return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'test' } })
    const match = path.match(/^\/api\/goals\/(\d+)\/entries(?:\/(\d+))?$/)
    if (match) {
      const goalId = Number(match[1]), id = Number(match[2])
      if (req.method() === 'GET') {
        reads.push(goalId)
        if (refillFails) return route.fulfill({ status: 503, json: { detail: 'Nie udało się odświeżyć dziennika.' } })
        return route.fulfill({ json: { entries: records[goalId].slice(0, 3), totalElements: records[goalId].length, hasMore: records[goalId].length > 3 } })
      }
      const method = req.method(), body = method === 'DELETE' ? undefined : req.postDataJSON()
      writes.push({ method, goalId, id, body })
      assert.equal(req.headers()['x-csrf-token'], 'test')
      if (body) assert.deepEqual(Object.keys(body).sort(), ['content', 'type'])
      if (gate) await gate
      if (failure === -1) return route.abort('internetdisconnected')
      if (failure) return route.fulfill({ status: failure, json: { detail: failure === 409
        ? 'Osiągnięty cel jest dostępny tylko do odczytu. Wznów cel, aby go zmieniać.' : 'Nie udało się zapisać wpisu.' } })
      if (method === 'PATCH') {
        const updated = { ...records[goalId].find(item => item.id === id), ...body, updatedAt: '2026-10-31T12:00:00Z' }
        records[goalId] = records[goalId].map(item => item.id === id ? updated : item)
        return route.fulfill({ json: updated })
      }
      if (method === 'DELETE') {
        records[goalId] = records[goalId].filter(item => item.id !== id)
        return route.fulfill({ status: 204 })
      }
      assert.equal(method, 'POST')
      const created = { ...entry(9), ...body }
      records[goalId].unshift(created)
      return route.fulfill({ status: 201, json: created })
    }
    const completion = path.match(/^\/api\/goals\/(\d+)\/completion$/)
    if (completion) {
      const goal = goals.find(item => item.id === Number(completion[1]))
      goal.completed = req.postDataJSON().completed
      return route.fulfill({ json: goal })
    }
    return route.fulfill({ json: path === '/api/goals' ? goals
      : path === '/api/users/me' ? { id: 1, login: 'test', points: 0, theme: 'PURPLE' }
      : path === '/api/tasks/overview' ? { tasks: [], completedCount: 0 } : [] })
  })
  const card = id => page.locator(`#goal-card-${id}`)
  const journal = id => card(id).locator('.goal-journal')
  const item = (goal, id) => journal(goal).locator(`[data-entry-id="${id}"]`)
  const form = goal => journal(goal).getByRole('form')
  const text = goal => form(goal).getByRole('textbox', { name: /Treść/ })
  const toggle = goal => journal(goal).getByRole('button', { name: /^Dziennik celu/ })
  const plus = goal => journal(goal).getByRole('button', { name: 'Dodaj wpis do dziennika', exact: true })
  async function openGoal(goal) {
    await page.getByRole('button', { name: `Cel ${goal}`, exact: true }).click()
    await toggle(goal).click()
    await journal(goal).locator('.goal-journal-entry').first().waitFor()
  }
  async function action(goal, id, name) {
    await item(goal, id).locator('.task-menu-trigger').click()
    await page.getByRole('menuitem', { name, exact: true }).click()
  }
  async function edit(goal, id) { await action(goal, id, 'Edytuj'); await text(goal).waitFor() }
  async function choose(goal, name) {
    await form(goal).getByRole('combobox').click(); await page.getByRole('option', { name, exact: true }).click()
  }
  const save = goal => form(goal).getByRole('button', { name: 'Zapisz', exact: true })
  const cancel = goal => form(goal).getByRole('button', { name: 'Anuluj', exact: true })
  const dialog = () => page.getByRole('dialog')
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5197')
  await page.getByRole('navigation', { name: 'Widoki aplikacji' }).getByRole('button', { name: 'Cele', exact: true }).click()
  await openGoal(1)
  assert.equal(await journal(1).locator('.task-menu-trigger').count(), 3)
  const originalDates = await journal(1).locator('time').evaluateAll(nodes => nodes.map(node => node.dateTime))
  await edit(1, 8)
  assert.equal(await text(1).inputValue(), 'Treść 8\nDrugi akapit')
  assert.equal(await form(1).getByRole('combobox').innerText(), 'Sukces')
  assert.equal(await text(1).evaluate(el => el === document.activeElement), true)
  await save(1).click(); await form(1).waitFor({ state: 'detached' })
  assert.equal(writes.length, 0)
  assert.equal(await item(1, 8).locator('.task-menu-trigger').evaluate(el => el === document.activeElement), true)
  for (const [id, label, content] of [[8, null, '  Nowa treść\nDwa akapity  '], [7, 'Wniosek', null], [6, 'Notatka', 'Nowy wniosek'], [6, 'Trudność', 'Jeszcze inna treść']]) {
    await edit(1, id)
    if (content !== null) await text(1).fill(content)
    if (label) await choose(1, label)
    if (id === 8) {
      gate = new Promise(done => { release = done })
      await save(1).click()
      await page.waitForFunction(() => document.querySelector('.goal-entry-create-form')?.getAttribute('aria-busy') === 'true')
      assert.equal(await form(1).getByRole('button', { name: 'Zapisywanie…' }).isDisabled(), true)
      await page.keyboard.press('Control+Enter')
      release(); gate = undefined
    } else await save(1).click()
    await form(1).waitFor({ state: 'detached' })
    assert.equal(await toggle(1).innerText(), 'Dziennik celu (8)')
    assert.deepEqual(await journal(1).locator('.goal-journal-entry').evaluateAll(nodes => nodes.map(node => Number(node.dataset.entryId))), [8, 7, 6])
    assert.deepEqual(await journal(1).locator('time').evaluateAll(nodes => nodes.map(node => node.dateTime)), originalDates)
  }
  assert.equal(writes.length, 4)
  assert.equal(writes[0].body.content, 'Nowa treść\nDwa akapity')
  assert.equal(reads.length, 1)
  await edit(1, 8)
  await text(1).fill('   \n'); assert.equal(await save(1).isDisabled(), true)
  await text(1).fill('Szkic po błędzie'); await choose(1, 'Sukces')
  for (const status of [400, 409, 404, -1]) {
    failure = status
    await save(1).click(); await form(1).getByRole('alert').waitFor()
    assert.equal(await text(1).inputValue(), 'Szkic po błędzie')
    assert.equal(await form(1).getByRole('combobox').innerText(), 'Sukces')
    assert.equal(await save(1).isEnabled(), true)
    assert.equal(await toggle(1).innerText(), 'Dziennik celu (8)')
  }
  failure = 0
  await action(1, 7, 'Edytuj')
  await dialog().getByRole('button', { name: 'Kontynuuj edycję' }).click()
  assert.equal(await text(1).inputValue(), 'Szkic po błędzie')
  await action(1, 7, 'Edytuj')
  await dialog().getByRole('button', { name: 'Odrzuć zmiany' }).click()
  assert.equal(await text(1).inputValue(), records[1][1].content)
  assert.equal(await text(1).evaluate(el => el === document.activeElement), true)
  await plus(1).click()
  assert.equal(await form(1).getAttribute('aria-label'), 'Dodawanie wpisu do dziennika')
  await text(1).fill('Niezapisany nowy wpis')
  await action(1, 8, 'Edytuj')
  await dialog().getByRole('button', { name: 'Kontynuuj edycję' }).click()
  assert.equal(await text(1).inputValue(), 'Niezapisany nowy wpis')
  await action(1, 8, 'Edytuj')
  await dialog().getByRole('button', { name: 'Odrzuć zmiany' }).click()
  assert.equal(await text(1).inputValue(), records[1][0].content)
  await text(1).fill('Niezapisana edycja'); await plus(1).click()
  await dialog().getByRole('button', { name: 'Kontynuuj edycję' }).click()
  assert.equal(await text(1).inputValue(), 'Niezapisana edycja')
  await form(1).getByRole('combobox').click(); await page.keyboard.press('Escape')
  assert.equal(await form(1).count(), 1)
  await text(1).focus(); await page.keyboard.press('Escape')
  assert.equal(await form(1).count(), 0)
  await edit(1, 8)
  for (const width of [320, 360, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    await text(1).fill('BardzoDługiTekstBezSpacji'.repeat(300))
    assert.equal((await text(1).inputValue()).length, 5000)
    assert.ok(await text(1).evaluate(el => el.clientHeight <= 240))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.ok(await journal(1).evaluate(el => el.scrollWidth <= el.clientWidth))
    await choose(1, 'Sukces')
    if (width === 360) await journal(1).screenshot({ path: '../.local-backups/goal-journal-edit.png' })
  }
  await cancel(1).click()
  await action(1, 8, 'Usuń')
  assert.equal(await dialog().getByRole('heading').innerText(), 'Usunąć wpis z dziennika?')
  const countBeforeDelete = writes.length
  await dialog().getByRole('button', { name: 'Anuluj', exact: true }).click()
  assert.equal(writes.length, countBeforeDelete)
  await action(1, 8, 'Usuń')
  for (const status of [409, -1]) {
    failure = status
    await dialog().getByRole('button', { name: 'Usuń', exact: true }).click()
    await dialog().getByRole('alert').waitFor()
    assert.equal(await item(1, 8).isVisible(), true)
    assert.equal(await toggle(1).innerText(), 'Dziennik celu (8)')
  }
  failure = 0
  gate = new Promise(done => { release = done })
  await dialog().getByRole('button', { name: 'Usuń', exact: true }).click()
  await dialog().getByRole('button', { name: 'Usuwanie…' }).waitFor()
  assert.equal(await dialog().getByRole('button', { name: 'Usuwanie…' }).isDisabled(), true)
  release(); gate = undefined
  await dialog().waitFor({ state: 'detached' })
  assert.deepEqual(await journal(1).locator('.goal-journal-entry').evaluateAll(nodes => nodes.map(node => Number(node.dataset.entryId))), [7, 6, 5])
  assert.equal(await toggle(1).innerText(), 'Dziennik celu (7)')
  assert.equal(reads.length, 2)
  await action(1, 7, 'Usuń'); refillFails = true
  await dialog().getByRole('button', { name: 'Usuń', exact: true }).click()
  await dialog().waitFor({ state: 'detached' })
  await journal(1).getByRole('alert').waitFor()
  assert.equal(await toggle(1).innerText(), 'Dziennik celu (6)')
  refillFails = false
  const writesBeforeRetry = writes.length
  await journal(1).getByRole('button', { name: 'Spróbuj ponownie' }).click()
  await item(1, 4).waitFor()
  assert.equal(writes.length, writesBeforeRetry)
  // Complete a request after changing goals: only the original cache changes, with no foreign toast.
  await edit(1, 6); await text(1).fill('Zmiana w tle')
  gate = new Promise(done => { release = done })
  await save(1).click()
  await openGoal(2)
  release(); gate = undefined
  await page.waitForResponse(response => response.request().method() === 'PATCH')
  assert.equal(await toggle(2).innerText(), 'Dziennik celu (1)')
  assert.equal(await journal(2).getByText('Zmiana w tle', { exact: true }).count(), 0)
  assert.equal(await page.getByRole('status').filter({ hasText: 'Wpis został zaktualizowany' }).count(), 0)
  // Last record deletion restores the original empty state and first-entry action.
  await action(2, 1, 'Usuń')
  await dialog().getByRole('button', { name: 'Usuń', exact: true }).click()
  await dialog().waitFor({ state: 'detached' })
  await journal(2).getByText('Brak wpisów w dzienniku', { exact: true }).waitFor()
  assert.equal(await toggle(2).innerText(), 'Dziennik celu (0)')
  assert.equal(await journal(2).getByRole('button', { name: '+ Dodaj pierwszy wpis', exact: true }).isVisible(), true)
  await page.getByRole('button', { name: /Osiągnięte \(/ }).click()
  await openGoal(3)
  assert.equal(await journal(3).locator('.task-menu-trigger').count(), 0)
  assert.equal(await plus(3).count(), 0)
  await card(3).locator('.goal-header-actions .task-menu-trigger').click()
  await page.getByRole('menuitem', { name: 'Wznów cel', exact: true }).click()
  await openGoal(3)
  assert.equal(await journal(3).locator('.task-menu-trigger').count(), 1)
  await edit(3, 1); await cancel(3).click()
  assert.deepEqual(errors, [])
  console.log('PASS: journal edit/no-op/order/dates, PATCH errors, dirty form transitions, keyboard/focus, DELETE confirmation/errors/refill/last entry, concurrent goal switch, read-only/resume, mobile/desktop')
} finally { await browser.close() }
