import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.clock.install({ time: new Date('2026-10-30T10:00:00Z') })
  const base = { createdOn: '2026-10-01', startDate: '2026-10-01', endDate: null, endedOn: null, endReason: null,
    status: 'ACTIVE', activityStatus: 'ACTIVE', completed: false, weeklyRewardGranted: false, rewardPoints: 3,
    description: '', completionLimit: null, completionBonusPoints: null, requiredSuccessPercent: null,
    totalCompletions: 42, weeklyCompletedDays: 2, target: { targetDays: 3, effectiveFrom: '2026-10-26' },
    latestTarget: { targetDays: 3, effectiveFrom: '2026-10-26' }, category: null, goalIds: [1, 2, 3], goalTitles: [],
    regularity: null, completionBonusGranted: false, completionBonusEverGranted: false,
    completionBonusConditionsLocked: false, completionBonusTargetLocked: false,
    completionBonusSettledOn: null, completionBonusAwardPoints: null }
  const habits = [
    { ...base, id: 1, name: 'Rehabilitacja' },
    { ...base, id: 2, name: 'Nauka słówek i długa nazwa planowanego nawyku', activityStatus: 'PLANNED', totalCompletions: 0 },
    { ...base, id: 3, name: 'Czytanie', activityStatus: 'PAUSED' },
    { ...base, id: 4, name: 'Wolny zaplanowany', activityStatus: 'PLANNED', goalIds: [] },
    { ...base, id: 5, name: 'Wolny wstrzymany', activityStatus: 'PAUSED', goalIds: [] },
  ]
  const goals = [1, 2, 3].map(id => ({ id, title: `Cel ${id}`, completed: id === 3,
    currentState: '', desiredOutcome: '', completedAt: id === 3 ? '2026-10-29T12:00:00Z' : null }))
  const writes = [], errors = []
  let goalReads = 0, historyReads = 0, habitReads = 0, statusError = false, release = null, holdStatus = false
  page.on('pageerror', error => errors.push(error.message))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname
    if (req.method() !== 'GET') writes.push({ path, method: req.method(), body: req.postData() ? req.postDataJSON() : null })
    let body = []
    if (path.endsWith('/status-history')) historyReads++
    if (path === '/api/users/me') body = { id: 1, login: 'test', points: 100, theme: 'PURPLE' }
    else if (path === '/api/auth/csrf') body = { headerName: 'X-CSRF-TOKEN', token: 'test' }
    else if (path === '/api/tasks/overview') body = { tasks: [], completedCount: 0 }
    else if (path === '/api/goals') { goalReads++; body = goals }
    else if (path === '/api/habits') {
      if (req.method() === 'GET') { habitReads++; body = habits }
      else {
        const data = req.postDataJSON()
        body = { ...base, ...data, id: 6, totalCompletions: 0, weeklyCompletedDays: 0,
          target: { ...base.target, targetDays: data.targetDays }, latestTarget: { ...base.latestTarget, targetDays: data.targetDays } }
        assert.equal(data.activityStatus, 'PLANNED'); assert.deepEqual(data.goalIds, [1])
        habits.push(body)
        return route.fulfill({ status: 201, json: body })
      }
    }
    else if (/^\/api\/habits\/\d+\/status$/.test(path)) {
      if (statusError) return route.fulfill({ status: 409, json: { detail: 'Nie udało się zapisać statusu.' } })
      if (holdStatus) await new Promise(resolve => { release = resolve })
      const habit = habits.find(item => item.id === Number(path.split('/')[3]))
      habit.activityStatus = req.postDataJSON().status
      body = habit
    }
    else if (/^\/api\/habits\/\d+\/configuration$/.test(path)) {
      const habit = habits.find(item => item.id === Number(path.split('/')[3]))
      assert.equal(req.postDataJSON().activityStatus, undefined)
      Object.assign(habit, req.postDataJSON())
      body = { habit, balance: null, award: null }
    }
    else if (/^\/api\/goals\/\d+\/habits$/.test(path)) body = habits.filter(h => h.goalIds.includes(Number(path.split('/')[3]))).map(h => ({ id: h.id, name: h.name }))
    else if (/^\/api\/goals\/\d+\/habits\/available$/.test(path)) body = { habits: habits.filter(h => !h.goalIds.includes(Number(path.split('/')[3]))).map(h => ({ id: h.id, name: h.name })), hasMore: false }
    else if (/^\/api\/goals\/\d+\/habits\/\d+$/.test(path)) {
      const goalId = Number(path.split('/')[3]), habit = habits.find(h => h.id === Number(path.split('/')[5]))
      habit.goalIds = habit.goalIds.filter(id => id !== goalId)
      if (req.method() === 'PUT') habit.goalIds.push(goalId)
      return route.fulfill({ status: 204 })
    }
    else if (/^\/api\/goals\/\d+\/completion$/.test(path)) {
      body = goals.find(goal => goal.id === Number(path.split('/')[3])); body.completed = req.postDataJSON().completed
    }
    await route.fulfill({ json: body })
  })
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5197')
  const nav = page.getByRole('navigation', { name: 'Widoki aplikacji' })
  const goalHabits = id => page.locator(`#goal-habits-${id}`)
  const row = (id, name) => goalHabits(id).locator('.goal-linked-habit').filter({ has: page.getByText(name, { exact: true }) })
  async function openGoal(id) {
    await nav.getByRole('button', { name: 'Cele', exact: true }).click()
    await page.getByRole('button', { name: `Cel ${id}`, exact: true }).click()
    await page.locator(`#goal-tab-habits-${id}`).click()
    await row(id, 'Rehabilitacja').waitFor()
  }
  async function menu(target, action) {
    await target.locator('.task-menu-trigger').click()
    await target.getByRole('menuitem', { name: action, exact: true }).click()
  }
  await openGoal(1)
  assert.match(await page.locator('#goal-tab-habits-1').innerText(), /3/)
  assert.deepEqual(await goalHabits(1).locator('.goal-linked-item-title').allTextContents(), habits.slice(0, 3).map(h => h.name))
  await row(1, habits[1].name).getByText('Zaplanowany', { exact: true }).waitFor()
  assert.equal(await row(1, habits[1].name).locator('.goal-linked-habit-progress').count(), 0)
  assert.equal(await row(1, 'Czytanie').getByText('Wstrzymany', { exact: true }).count(), 1)
  assert.equal(await goalHabits(1).getByRole('checkbox').count(), 0)
  assert.equal(await row(1, 'Rehabilitacja').getByText('3 pkt', { exact: true }).count(), 1)
  for (const width of [320, 360, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.ok(await goalHabits(1).evaluate(el => el.scrollWidth <= el.clientWidth))
    if (width === 360) await goalHabits(1).screenshot({ path: '../.local-backups/goal-habit-statuses.png' })
  }
  const beforeGoals = goalReads, beforeHabits = habitReads
  holdStatus = true
  await menu(row(1, 'Rehabilitacja'), 'Wstrzymaj nawyk')
  assert.equal(await row(1, 'Rehabilitacja').locator('.task-menu-trigger').isDisabled(), true)
  const deadline = Date.now() + 5000
  while (!release && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10))
  assert.ok(release); release(); holdStatus = false
  await row(1, 'Rehabilitacja').getByText('Wstrzymany', { exact: true }).waitFor()
  await page.waitForFunction(() => document.activeElement?.closest('[data-habit-id="1"]') !== null)
  assert.deepEqual(habits[0].goalIds, [1, 2, 3]); assert.equal(habits[0].totalCompletions, 42)
  assert.equal(goalReads, beforeGoals); assert.equal(habitReads, beforeHabits)
  await openGoal(2)
  await row(2, 'Rehabilitacja').getByText('Wstrzymany', { exact: true }).waitFor()
  statusError = true; await menu(row(2, 'Rehabilitacja'), 'Wznów nawyk')
  await goalHabits(2).getByRole('alert').waitFor(); assert.equal(habits[0].activityStatus, 'PAUSED')
  statusError = false; await menu(row(2, 'Rehabilitacja'), 'Wznów nawyk')
  await goalHabits(2).getByText('Nawyk został wznowiony', { exact: true }).waitFor()
  await menu(row(2, habits[1].name), 'Rozpocznij nawyk')
  await goalHabits(2).getByText('Nawyk został rozpoczęty', { exact: true }).waitFor()
  assert.equal(habits[1].activityStatus, 'ACTIVE')
  await nav.getByRole('button', { name: 'Nawyki', exact: true }).click()
  await page.locator('#habit-panel-active').getByText('Rehabilitacja', { exact: true }).waitFor()
  const mainCard = page.locator('#habit-panel-active .habit-card').filter({ has: page.getByText('Rehabilitacja', { exact: true }) })
  await menu(mainCard, 'Wstrzymaj nawyk')
  await page.getByText('Nawyk został wstrzymany', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Poprzedni tydzień', exact: true }).click()
  await openGoal(1)
  await row(1, 'Rehabilitacja').getByText('Wstrzymany', { exact: true }).waitFor()
  // Unpin changes only this relation; the same paused record remains in other goals.
  await menu(row(1, 'Rehabilitacja'), 'Odepnij od celu')
  await row(1, 'Rehabilitacja').waitFor({ state: 'hidden' })
  assert.deepEqual(habits[0].goalIds, [2, 3]); assert.equal(habits[0].activityStatus, 'PAUSED')
  const add = () => page.getByRole('button', { name: 'Dodaj nawyk do celu', exact: true })
  await add().click(); await page.getByRole('menuitem', { name: /Przypnij istniejące/ }).click()
  const picker = page.getByRole('dialog', { name: 'Przypnij nawyki', exact: true })
  await picker.getByRole('button', { name: 'Przypnij nawyk: Wolny zaplanowany', exact: true }).click()
  await picker.getByText('Przypięto: Wolny zaplanowany', { exact: true }).waitFor()
  await picker.getByRole('button', { name: 'Przypnij nawyk: Wolny wstrzymany', exact: true }).click()
  await picker.getByText('Przypięto: Wolny wstrzymany', { exact: true }).waitFor()
  await picker.getByRole('button', { name: 'Gotowe', exact: true }).click()
  assert.equal(habits[3].activityStatus, 'PLANNED'); assert.equal(habits[4].activityStatus, 'PAUSED')
  await row(1, 'Wolny zaplanowany').getByText('Zaplanowany', { exact: true }).waitFor()
  await add().click(); await page.getByRole('menuitem', { name: /Utwórz nowy nawyk/ }).click()
  const form = page.locator('dialog.habit-form-dialog')
  await form.getByRole('textbox', { name: /^Nazwa nawyku/ }).fill('Z celu do Poczekalni')
  await form.getByRole('radio', { name: 'Dodaj do Poczekalni', exact: true }).check()
  await form.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await form.waitFor({ state: 'hidden' })
  await row(1, 'Z celu do Poczekalni').getByText('Zaplanowany', { exact: true }).waitFor()
  await menu(row(1, 'Z celu do Poczekalni'), 'Edytuj')
  await form.getByRole('textbox', { name: /^Nazwa nawyku/ }).fill('Poprawiona nazwa')
  await form.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await form.waitFor({ state: 'hidden' }); assert.equal(habits[5].activityStatus, 'PLANNED')
  await row(1, 'Poprawiona nazwa').waitFor()
  await nav.getByRole('button', { name: 'Nawyki', exact: true }).click()
  await page.locator('.habit-waiting-section > summary').click()
  await page.locator('#habit-panel-waiting').getByText('Poprawiona nazwa', { exact: true }).waitFor()
  await nav.getByRole('button', { name: 'Cele', exact: true }).click()
  await page.getByRole('button', { name: /Osiągnięte \(/ }).click()
  await openGoal(3)
  assert.equal(await goalHabits(3).locator('.goal-linked-habit').count(), 3)
  assert.equal(await goalHabits(3).locator('.task-menu').count(), 0)
  assert.equal(await goalHabits(3).getByRole('checkbox').count(), 0)
  assert.equal(await page.locator('#goal-card-3').getByRole('button', { name: 'Dodaj nawyk do celu', exact: true }).count(), 0)
  const headerMenu = page.locator('#goal-card-3').locator('.task-menu-trigger').first()
  await headerMenu.click(); await page.getByRole('menuitem', { name: 'Wznów cel', exact: true }).click()
  await page.getByText('Cel został ponownie otwarty.', { exact: true }).waitFor()
  await openGoal(3)
  await row(3, 'Rehabilitacja').locator('.task-menu-trigger').waitFor()
  assert.equal(habits[0].activityStatus, 'PAUSED')
  assert.equal(historyReads, 0)
  assert.deepEqual(errors, [])
  console.log('PASS: goal status groups/counts, shared actions/cache, multi-goal sync, planned creation/edit, attaching/unpinning, achieved read-only/reopen, mobile/desktop')
} finally { await browser.close() }
