// Run against the local Vite server with the workspace Playwright installation.
import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.clock.install({ time: new Date('2026-10-30T10:00:00Z') })
  const base = { createdOn: '2026-10-30', startDate: '2026-10-30', endDate: null, endedOn: null,
    endReason: null, status: 'ACTIVE', activityStatus: 'ACTIVE', completed: false, weeklyRewardGranted: false,
    rewardPoints: 1, description: '', completionLimit: null, completionBonusPoints: null,
    requiredSuccessPercent: null, totalCompletions: 0, weeklyCompletedDays: 0,
    target: { targetDays: 7, effectiveFrom: '2026-10-26' }, latestTarget: { targetDays: 7, effectiveFrom: '2026-10-26' },
    category: null, goalIds: [], goalTitles: [], regularity: null, completionBonusGranted: false,
    completionBonusEverGranted: false, completionBonusConditionsLocked: false, completionBonusTargetLocked: false,
    completionBonusSettledOn: null, completionBonusAwardPoints: null }
  const all = [{ ...base, id: 1, name: 'Istniejący' }, { ...base, id: 2, name: 'Wstrzymany', activityStatus: 'PAUSED' }]
  const requests = [], errors = []
  let failCreate = false, failStart = false, releaseStart = null
  page.on('pageerror', error => errors.push(error.message))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (path === '/api/habits') {
      if (req.method() === 'GET') return route.fulfill({ json: all })
      const body = req.postDataJSON(); requests.push({ kind: 'create', body })
      assert.ok(['ACTIVE', 'PLANNED'].includes(body.activityStatus))
      assert.equal(body.status, undefined)
      if (failCreate) return route.fulfill({ status: 503, json: { detail: 'Spróbuj ponownie.' } })
      const habit = { ...base, ...body, id: all.length + 1,
        target: { ...base.target, targetDays: body.targetDays }, latestTarget: { ...base.latestTarget, targetDays: body.targetDays } }
      all.push(habit)
      return route.fulfill({ status: 201, json: habit })
    }
    if (/^\/api\/habits\/\d+\/configuration$/.test(path)) {
      const habit = all.find(h => h.id === Number(path.split('/')[3])), body = req.postDataJSON()
      assert.equal(body.activityStatus, undefined); assert.equal(body.status, undefined)
      Object.assign(habit, body)
      requests.push({ kind: 'edit', body })
      return route.fulfill({ json: { habit, balance: null, award: null } })
    }
    if (/^\/api\/habits\/\d+\/status$/.test(path)) {
      const habit = all.find(h => h.id === Number(path.split('/')[3])), body = req.postDataJSON()
      assert.equal(req.method(), 'PATCH'); assert.deepEqual(body, { status: 'ACTIVE' })
      requests.push({ kind: 'start', id: habit.id })
      if (failStart) return route.fulfill({ status: 409, json: { detail: 'Nie udało się rozpocząć nawyku.' } })
      await new Promise(resolve => { releaseStart = resolve })
      habit.activityStatus = 'ACTIVE'
      return route.fulfill({ json: habit })
    }
    if (path.includes('/completions/')) {
      const habit = all.find(h => h.id === Number(path.split('/')[3]))
      assert.equal(habit.activityStatus, 'ACTIVE')
      habit.completed = true; habit.totalCompletions++; habit.weeklyCompletedDays++
      requests.push({ kind: 'completion' })
      return route.fulfill({ json: { habit, balance: null, award: null } })
    }
    return route.fulfill({ json: path === '/api/users/me' ? { id: 1, login: 'test', points: 0, theme: 'PURPLE' }
      : path === '/api/tasks/overview' ? { tasks: [], completedCount: 0 }
      : path === '/api/goals' ? [{ id: 11, title: 'Zdrowie', completed: false }]
      : path === '/api/auth/csrf' ? { headerName: 'X-CSRF-TOKEN', token: 'test' } : [] })
  })
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5197')
  await page.getByRole('button', { name: 'Nawyki', exact: true }).click()
  const active = page.locator('#habit-tab-active'), waiting = page.locator('#habit-tab-waiting')
  const activePanel = page.locator('#habit-panel-active'), waitingPanel = page.locator('#habit-panel-waiting')
  const form = page.locator('dialog.habit-form-dialog')
  const open = () => page.getByRole('button', { name: 'Dodaj nawyk', exact: true }).click()
  const name = () => form.getByRole('textbox', { name: /^Nazwa nawyku/ })
  const save = () => form.getByRole('button', { name: 'Zapisz', exact: true }).click()
  const card = text => waitingPanel.locator('.habit-waiting-card').filter({ has: page.getByText(text, { exact: true }) })
  await activePanel.getByText('Istniejący', { exact: true }).waitFor()
  await open()
  assert.equal(await form.getByRole('radio', { name: 'Rozpocznij teraz', exact: true }).isChecked(), true)
  await save(); assert.equal(requests.length, 0) // Native required validation.
  await name().fill('Nowy aktywny'); await save()
  await form.waitFor({ state: 'hidden' })
  await page.getByText('Nawyk został utworzony', { exact: true }).waitFor()
  assert.equal(await active.getAttribute('aria-selected'), 'true')
  await activePanel.getByText('Nowy aktywny', { exact: true }).waitFor()
  await open(); await name().fill('Zaplanowane czytanie książki przez dwadzieścia minut')
  await form.getByRole('radio', { name: 'Dodaj do Poczekalni', exact: true }).check()
  await form.locator('.goal-multiselect-trigger').click()
  await page.getByRole('checkbox', { name: 'Zdrowie', exact: true }).check()
  await page.keyboard.press('Escape')
  await form.locator('summary').click()
  await form.getByRole('textbox', { name: 'Notatki', exact: true }).fill('Zachowaj notatkę')
  await form.getByRole('combobox', { name: /Sposób zakończenia/ }).click()
  await page.getByRole('option', { name: 'Po określonej liczbie wykonań', exact: true }).click()
  await form.getByRole('spinbutton', { name: /^Docelowa liczba/ }).fill('150')
  await form.getByRole('spinbutton', { name: 'Premia za ukończenie w punktach', exact: true }).fill('15')
  for (const width of [320, 360, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    assert.ok(await form.evaluate(el => el.scrollWidth <= el.clientWidth))
    assert.ok(await form.getByRole('radio').first().evaluate(el => el.parentElement.getBoundingClientRect().height >= 40))
    if (width === 360) await form.locator('.habit-start-options').screenshot({ path: '../.local-backups/habit-planned-form.png' })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  failCreate = true; await save()
  await form.getByRole('alert').filter({ hasText: 'Spróbuj ponownie.' }).waitFor()
  assert.equal(await name().inputValue(), 'Zaplanowane czytanie książki przez dwadzieścia minut')
  assert.equal(await form.getByRole('radio', { name: 'Dodaj do Poczekalni', exact: true }).isChecked(), true)
  failCreate = false; await save(); await form.waitFor({ state: 'hidden' })
  await page.getByText('Nawyk został dodany do Poczekalni', { exact: true }).waitFor()
  assert.equal(await active.getAttribute('aria-selected'), 'true')
  assert.equal(all[3].activityStatus, 'PLANNED'); assert.deepEqual(all[3].goalIds, [11])
  assert.equal(all[3].completionBonusPoints, 15); assert.equal(all[3].completionLimit, 150)
  assert.equal(all[3].description, 'Zachowaj notatkę')
  await waiting.click()
  assert.match(await waiting.innerText(), /2/)
  const plannedName = all[3].name
  await card(plannedName).locator('.task-menu-trigger').click()
  await page.getByRole('menuitem', { name: 'Edytuj', exact: true }).click()
  assert.equal(await form.getByRole('radio').count(), 0)
  assert.equal(await name().inputValue(), plannedName)
  await name().fill('Poprawiony zaplanowany nawyk'); await save(); await form.waitFor({ state: 'hidden' })
  assert.equal(all[3].activityStatus, 'PLANNED'); assert.deepEqual(all[3].goalIds, [11])
  assert.equal(all[3].completionBonusPoints, 15)
  const plannedCard = card(all[3].name)
  assert.equal(await card('Wstrzymany').getByRole('button', { name: /Rozpocznij nawyk/ }).count(), 0)
  assert.equal(await card('Wstrzymany').getByRole('button', { name: /Wznów nawyk/ }).count(), 1)
  for (const width of [320, 360, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.ok(await plannedCard.evaluate(el => el.scrollWidth <= el.clientWidth))
    if (width === 360) await waitingPanel.screenshot({ path: '../.local-backups/habit-planned-card.png' })
  }
  const start = () => plannedCard.getByRole('button', { name: /Rozpocznij nawyk/ })
  failStart = true; await start().click()
  await page.getByRole('alert').filter({ hasText: 'Nie udało się rozpocząć' }).waitFor()
  assert.equal(all[3].activityStatus, 'PLANNED')
  failStart = false; await start().click()
  await start().waitFor({ state: 'visible' }); assert.equal(await start().isDisabled(), true)
  await plannedCard.evaluate(el => el.querySelector('.habit-resume-action').click())
  assert.equal(requests.filter(r => r.kind === 'start').length, 2) // One failed, one pending; no duplicate.
  const deadline = Date.now() + 5000
  while (!releaseStart && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10))
  assert.ok(releaseStart, 'Start request reached the API')
  releaseStart()
  await page.getByText('Nawyk został rozpoczęty', { exact: true }).waitFor()
  assert.equal(await waiting.getAttribute('aria-selected'), 'true')
  assert.match(await waiting.innerText(), /1/); assert.match(await active.innerText(), /3/)
  assert.equal(await plannedCard.count(), 0)
  await active.click()
  await activePanel.getByRole('checkbox', { name: /^Poprawiony zaplanowany nawyk —/ }).check()
  assert.equal(all[3].totalCompletions, 1); assert.deepEqual(all[3].goalIds, [11])
  await waiting.click(); await open()
  assert.equal(await form.getByRole('radio', { name: 'Dodaj do Poczekalni', exact: true }).isChecked(), true)
  await name().fill('Z Poczekalni'); await save(); await form.waitFor({ state: 'hidden' })
  await card('Z Poczekalni').waitFor(); assert.equal(await waiting.getAttribute('aria-selected'), 'true')
  assert.deepEqual(errors, [])
  console.log('PASS: ACTIVE/PLANNED creation, defaults, validation/retry, configuration/goals, planned edit/start, duplicate guard, first completion, mobile/desktop')
} finally { await browser.close() }
