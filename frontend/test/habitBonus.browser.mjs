// Run against a local Vite server; reuses the workspace's existing Playwright installation.
import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.clock.install({ time: new Date('2026-10-22T10:00:00Z') })
  const habit = { id: 1, name: 'Czytanie', createdOn: '2026-10-01', startDate: '2026-10-01',
    status: 'ACTIVE', completed: false, weeklyRewardGranted: false, rewardPoints: 3,
    description: 'Notatka', endDate: null, completionLimit: 3, completionBonusPoints: 10,
    requiredSuccessPercent: null, totalCompletions: 2, weeklyCompletedDays: 2,
    target: { targetDays: 7, effectiveFrom: '2026-09-28' },
    latestTarget: { targetDays: 7, effectiveFrom: '2026-09-28' },
    category: null, goalIds: [], goalTitles: [], regularity: null,
    completionBonusGranted: false, completionBonusEverGranted: false,
    completionBonusConditionsLocked: false, completionBonusTargetLocked: false,
    completionBonusSettledOn: null, completionBonusAwardPoints: null }
  let fail = false, points = 100, reads = 0
  const errors = []
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message) })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/habits') {
      reads++
      return route.fulfill({ status: fail ? 503 : 200, json: fail ? {} : [habit] })
    }
    if (path.endsWith('/configuration')) {
      habit.completionBonusConditionsLocked = true
      habit.completionBonusEverGranted = true
      return route.fulfill({ status: 409, json: { detail: 'Warunki premii są zablokowane.' } })
    }
    return route.fulfill({ json: path === '/api/users/me' ? { id: 1, login: 'test', points, theme: 'PURPLE' }
      : path === '/api/tasks/overview' ? { tasks: [], completedCount: 0 }
      : path === '/api/auth/csrf' ? { headerName: 'X-CSRF-TOKEN', token: 'test' } : [] })
  })
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5197')
  await page.getByRole('button', { name: 'Nawyki', exact: true }).click()
  await page.locator('.habit-card .task-menu-trigger').click()
  await page.getByRole('menuitem', { name: 'Edytuj', exact: true }).click()
  const name = page.getByLabel('Nazwa nawyku', { exact: true })
  await name.fill('Niezapisana nazwa')
  await page.locator('.habit-additional-settings > summary').click()
  assert.equal(await page.getByLabel('Łączna liczba wykonań').isDisabled(), false)
  // A temporary polling failure must not unmount the form or lose its draft.
  fail = true
  await page.clock.runFor(60_000)
  await page.getByText('Nie udało się pobrać nawyków. Odśwież stronę i spróbuj ponownie.').waitFor()
  assert.equal(await name.inputValue(), 'Niezapisana nazwa')
  fail = false
  points = 120
  habit.completionBonusGranted = true
  habit.completionBonusAwardPoints = 20
  await page.clock.runFor(60_000)
  await page.getByText('Saldo 120 pkt', { exact: true }).waitFor()
  await page.waitForFunction(() => !document.body.textContent.includes('Nie udało się pobrać nawyków.'))
  assert.equal(await name.inputValue(), 'Niezapisana nazwa')
  const before = reads
  await page.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')) })
  assert.equal(reads, before)
  await page.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await page.getByText('Warunki premii są zablokowane.', { exact: true }).waitFor()
  assert.equal(await name.inputValue(), 'Niezapisana nazwa')
  assert.equal(await name.isDisabled(), false)
  assert.equal(await page.getByLabel('Łączna liczba wykonań').isDisabled(), true)
  await page.getByRole('button', { name: 'Anuluj', exact: true }).click()
  await page.getByText('+20 pkt', { exact: true }).waitFor()
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
  assert.deepEqual(errors, [])
  console.log('PASS: polling failure/recovery preserves draft; balance/card refresh; deduplication; 409 preserves draft and locks conditions; actual award amount; no overflow at 320/390/1280px')
} finally { await browser.close() }
