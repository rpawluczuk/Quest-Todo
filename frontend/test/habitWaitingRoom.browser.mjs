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
  let source = all, reads = 0, writes = 0, fail = false, points = 100
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname
    if (req.method() !== 'GET') writes++
    if (path === '/api/habits') {
      assert.equal(url.searchParams.get('includeInactive'), 'true')
      reads++
      return route.fulfill({ status: fail ? 503 : 200, json: fail ? {} : source })
    }
    if (path.includes('/completions/')) {
      assert.equal(Number(path.split('/')[3]), 1)
      const habit = all[0], completed = req.method() === 'PUT'
      habit.completed = completed; habit.weeklyCompletedDays = completed ? 3 : 2
      habit.totalCompletions = completed ? 3 : 2
      habit.weeklyRewardGranted = true; points = 103
      return route.fulfill({ json: { habit, balance: points,
        award: completed ? { id: 'award', points: 3,
          undoUntil: await page.evaluate(() => new Date(Date.now() + 8000).toISOString()) } : null } })
    }
    return route.fulfill({ json: path === '/api/users/me' ? { id: 1, login: 'test', points, theme: 'PURPLE' }
      : path === '/api/tasks/overview' ? { tasks: [], completedCount: 0 }
      : path === '/api/auth/csrf' ? { headerName: 'X-CSRF-TOKEN', token: 'test' } : [] })
  })
  async function open() {
    await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5197')
    await page.getByRole('button', { name: 'Nawyki', exact: true }).click()
  }
  const active = page.locator('#habit-tab-active'), waiting = page.locator('#habit-tab-waiting')
  const activePanel = page.locator('#habit-panel-active'), waitingPanel = page.locator('#habit-panel-waiting')
  const week = page.getByRole('group', { name: 'Przegląd tygodni' })
  await open()
  await activePanel.getByText('Czytanie', { exact: true }).waitFor()
  assert.equal(await active.getAttribute('aria-selected'), 'true')
  assert.match(await active.innerText(), /Aktywne\s*3/)
  assert.match(await waiting.innerText(), /Poczekalnia\s*4/)
  assert.equal(await activePanel.locator('.habit-card').count(), 3)
  assert.equal(await activePanel.getByText(all[3].name).count(), 0)
  assert.equal(await activePanel.getByText(all[5].name).count(), 0)
  await page.getByRole('button', { name: 'Poprzedni tydzień', exact: true }).click()
  await activePanel.getByText('Czytanie', { exact: true }).waitFor()
  const previousRange = await page.locator('.week-range').innerText()
  const previousDay = await week.locator('[aria-pressed="true"]').getAttribute('aria-label')
  const beforeTabs = reads
  await waiting.click()
  assert.equal(await week.isVisible(), false)
  assert.equal(await activePanel.isVisible(), false)
  assert.equal(await waitingPanel.locator('.habit-waiting-card').count(), 4)
  assert.deepEqual(await waitingPanel.locator('h3').allTextContents(), ['Wstrzymane', 'Zaplanowane'])
  assert.deepEqual(await waitingPanel.locator('.habit-waiting-title').allTextContents(), all.slice(3).map(h => h.name))
  assert.equal(await waitingPanel.getByRole('checkbox').count(), 0)
  assert.equal(await waitingPanel.getByRole('button', { name: /Rozpocznij nawyk/ }).count(), 2)
  assert.equal(await waitingPanel.getByRole('button', { name: /Wznów nawyk/ }).count(), 2)
  assert.equal(await waitingPanel.locator('.habit-progress-summary,.task-points,.habit-completion-bonus').count(), 0)
  await waiting.focus(); await page.keyboard.press('ArrowLeft')
  assert.equal(await active.getAttribute('aria-selected'), 'true')
  assert.equal(await week.isVisible(), true)
  assert.equal(await page.locator('.week-range').innerText(), previousRange)
  assert.equal(await week.locator('[aria-pressed="true"]').getAttribute('aria-label'), previousDay)
  await page.keyboard.press('End')
  assert.equal(await waiting.getAttribute('aria-selected'), 'true')
  assert.equal(reads, beforeTabs)
  for (const width of [320, 360, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.ok(await waitingPanel.locator('.habit-waiting-title').first().evaluate(el => el.scrollWidth <= el.clientWidth))
    const boxes = await page.getByRole('tab').evaluateAll(tabs => tabs.map(tab => tab.getBoundingClientRect().height))
    assert.ok(boxes.every(height => height >= 40))
  }
  await page.setViewportSize({ width: 360, height: 844 })
  await waitingPanel.screenshot({ path: '../.local-backups/habit-waiting-room.png' })
  await active.click()
  await page.getByRole('button', { name: 'Następny tydzień', exact: true }).click()
  await activePanel.getByText('Czytanie', { exact: true }).waitFor()
  const check = activePanel.getByRole('checkbox', { name: /^Czytanie —/ })
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1000)))
  await check.check()
  await page.getByText('Saldo 103 pkt', { exact: true }).waitFor()
  await page.getByText(/Cel tygodniowy osiągnięty! Czytanie/).waitFor()
  assert.equal(writes, 1)
  await check.uncheck()
  assert.equal(writes, 2)
  assert.equal(points, 103)

  source = [all[3]]
  await open()
  await page.getByText('Nie masz aktywnych nawyków', { exact: true }).waitFor()
  await waiting.click()
  assert.deepEqual(await waitingPanel.locator('h3').allTextContents(), ['Wstrzymane'])
  assert.match(await waiting.innerText(), /1/)
  source = [all[0]]
  await open()
  await activePanel.getByText('Czytanie', { exact: true }).waitFor()
  await waiting.click()
  await page.getByText('Poczekalnia jest pusta', { exact: true }).waitFor()
  assert.equal(await waitingPanel.locator('h3').count(), 0)
  source = []
  await open()
  await page.getByText('Nie masz jeszcze nawyków. Dodaj pierwszy i zacznij budować regularność!', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Dodaj nawyk', exact: true }).click()
  await page.getByRole('dialog').waitFor()
  await page.getByRole('dialog').getByRole('textbox', { name: /^Nazwa nawyku/ }).waitFor({ state: 'visible' })
  assert.equal(await page.getByRole('dialog').getByText('PLANNED', { exact: true }).count(), 0)
  await page.getByRole('button', { name: 'Anuluj', exact: true }).click()
  fail = true
  await open()
  await page.getByRole('alert').filter({ hasText: 'Nie udało się pobrać nawyków' }).waitFor()
  assert.equal(await page.getByText('Poczekalnia jest pusta', { exact: true }).isVisible(), false)
  assert.deepEqual(errors, [])
  console.log('PASS: habit tabs, status grouping/counts, week retention, empty/error states, no tab requests, completion awards, mobile')
} finally { await browser.close() }
