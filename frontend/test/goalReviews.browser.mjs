import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

// API responses are deterministic: deadlines deliberately differ from the browser's current date.
const frequencies = [
  ['WEEKLY', 'Co tydzień', '2027-02-06', '6 lutego 2027'],
  ['BIWEEKLY', 'Co 2 tygodnie', '2027-02-13', '13 lutego 2027'],
  ['MONTHLY', 'Co miesiąc', '2027-03-01', '1 marca 2027'],
  ['QUARTERLY', 'Co 3 miesiące', '2027-05-01', '1 maja 2027'],
]
const nextDate = frequency => frequencies.find(([value]) => value === frequency)?.[2] ?? null
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Los_Angeles' })
  const goals = [
    { id: 1, title: 'Cel miesięczny', reviewFrequency: 'MONTHLY', nextReviewDate: '2026-12-17' },
    { id: 2, title: 'Cel bez przeglądów', reviewFrequency: null, nextReviewDate: null },
    { id: 3, title: 'Cel osiągnięty', reviewFrequency: 'BIWEEKLY', nextReviewDate: null, completed: true },
  ].map(goal => ({ currentState: 'Początek', desiredOutcome: 'Rezultat', completed: false,
    completedAt: null, reviewDue: false, ...goal }))
  const requests = [], writes = [], errors = []
  let failStatus = 0, offline = false, release, gate
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error' && message.text().includes('React.Fragment')) errors.push(message.text())
  })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), path = new URL(req.url()).pathname, method = req.method()
    if (path === '/api/auth/csrf') return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'test' } })
    requests.push({ path, method })
    if (method !== 'GET') {
      const body = req.postDataJSON()
      writes.push({ path, method, body })
      if (gate) await gate
      if (offline) return route.abort('failed')
      if (failStatus) return route.fulfill({ status: failStatus, json: { detail: `Błąd zapisu ${failStatus}` } })
      if (path === '/api/goals' && method === 'POST') {
        const goal = { id: goals.length + 1, completed: false, completedAt: null, reviewDue: false,
          ...body, nextReviewDate: nextDate(body.reviewFrequency) }
        goals.push(goal)
        return route.fulfill({ status: 201, json: goal })
      }
      const goalPath = path.match(/^\/api\/goals\/(\d+)(\/completion)?$/)
      assert.ok(goalPath, `Unexpected mutation: ${method} ${path}`)
      const goal = goals.find(item => item.id === Number(goalPath[1]))
      if (goalPath[2]) {
        goal.completed = body.completed
        goal.completedAt = body.completed ? '2026-11-17T12:00:00Z' : null
        goal.nextReviewDate = body.completed ? null : nextDate(goal.reviewFrequency)
      } else {
        if (Object.hasOwn(body, 'reviewFrequency') && body.reviewFrequency !== goal.reviewFrequency) {
          goal.nextReviewDate = nextDate(body.reviewFrequency)
        }
        Object.assign(goal, body)
      }
      return route.fulfill({ json: goal })
    }
    return route.fulfill({ json: path === '/api/goals' ? goals
      : path === '/api/users/me' ? { id: 1, login: 'test', points: 37, theme: 'PURPLE' }
      : path === '/api/tasks/overview' ? { tasks: [], completedCount: 0 }
      : /\/entries$/.test(path) ? { entries: [], totalElements: 0, hasMore: false } : [] })
  })
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5197')
  await page.getByRole('navigation', { name: 'Widoki aplikacji' }).getByRole('button', { name: 'Cele', exact: true }).click()
  const card = id => page.locator(`#goal-card-${id}`)
  const create = () => page.locator('.goal-create-form')
  const edit = () => page.locator('.goal-edit-form')
  const enabled = form => form.getByRole('checkbox', { name: 'Włącz regularne przeglądy' })
  const select = form => form.getByRole('combobox', { name: 'Jak często chcesz przeglądać cel?' })
  async function choose(form, label) {
    await select(form).click()
    await page.getByRole('option', { name: label, exact: true }).click()
  }
  async function action(id, name) {
    await card(id).locator('.goal-header-actions .task-menu-trigger').click()
    await page.getByRole('menuitem', { name, exact: true }).click()
  }
  async function openCreate() {
    await page.getByRole('button', { name: 'Dodaj cel', exact: true }).click()
    await create().getByRole('textbox', { name: /Tytuł celu/ }).fill('Nowy cel')
    await create().getByRole('button', { name: /Dodaj szczegóły celu/ }).click()
  }
  async function saveEdit() {
    await edit().getByRole('button', { name: 'Zapisz', exact: true }).click()
    await edit().waitFor({ state: 'detached' })
  }
  async function cancelEdit() {
    await edit().getByRole('button', { name: 'Anuluj', exact: true }).click()
    await edit().waitFor({ state: 'detached' })
  }
  function assertWrite(body, frequency) {
    assert.equal(body.reviewFrequency, frequency)
    assert.equal(Object.hasOwn(body, 'nextReviewDate'), false)
    assert.equal(Object.hasOwn(body, 'reviewDue'), false)
  }

  // Creating without reviews sends explicit null and adds no journal entry.
  await openCreate()
  assert.equal(await enabled(create()).isChecked(), false)
  assert.equal(await select(create()).count(), 0)
  await create().getByRole('button', { name: 'Dodaj cel', exact: true }).click()
  await create().waitFor({ state: 'detached' })
  assertWrite(writes.at(-1).body, null)
  assert.equal(goals.at(-1).nextReviewDate, null)
  const initialGoalReads = requests.filter(req => req.path === '/api/goals' && req.method === 'GET').length

  // All frequencies, first-enable default, response synchronization and create-state reset.
  for (const [frequency, label, date, formatted] of frequencies) {
    await openCreate()
    assert.equal(await enabled(create()).isChecked(), false)
    await enabled(create()).focus(); await page.keyboard.press('Space')
    assert.equal(await enabled(create()).evaluate(el => el === document.activeElement), true)
    assert.equal(await select(create()).innerText(), 'Co miesiąc')
    await choose(create(), label)
    await create().getByRole('button', { name: 'Dodaj cel', exact: true }).click()
    await create().waitFor({ state: 'detached' })
    assertWrite(writes.at(-1).body, frequency)
    assert.equal(goals.at(-1).nextReviewDate, date)
    await action(goals.at(-1).id, 'Edytuj')
    assert.equal(await enabled(edit()).isChecked(), true)
    assert.equal(await select(edit()).innerText(), label)
    assert.equal(await edit().locator('time').innerText(), formatted)
    await cancelEdit()
  }

  // Existing schedule, cancel, unchanged frequency, renaming and tab/expansion retention.
  await card(1).getByRole('button', { name: 'Cel miesięczny', exact: true }).click()
  await page.locator('#goal-tab-tasks-1').click()
  const baseline = writes.length
  await action(1, 'Edytuj')
  assert.equal(await edit().locator('time').innerText(), '17 grudnia 2026')
  await choose(edit(), 'Co tydzień')
  assert.equal(await edit().locator('time').count(), 0)
  assert.equal(await edit().getByText('Nowy termin zostanie wyznaczony po zapisaniu zmian.').isVisible(), true)
  await cancelEdit()
  assert.equal(writes.length, baseline)
  await action(1, 'Edytuj')
  assert.equal(await select(edit()).innerText(), 'Co miesiąc')
  await edit().getByRole('textbox', { name: /Tytuł celu/ }).fill('Nowa nazwa')
  await saveEdit()
  assert.equal(Object.hasOwn(writes.at(-1).body, 'reviewFrequency'), false)
  assert.equal(goals[0].nextReviewDate, '2026-12-17')
  assert.equal(await page.locator('#goal-tab-tasks-1').getAttribute('aria-selected'), 'true')
  assert.equal(await card(1).locator('.goal-details-toggle').getAttribute('aria-expanded'), 'true')
  await action(1, 'Edytuj'); await saveEdit()
  assert.equal(Object.hasOwn(writes.at(-1).body, 'reviewFrequency'), false)
  assert.equal(goals[0].nextReviewDate, '2026-12-17')

  await action(1, 'Edytuj'); await choose(edit(), 'Co tydzień')
  // Single in-flight submission, controls disabled during save.
  gate = new Promise(done => { release = done })
  await edit().getByRole('button', { name: 'Zapisz', exact: true }).click()
  await edit().getByRole('button', { name: 'Zapisywanie…' }).waitFor()
  assert.equal(await enabled(edit()).isDisabled(), true)
  assert.equal(await select(edit()).isDisabled(), true)
  release(); gate = undefined
  await edit().waitFor({ state: 'detached' })
  assertWrite(writes.at(-1).body, 'WEEKLY')
  await action(1, 'Edytuj')
  assert.equal(await select(edit()).innerText(), 'Co tydzień')
  assert.equal(await edit().locator('time').innerText(), '6 lutego 2027')
  await enabled(edit()).uncheck()
  assert.equal(await select(edit()).count(), 0)
  assert.equal(await edit().locator('time').count(), 0)
  await saveEdit(); assertWrite(writes.at(-1).body, null)
  await action(1, 'Edytuj')
  assert.equal(await enabled(edit()).isChecked(), false)
  await enabled(edit()).check()
  assert.equal(await select(edit()).innerText(), 'Co miesiąc')
  assert.equal(await edit().locator('time').count(), 0)
  await saveEdit(); assertWrite(writes.at(-1).body, 'MONTHLY')
  await action(1, 'Edytuj')
  assert.equal(await edit().locator('time').innerText(), '1 marca 2027')
  await cancelEdit()

  // API validation, permission, deleted/completed goal and network errors retain the draft.
  await action(1, 'Edytuj'); await choose(edit(), 'Co 3 miesiące')
  for (const status of [400, 403, 404, 409, 0]) {
    failStatus = status; offline = status === 0
    await edit().getByRole('button', { name: 'Zapisz', exact: true }).click()
    await page.getByRole('alert').waitFor()
    assert.equal(await select(edit()).innerText(), 'Co 3 miesiące')
    assert.equal(await edit().locator('time').count(), 0)
    assert.equal(await edit().getByRole('button', { name: 'Zapisz', exact: true }).isEnabled(), true)
    assert.equal(goals[0].reviewFrequency, 'MONTHLY')
    assert.equal(goals[0].nextReviewDate, '2027-03-01')
  }
  offline = false; failStatus = 0
  await saveEdit()
  assert.equal(goals[0].reviewFrequency, 'QUARTERLY')

  // Creating also retains the draft after failure; cancelling resets it.
  await openCreate(); await enabled(create()).check(); await choose(create(), 'Co 2 tygodnie')
  failStatus = 400
  await create().getByRole('button', { name: 'Dodaj cel', exact: true }).click()
  await page.getByRole('alert').waitFor()
  assert.equal(await select(create()).innerText(), 'Co 2 tygodnie')
  assert.equal(await create().getByRole('textbox', { name: /Tytuł celu/ }).inputValue(), 'Nowy cel')
  failStatus = 0
  await create().getByRole('button', { name: 'Anuluj' }).click()

  // Completed goals retain configuration and expose no edit action until reopened.
  await page.getByRole('button', { name: /Osiągnięte \(/ }).click()
  await card(3).locator('.goal-header-actions .task-menu-trigger').click()
  assert.equal(await page.getByRole('menuitem', { name: 'Edytuj', exact: true }).count(), 0)
  await page.getByRole('menuitem', { name: 'Wznów cel', exact: true }).click()
  await card(3).getByRole('button', { name: 'Cel osiągnięty', exact: true }).waitFor()
  await action(3, 'Edytuj')
  assert.equal(await select(edit()).innerText(), 'Co 2 tygodnie')
  assert.equal(await edit().locator('time').innerText(), '13 lutego 2027')
  await cancelEdit()

  // Keyboard interaction, readable dates and wrapping on small screens and desktop.
  await page.getByRole('status').filter({ hasText: 'Cel został ponownie otwarty.' }).waitFor({ state: 'detached' })
  for (const width of [320, 360, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    await openCreate()
    await enabled(create()).focus(); await page.keyboard.press('Space')
    await page.keyboard.press('Tab')
    assert.equal(await select(create()).evaluate(el => el === document.activeElement), true)
    await page.keyboard.press('Space')
    await page.getByRole('listbox').waitFor()
    assert.ok(await page.getByRole('listbox').evaluate(el => el.getBoundingClientRect().right <= innerWidth))
    await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'option')
    await page.keyboard.press('End')
    await page.waitForFunction(() => document.activeElement?.textContent?.includes('Co 3 miesiące'))
    await page.keyboard.press('Enter')
    assert.equal(await select(create()).innerText(), 'Co 3 miesiące')
    assert.equal(await select(create()).evaluate(el => el === document.activeElement), true)
    assert.ok(await create().evaluate(el => el.scrollWidth <= el.clientWidth))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    if (width === 390) await create().screenshot({ path: '../.local-backups/goal-reviews-create.png' })
    await create().getByRole('button', { name: 'Anuluj' }).click()
    await action(1, 'Edytuj')
    assert.ok(await edit().evaluate(el => el.scrollWidth <= el.clientWidth))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.equal(await edit().locator('time').innerText(), '1 maja 2027')
    if (width === 390) await edit().screenshot({ path: '../.local-backups/goal-reviews-edit.png' })
    await cancelEdit()
  }
  assert.equal(requests.filter(req => req.path === '/api/goals' && req.method === 'GET').length, initialGoalReads)
  assert.equal(writes.some(req => /entries|milestones|tasks|habits|points/.test(req.path)), false)
  assert.equal(goals[1].reviewFrequency, null)
  for (const write of writes) {
    assert.equal(Object.hasOwn(write.body, 'nextReviewDate'), false)
    assert.equal(Object.hasOwn(write.body, 'reviewDue'), false)
  }

  // A malformed server value must require an explicit valid choice, never silently become MONTHLY.
  goals[1].reviewFrequency = 'DAILY'
  await page.reload()
  await page.getByRole('navigation', { name: 'Widoki aplikacji' }).getByRole('button', { name: 'Cele', exact: true }).click()
  await action(2, 'Edytuj')
  assert.equal(await select(edit()).innerText(), 'Wybierz częstotliwość')
  const beforeInvalid = writes.length
  await edit().getByRole('button', { name: 'Zapisz', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Wybierz prawidłową częstotliwość przeglądów.' }).waitFor()
  assert.equal(writes.length, beforeInvalid)
  await choose(edit(), 'Co tydzień'); await saveEdit()
  assertWrite(writes.at(-1).body, 'WEEKLY')
  assert.deepEqual(errors, [])
  console.log('PASS: create all frequencies/default/null, edit/cancel/disable/reenable, unchanged schedule, response dates, tab/expansion/cache, errors/retry, completed/resumed, keyboard and 320/360/390/1280 layouts')
} finally { await browser.close() }
