// Run against the local Vite server; uses the existing workspace Playwright installation.
import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.clock.install({ time: new Date('2026-10-30T10:00:00Z') })
  const base = { createdOn: '2026-10-01', startDate: '2026-10-01', endDate: null, endedOn: null, endReason: null,
    status: 'ACTIVE', activityStatus: 'ACTIVE', completed: false, weeklyRewardGranted: false, rewardPoints: 3,
    description: null, completionLimit: null, completionBonusPoints: null, requiredSuccessPercent: null,
    totalCompletions: 2, weeklyCompletedDays: 2, target: { targetDays: 3, effectiveFrom: '2026-09-28' },
    latestTarget: { targetDays: 3, effectiveFrom: '2026-09-28' }, category: null, goalIds: [], goalTitles: [],
    regularity: null, completionBonusGranted: false, completionBonusEverGranted: false,
    completionBonusConditionsLocked: false, completionBonusTargetLocked: false,
    completionBonusSettledOn: null, completionBonusAwardPoints: null }
  const all = [
    { ...base, id: 1, name: 'Czytanie' },
    { ...base, id: 2, name: 'Trening zakończony', status: 'FINISHED', endedOn: '2026-10-20', endReason: 'ACHIEVED' },
    { ...base, id: 3, name: 'Aktywny z przyszłą datą', status: 'UPCOMING', startDate: '2026-11-01' },
    { ...base, id: 4, name: 'Poranne ćwiczenia na proste plecy i bardzo długa nazwa nawyku', activityStatus: 'PAUSED', totalCompletions: 42 },
    { ...base, id: 5, name: 'Drugi wstrzymany', activityStatus: 'PAUSED', status: 'FINISHED' },
    { ...base, id: 6, name: 'Nauka słówek', activityStatus: 'PLANNED', totalCompletions: 0, weeklyCompletedDays: 0 },
    { ...base, id: 7, name: 'Czytanie książki przez 20 minut', activityStatus: 'PLANNED', startDate: '2027-01-01', status: 'UPCOMING' },
  ]
  all[0].totalCompletions = 42; all[0].completionLimit = 150; all[0].completionBonusPoints = 30
  let points = 100, reads = 0, errorStatus = 0, networkFailure = false
  const requests = [], errors = [], statusGates = new Map()
  let holdNextRead = false, readGate = null, readStarted = null
  function deferred() { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
  page.on('pageerror', error => errors.push(error.message))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname
    if (path === '/api/habits') {
      reads++
      const captured = structuredClone(all)
      if (holdNextRead) { holdNextRead = false; readStarted.resolve(); await readGate.promise }
      return route.fulfill({ json: captured })
    }
    if (/^\/api\/habits\/\d+\/status$/.test(path)) {
      const id = Number(path.split('/')[3]), body = req.postDataJSON()
      assert.equal(req.method(), 'PATCH'); assert.deepEqual(Object.keys(body), ['status'])
      requests.push({ id, ...body })
      if (statusGates.has(id)) await statusGates.get(id).promise
      if (networkFailure) return route.abort('failed')
      if (errorStatus) return route.fulfill({ status: errorStatus, json: { detail: 'Nie udało się zapisać statusu.' } })
      const habit = all.find(h => h.id === id)
      habit.activityStatus = body.status
      // The status endpoint reports today; its counters must not replace a selected past week's counters.
      return route.fulfill({ json: { ...habit, completed: true, weeklyCompletedDays: 7 } })
    }
    if (path.includes('/completions/')) {
      const id = Number(path.split('/')[3]), habit = all.find(h => h.id === id)
      assert.equal(habit.activityStatus, 'ACTIVE')
      habit.completed = req.method() === 'PUT'
      habit.totalCompletions += habit.completed ? 1 : -1
      habit.weeklyCompletedDays += habit.completed ? 1 : -1
      return route.fulfill({ json: { habit, balance: null, award: null } })
    }
    return route.fulfill({ json: path === '/api/users/me' ? { id: 1, login: 'test', points, theme: 'PURPLE' }
      : path === '/api/tasks/overview' ? { tasks: [], completedCount: 0 }
      : path === '/api/auth/csrf' ? { headerName: 'X-CSRF-TOKEN', token: 'test' } : [] })
  })
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5197')
  await page.getByRole('button', { name: 'Nawyki', exact: true }).click()
  const active = page.locator('#habit-tab-active'), waiting = page.locator('#habit-tab-waiting')
  const activePanel = page.locator('#habit-panel-active'), waitingPanel = page.locator('#habit-panel-waiting')
  const card = id => activePanel.locator('.habit-card').filter({ has: page.locator('.task-title', { hasText: all.find(h => h.id === id).name }) })
  const pausedCard = id => waitingPanel.locator('.habit-waiting-card').filter({ has: page.getByText(all.find(h => h.id === id).name, { exact: true }) })
  async function pause(id) {
    await card(id).locator('.task-menu-trigger').click()
    await page.getByRole('menuitem', { name: 'Wstrzymaj nawyk', exact: true }).click()
  }
  await card(1).waitFor()
  await card(1).locator('.task-menu-trigger').click()
  assert.equal(await page.getByRole('menuitem', { name: 'Edytuj', exact: true }).count(), 1)
  await page.getByRole('menuitem', { name: 'Wstrzymaj nawyk', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Nawyk został wstrzymany' }).waitFor()
  assert.equal(await active.getAttribute('aria-selected'), 'true')
  assert.equal(await card(1).count(), 0)
  assert.match(await active.innerText(), /2/); assert.match(await waiting.innerText(), /5/)
  await waiting.click()
  await pausedCard(1).getByText('Wstrzymany', { exact: true }).waitFor()
  assert.equal(await waitingPanel.getByRole('checkbox').count(), 0)
  assert.equal(await waitingPanel.getByRole('menuitem').count(), 0)
  assert.equal(await pausedCard(6).getByRole('button').count(), 0)
  await pausedCard(1).getByRole('button', { name: /Wznów nawyk/ }).click()
  await page.getByRole('status').filter({ hasText: 'Nawyk został wznowiony' }).waitFor()
  assert.equal(await waiting.getAttribute('aria-selected'), 'true')
  assert.equal(await pausedCard(1).count(), 0)
  assert.match(await active.innerText(), /3/); assert.match(await waiting.innerText(), /4/)
  await active.click()
  await card(1).getByText('42/150 wykonań', { exact: true }).waitFor()
  assert.match(await card(1).locator('.habit-progress-summary').innerText(), /2\/3/)
  assert.equal(await card(1).getByRole('checkbox').isChecked(), false)
  assert.equal(points, 100)
  assert.deepEqual(requests, [{ id: 1, status: 'PAUSED' }, { id: 1, status: 'ACTIVE' }])

  // Two independent operations: only the saving habit is locked; no optimistic movement.
  statusGates.set(1, deferred())
  await pause(1)
  await card(1).getByText('Wstrzymywanie…', { exact: true }).waitFor()
  assert.equal(await card(1).getByRole('checkbox').isDisabled(), true)
  assert.equal(await card(3).locator('.task-menu-trigger').isDisabled(), false)
  assert.equal(await active.getAttribute('aria-selected'), 'true')
  const beforeDoubleClick = requests.length
  await card(1).locator('.task-menu-trigger').evaluate(el => { el.click(); el.click() })
  assert.equal(requests.length, beforeDoubleClick)
  await pause(3)
  await page.getByRole('status').filter({ hasText: 'Nawyk został wstrzymany' }).waitFor()
  // Change the selected week while the first status request is still running.
  await page.getByRole('button', { name: 'Poprzedni tydzień', exact: true }).click()
  await card(1).waitFor()
  const previousRange = await page.locator('.week-range').innerText()
  statusGates.get(1).resolve(); statusGates.delete(1)
  await card(1).waitFor({ state: 'detached' })
  await waiting.click()
  await pausedCard(1).getByRole('button', { name: /Wznów nawyk/ }).click()
  await pausedCard(1).waitFor({ state: 'detached' })
  await active.click()
  assert.equal(await page.locator('.week-range').innerText(), previousRange)
  await card(1).getByText('42/150 wykonań', { exact: true }).waitFor()
  assert.match(await card(1).locator('.habit-progress-summary').innerText(), /2\/3/)

  // An earlier polling response arriving after the PATCH must not resurrect the active row.
  readGate = deferred(); readStarted = deferred(); holdNextRead = true
  await page.clock.runFor(60_000); await readStarted.promise
  await pause(1)
  await card(1).waitFor({ state: 'detached' })
  const readFinished = page.waitForResponse(response => new URL(response.url()).pathname === '/api/habits')
  readGate.resolve(); await readFinished; await page.clock.runFor(50)
  assert.equal(await card(1).count(), 0)
  await waiting.click()
  await pausedCard(1).waitFor()
  assert.equal(await waiting.getAttribute('aria-selected'), 'true')

  for (const status of [503, 409, 404]) {
    errorStatus = status
    await pausedCard(1).getByRole('button', { name: /Wznów nawyk/ }).click()
    await page.getByRole('alert').filter({ hasText: status === 404 ? 'Nawyk nie istnieje' : 'Nie udało się zapisać statusu' }).waitFor()
    assert.equal(await pausedCard(1).getByRole('button').isEnabled(), true)
    assert.equal(all[0].activityStatus, 'PAUSED')
  }
  errorStatus = 0; networkFailure = true
  await pausedCard(1).getByRole('button', { name: /Wznów nawyk/ }).click()
  await page.getByRole('alert').filter({ hasText: 'Sprawdź połączenie' }).waitFor()
  networkFailure = false
  statusGates.set(1, deferred())
  const resume = pausedCard(1).getByRole('button', { name: /Wznów nawyk/ })
  await resume.click()
  await page.getByText('Wznawianie…', { exact: true }).waitFor()
  const beforeRetry = requests.length
  await resume.evaluate(el => { el.click(); el.click() })
  assert.equal(requests.length, beforeRetry)
  statusGates.get(1).resolve(); statusGates.delete(1)
  await pausedCard(1).waitFor({ state: 'detached' })
  assert.equal(await waiting.getAttribute('aria-selected'), 'true')
  assert.equal(points, 100)

  for (const width of [320, 360, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.ok(await pausedCard(4).getByRole('button').evaluate(el => el.getBoundingClientRect().height >= 40))
  }
  await page.setViewportSize({ width: 360, height: 844 })
  await waitingPanel.screenshot({ path: '../.local-backups/habit-resume.png' })
  await active.click()
  // Finish pausing all remaining activity-status ACTIVE rows, including the collapsed finished group.
  await pause(1)
  await activePanel.locator('.habit-finished-section > summary').click()
  await pause(2)
  await page.getByText('Nie masz aktywnych nawyków', { exact: true }).waitFor()
  assert.equal(await active.getAttribute('aria-selected'), 'true')
  assert.match(await active.innerText(), /0/)
  await waiting.click()
  await pausedCard(1).getByRole('button').click()
  await pausedCard(1).waitFor({ state: 'detached' })
  await active.click()
  await card(1).getByRole('checkbox').check()
  await card(1).getByText('43/150 wykonań', { exact: true }).waitFor()
  assert.equal(points, 100)
  // Existing session-expiry handling remains in force for status requests.
  errorStatus = 401
  await pause(1)
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).waitFor()
  assert.deepEqual(errors, [])
  console.log('PASS: pause/resume API, counters, saved-only moves, per-habit locks, stale reads/day changes, errors/session expiry, history/points, mobile')
} finally { await browser.close() }
