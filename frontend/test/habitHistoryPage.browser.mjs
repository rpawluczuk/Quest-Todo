import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'
import { historyMonths } from '../src/habitHistoryCalendar.ts'

const base = { createdOn: '2024-01-01', startDate: '2024-01-01', endDate: null, endedOn: null, endReason: null,
  activityStatus: 'ACTIVE', status: 'ACTIVE', completed: false, weeklyRewardGranted: false, rewardPoints: 3,
  description: '', completionLimit: null, completionBonusPoints: null, requiredSuccessPercent: null,
  totalCompletions: 2, weeklyCompletedDays: 2, target: { targetDays: 3, effectiveFrom: '2026-01-01' },
  latestTarget: { targetDays: 3, effectiveFrom: '2026-01-01' }, category: null, goalIds: [], goalTitles: [],
  regularity: null, completionBonusGranted: false, completionBonusEverGranted: false,
  completionBonusConditionsLocked: false, completionBonusTargetLocked: false,
  completionBonusSettledOn: null, completionBonusAwardPoints: null }
const habits = [{ ...base, id: 1, name: 'Czytanie' },
  { ...base, id: 2, name: 'Zakończony nawyk', status: 'FINISHED', endDate: '2025-12-31' }]
function history(id, year) {
  const months = historyMonths(year)
  return { id, name: habits.find(h => h.id === id)?.name, year, today: '2026-01-01',
    days: months.flatMap(m => m.rows.flatMap(r => r.days.filter(Boolean).map(d => ({ date: d.date, completed: false,
      status: d.date > '2026-01-01' ? 'FUTURE' : 'ACTIVE' })))),
    weeks: [...new Set(months.flatMap(m => m.rows.map(r => r.weekStart)))].map(weekStart => ({ weekStart,
      completedDays: 0, targetDays: 3, requiredDays: 3, status: 'NEUTRAL' })) }
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 950 }, timezoneId: 'Pacific/Honolulu' })
  // Still December in Honolulu, already January in Warsaw: tile entry must use 2026.
  await page.clock.install({ time: new Date('2025-12-31T23:30:00Z') })
  const errors = [], reads = [], writes = []
  let releaseOld, holdOld = false, failNetwork = false
  page.on('pageerror', error => errors.push(error.message))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname
    if (req.method() !== 'GET') writes.push(path)
    let body = []
    if (path === '/api/users/me') body = { id: 1, login: 'test', points: 100, theme: 'PURPLE' }
    else if (path === '/api/auth/csrf') body = { headerName: 'X-CSRF-TOKEN', token: 'test' }
    else if (path === '/api/tasks/overview') body = { tasks: [], completedCount: 0 }
    else if (path === '/api/habits') body = habits
    else if (/^\/api\/habits\/\d+\/history$/.test(path)) {
      const id = Number(path.split('/')[3]), year = Number(url.searchParams.get('year'))
      reads.push({ id, year })
      if (id === 999) return route.fulfill({ status: 404, json: {} })
      if (failNetwork) return route.abort('failed')
      if (holdOld && year === 2024) await new Promise(resolve => { releaseOld = resolve })
      body = history(id, year)
    }
    await route.fulfill({ json: body }).catch(() => {}) // An old request may have been aborted by navigation.
  })
  const url = process.env.TEST_URL ?? 'http://127.0.0.1:5197'
  const nav = page.getByRole('navigation', { name: 'Widoki aplikacji' })
  const view = page.locator('.habit-history-page')
  async function waitYear(year) {
    await view.locator(`[data-date="${String(year).padStart(4, '0')}-01-01"]`).waitFor()
    assert.equal(await view.locator('.habit-history-selected-year').innerText(), String(year))
    assert.equal(await view.locator('.habit-history-month').count(), 12)
    assert.equal(await view.locator('.habit-history-header').count(), 0)
  }
  async function openFromTile(name) {
    const tile = page.locator('#habits-page li.habit-card').filter({ has: page.getByText(name, { exact: true }) })
    await tile.locator('.task-menu-trigger').click()
    await tile.getByRole('menuitem', { name: 'Historia', exact: true }).click()
  }
  await page.goto(url)
  await nav.getByRole('button', { name: 'Nawyki', exact: true }).click()
  await page.locator('.habit-finished-section:not(.habit-waiting-section) > summary').click()
  await openFromTile('Zakończony nawyk'); await waitYear(2026)
  assert.match(page.url(), /\/habits\/2\/history\?year=2026$/)
  await view.getByRole('button', { name: 'Wróć do nawyków' }).click()
  assert.equal(await page.locator('.habit-finished-section:not(.habit-waiting-section)').getAttribute('open'), '')
  await openFromTile('Czytanie'); await waitYear(2026)
  await view.getByRole('button', { name: 'Poprzedni rok', exact: true }).click(); await waitYear(2025)
  await page.reload(); await waitYear(2025)
  holdOld = true
  await view.getByRole('button', { name: 'Poprzedni rok', exact: true }).click()
  await view.getByRole('status').waitFor()
  for (let wait = 0; !releaseOld && wait < 1000; wait++) await new Promise(resolve => setTimeout(resolve, 10))
  assert.ok(releaseOld, 'The delayed year request should have reached the API')
  assert.equal(await view.locator('[data-date]').count(), 0)
  await view.getByRole('button', { name: 'Następny rok', exact: true }).click(); await waitYear(2025)
  releaseOld(); holdOld = false
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  assert.equal(await view.locator('[data-date="2024-01-01"]').count(), 0)
  await view.getByRole('button', { name: 'Bieżący rok', exact: true }).click(); await waitYear(2026)
  assert.equal(await view.getByRole('button', { name: 'Następny rok', exact: true }).isDisabled(), true)
  await page.goBack(); await waitYear(2025)
  await page.goForward(); await waitYear(2026)
  await view.getByRole('button', { name: 'Wróć do nawyków' }).click()
  await page.locator('#habits-heading').waitFor()
  assert.match(page.url(), /\/habits$/)

  await page.goto(`${url}/habits/1/history?year=2020`); await waitYear(2020)
  assert.equal(await view.locator('[data-date]').count(), 366) // a year with no completions is still a calendar
  await page.goto(`${url}/habits/1/history?year=bad`)
  await view.getByRole('alert').filter({ hasText: 'Nieprawidłowy rok' }).waitFor()
  await view.getByRole('button', { name: 'Otwórz bieżący rok' }).click(); await waitYear(2026)
  await page.goto(`${url}/habits/999/history?year=2026`)
  await view.getByRole('alert').filter({ hasText: 'Nawyk nie istnieje' }).waitFor()
  await view.getByRole('button', { name: 'Wróć do nawyków' }).click()
  await page.locator('#habits-heading').waitFor()
  failNetwork = true
  await page.goto(`${url}/habits/1/history?year=2023`)
  await view.getByRole('alert').filter({ hasText: 'Sprawdź połączenie' }).waitFor()
  failNetwork = false
  await view.getByRole('button', { name: 'Spróbuj ponownie', exact: true }).click(); await waitYear(2023)
  await page.goto(`${url}/habits/1/history?year=1`); await waitYear(1)
  assert.equal(await view.getByRole('button', { name: 'Poprzedni rok', exact: true }).isDisabled(), true)
  await page.goto(`${url}/habits/1/history?year=2026`); await waitYear(2026)
  await page.screenshot({ path: '../.local-backups/habit-history-page-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 375, height: 850 })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await view.getByRole('button', { name: 'Poprzedni rok', exact: true }).click(); await waitYear(2025)
  await page.screenshot({ path: '../.local-backups/habit-history-page-phone.png', fullPage: true })
  await view.getByRole('button', { name: 'Wróć do nawyków' }).click()
  await page.locator('#habits-heading').waitFor()
  assert.ok(reads.some(r => r.id === 2 && r.year === 2026))
  assert.deepEqual(errors, []); assert.deepEqual(writes, [])
  console.log('PASS: active/finished tiles, Warsaw default year, list context, URL/reload/back/forward, stale responses, empty year, validation/404/retry, desktop/mobile')
} finally { await browser.close() }
