import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const goals = [1, 2, 3].map(id => ({ id, title: `Cel ${id}`, currentState: '', desiredOutcome: '', completed: id === 3 }))
  const entry = id => ({ id, type: 'NOTE', content: `Historia ${id}`, createdAt: '2026-10-29T12:00:00Z', updatedAt: '2026-10-29T12:00:00Z' })
  const entries = { 1: [entry(3), entry(2), entry(1)], 2: [], 3: [] }
  const posts = [], errors = []
  let failStatus = 0, offline = false, release, gate
  page.on('pageerror', error => errors.push(error.message))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (path === '/api/auth/csrf') return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'test' } })
    const journal = path.match(/^\/api\/goals\/(\d+)\/entries$/)
    if (journal) {
      const id = Number(journal[1])
      if (req.method() === 'GET') return route.fulfill({ json: {
        entries: entries[id].slice(0, 3), totalElements: entries[id].length, hasMore: entries[id].length > 3,
      } })
      assert.equal(req.method(), 'POST')
      const body = req.postDataJSON(); posts.push({ id, body })
      assert.deepEqual(Object.keys(body).sort(), ['content', 'type'])
      assert.equal(req.headers()['x-csrf-token'], 'test')
      if (gate) await gate
      if (offline) return route.abort('internetdisconnected')
      if (failStatus) return route.fulfill({ status: failStatus, json: { detail: failStatus === 409
        ? 'Osiągnięty cel jest dostępny tylko do odczytu. Wznów cel, aby go zmieniać.' : 'Nieprawidłowa treść wpisu.' } })
      const added = { ...entry(100 + posts.length), ...body, createdAt: '2026-10-31T12:00:00Z' }
      entries[id].unshift(added)
      return route.fulfill({ status: 201, json: added })
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
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5197')
  await page.getByRole('navigation', { name: 'Widoki aplikacji' }).getByRole('button', { name: 'Cele', exact: true }).click()
  const card = id => page.locator(`#goal-card-${id}`)
  const journal = id => card(id).locator('.goal-journal')
  const plus = id => journal(id).getByRole('button', { name: 'Dodaj wpis do dziennika', exact: true })
  const form = id => journal(id).getByRole('form')
  const text = id => form(id).getByRole('textbox', { name: /Treść/ })
  const save = id => form(id).getByRole('button', { name: 'Dodaj', exact: true })
  const toggle = id => journal(id).getByRole('button', { name: /^Dziennik celu/ })
  async function openGoal(id) { await page.getByRole('button', { name: `Cel ${id}`, exact: true }).click() }
  await openGoal(1)
  await plus(1).click()
  await text(1).waitFor()
  assert.equal(await toggle(1).getAttribute('aria-expanded'), 'true')
  assert.equal(await text(1).evaluate(el => el === document.activeElement), true)
  assert.equal(await form(1).getByRole('combobox').innerText(), 'Notatka')
  assert.equal(await save(1).isDisabled(), true)
  await text(1).fill('   \n  '); assert.equal(await save(1).isDisabled(), true)
  assert.equal(await text(1).getAttribute('maxlength'), '5000')
  await text(1).fill('Akapit pierwszy'); await page.keyboard.press('Enter'); await page.keyboard.type('Drugi akapit')
  assert.equal(await text(1).inputValue(), 'Akapit pierwszy\nDrugi akapit'); assert.equal(posts.length, 0)
  await plus(1).click(); assert.equal(await form(1).count(), 1)
  assert.equal(await text(1).inputValue(), 'Akapit pierwszy\nDrugi akapit')
  await toggle(1).click(); await plus(1).click()
  assert.equal(await text(1).evaluate(el => el === document.activeElement), true)
  assert.equal(await text(1).inputValue(), 'Akapit pierwszy\nDrugi akapit')
  await form(1).getByRole('combobox').click(); await page.getByRole('option', { name: 'Sukces', exact: true }).click()
  await form(1).getByRole('combobox').click(); await page.keyboard.press('Escape')
  assert.equal(await form(1).isVisible(), true)
  await text(1).focus(); await page.keyboard.press('Escape')
  assert.equal(await form(1).count(), 0); assert.equal(await toggle(1).getAttribute('aria-expanded'), 'true')
  assert.equal(await plus(1).evaluate(el => el === document.activeElement), true)
  assert.equal(posts.length, 0)
  await page.locator('#goal-tab-tasks-1').click()
  for (const [type, label] of [['NOTE', 'Notatka'], ['SUCCESS', 'Sukces'], ['DIFFICULTY', 'Trudność'], ['INSIGHT', 'Wniosek']]) {
    await plus(1).click()
    await text(1).fill(`  ${label}\nDrugi akapit  `)
    await form(1).getByRole('combobox').click(); await page.getByRole('option', { name: label, exact: true }).click()
    if (type === 'NOTE') {
      gate = new Promise(done => { release = done })
      await save(1).click()
      await page.waitForFunction(() => document.querySelector('.goal-entry-create-form')?.getAttribute('aria-busy') === 'true')
      assert.equal(await form(1).getByRole('button', { name: 'Dodawanie…' }).isDisabled(), true)
      await page.keyboard.press('Control+Enter')
      release(); gate = undefined
    } else await save(1).click()
    await form(1).waitFor({ state: 'detached' })
    assert.deepEqual(posts.at(-1).body, { type, content: `${label}\nDrugi akapit` })
    assert.equal(posts.length, ['NOTE', 'SUCCESS', 'DIFFICULTY', 'INSIGHT'].indexOf(type) + 1)
    assert.equal(await journal(1).locator('.goal-journal-entry').count(), 3)
    assert.equal(await journal(1).locator('.goal-journal-entry').first().getByText(`${label}\nDrugi akapit`, { exact: true }).isVisible(), true)
    assert.equal(await toggle(1).innerText(), `Dziennik celu (${3 + posts.length})`)
    assert.equal(await page.locator('#goal-tab-tasks-1').getAttribute('aria-selected'), 'true')
    assert.equal(await plus(1).evaluate(el => el === document.activeElement), true)
  }
  await page.getByRole('status').filter({ hasText: 'Wpis został dodany' }).waitFor()
  await toggle(1).click(); await toggle(1).click()
  assert.equal(await toggle(1).innerText(), 'Dziennik celu (7)')
  await plus(1).click()
  await text(1).fill('Treść po błędzie')
  await form(1).getByRole('combobox').click(); await page.getByRole('option', { name: 'Trudność', exact: true }).click()
  for (const status of [400, 409, 0]) {
    failStatus = status; offline = status === 0
    await save(1).click(); await form(1).getByRole('alert').waitFor()
    assert.equal(await text(1).inputValue(), 'Treść po błędzie')
    assert.equal(await form(1).getByRole('combobox').innerText(), 'Trudność')
    assert.equal(await save(1).isEnabled(), true)
    assert.equal(await toggle(1).innerText(), 'Dziennik celu (7)')
  }
  offline = false; failStatus = 0
  for (const width of [320, 360, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    await text(1).fill('Długi tekst '.repeat(600))
    assert.equal((await text(1).inputValue()).length, 5000)
    assert.ok(await text(1).evaluate(el => el.clientHeight <= 240))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.ok(await form(1).evaluate(el => el.scrollWidth <= el.clientWidth))
    assert.ok(await form(1).locator('.milestone-inline-actions').evaluate(el => {
      const actions = [...el.querySelectorAll('button')]
      return getComputedStyle(el).justifyContent === 'flex-end'
        && actions.every(button => button.getBoundingClientRect().height >= 40)
    }))
    await form(1).getByRole('combobox').click()
    assert.ok(await page.getByRole('listbox').evaluate(el => el.getBoundingClientRect().right <= innerWidth))
    await page.keyboard.press('Escape')
    if (width === 360) await journal(1).screenshot({ path: '../.local-backups/goal-journal-create.png' })
  }
  await form(1).getByRole('button', { name: 'Anuluj' }).click()
  await openGoal(2); await toggle(2).click()
  await journal(2).getByRole('button', { name: '+ Dodaj pierwszy wpis', exact: true }).click()
  await text(2).fill('Pierwszy wpis'); await page.keyboard.press('Control+Enter')
  await form(2).waitFor({ state: 'detached' })
  assert.equal(await journal(2).getByText('Brak wpisów w dzienniku', { exact: true }).count(), 0)
  assert.equal(await toggle(2).innerText(), 'Dziennik celu (1)')
  assert.equal(posts.at(-1).id, 2)
  await page.getByRole('button', { name: /Osiągnięte \(/ }).click()
  await openGoal(3); await toggle(3).click()
  assert.equal(await plus(3).count(), 0)
  assert.equal(await journal(3).getByRole('button', { name: '+ Dodaj pierwszy wpis', exact: true }).count(), 0)
  assert.equal(await form(3).count(), 0)
  await card(3).locator('.task-menu-trigger').click()
  await page.getByRole('menuitem', { name: 'Wznów cel', exact: true }).click()
  await openGoal(3)
  await plus(3).click(); await text(3).waitFor()
  assert.equal(await save(3).isDisabled(), true)
  await text(3).fill('Sesja wygasła'); failStatus = 401
  await save(3).click()
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).waitFor()
  assert.deepEqual(errors, [])
  console.log('PASS: journal creation all types, trim/paragraphs, keyboard, cancel/focus, duplicate guard, count/cache/limit, API errors/offline, first entry, achieved read-only, mobile/desktop')
} finally { await browser.close() }
