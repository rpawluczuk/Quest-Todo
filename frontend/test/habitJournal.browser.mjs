import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Los_Angeles' })
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
  const long = '<b>Tekst, nie HTML</b>\n' + 'Obserwacja podczas realizacji nawyku. '.repeat(35) + '\n' + 'dlugi-adres'.repeat(50)
  const entry = (id, type, content) => ({ id, type, content, createdAt: '2026-10-29T23:30:00Z', updatedAt: '2026-10-30T12:00:00Z' })
  const replies = {
    1: { entries: [entry(8, 'SUCCESS', long), entry(7, 'DIFFICULTY', long), entry(6, 'NOTE', 'Krótka notatka')], totalElements: 12, hasMore: true },
    2: { entries: [entry(1, 'INSIGHT', 'Wniosek wstrzymanego')], totalElements: 1, hasMore: false },
    3: { entries: [], totalElements: 0, hasMore: false },
    4: { entries: [entry(1, 'NOTE', 'Historia zakończonego')], totalElements: 1, hasMore: false },
  }
  const reads = [], writes = [], errors = []
  let release, fail = true
  const gate = new Promise(resolve => { release = resolve })
  page.on('pageerror', error => errors.push(error.message))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname
    if (req.method() !== 'GET') writes.push(path)
    if (/^\/api\/habits\/\d+\/entries$/.test(path)) {
      const id = Number(path.split('/')[3]); reads.push(id)
      assert.equal(url.searchParams.get('page'), '0'); assert.equal(url.searchParams.get('size'), '3')
      if (id === 1) await gate
      if (id === 3 && fail) return route.fulfill({ status: 503, json: { detail: 'Błąd pobierania' } })
      if (id === 5) return route.fulfill({ status: 404, json: {} })
      return route.fulfill({ json: replies[id] })
    }
    return route.fulfill({ json: path === '/api/habits' ? habits
      : path === '/api/users/me' ? { id: 1, login: 'test', points: 100, theme: 'PURPLE' }
      : path === '/api/tasks/overview' ? { tasks: [], completedCount: 0 } : [] })
  })
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5197')
  await page.getByRole('navigation', { name: 'Widoki aplikacji' }).getByRole('button', { name: 'Nawyki', exact: true }).click()
  const card = id => page.locator('li').filter({ has: page.getByRole('button', { name: `Więcej opcji dla nawyku „${habits[id - 1].name}”`, exact: true }) }).first()
  const panel = id => page.locator(`#habit-journal-${id}`)
  const menu = id => card(id).locator('.task-menu-trigger')
  async function open(id, keyboard = false) {
    if (keyboard) { await menu(id).focus(); await page.keyboard.press('ArrowDown') }
    else await menu(id).click()
    const action = page.getByRole('menuitem', { name: 'Dziennik nawyku', exact: true })
    assert.equal(await action.getAttribute('aria-expanded'), 'false')
    if (keyboard) await page.keyboard.press('Enter')
    else await action.click()
    await panel(id).waitFor()
  }
  await menu(1).waitFor()
  assert.equal(await page.locator('.habit-journal').count(), 0)
  assert.deepEqual(reads, [])
  const height = (await card(1).boundingBox()).height
  const progress = await card(1).locator('.habit-progress-summary').innerText()
  await open(1, true)
  await panel(1).getByRole('status').waitFor()
  assert.equal(await panel(1).getByRole('button', { name: 'Zamknij dziennik nawyku' }).evaluate(el => el === document.activeElement), true)
  await panel(1).getByRole('button', { name: 'Zamknij dziennik nawyku' }).click()
  assert.equal(await menu(1).evaluate(el => el === document.activeElement), true)
  assert.equal((await card(1).boundingBox()).height, height)
  await open(1)
  assert.deepEqual(reads, [1])
  await page.locator('.habit-waiting-section > summary').click()
  await open(2)
  await panel(2).getByText('Wniosek wstrzymanego', { exact: true }).waitFor()
  assert.equal(await panel(1).count(), 0)
  const response = page.waitForResponse(res => new URL(res.url()).pathname === '/api/habits/1/entries')
  release(); await response
  assert.equal(await panel(2).getByRole('heading').innerText(), 'Dziennik nawyku (1)')
  assert.equal(await panel(2).getByText('Krótka notatka').count(), 0)
  assert.equal(await card(2).getByRole('button', { name: 'Wznów nawyk: Wstrzymany' }).count(), 1)
  await open(1)
  await panel(1).getByText('Łącznie 12 wpisów', { exact: true }).waitFor()
  assert.equal(await panel(1).getByRole('heading').innerText(), 'Dziennik nawyku (12)')
  assert.deepEqual(await panel(1).locator('.goal-journal-entry-type').allTextContents(), ['Sukces', 'Trudność', 'Notatka'])
  assert.deepEqual(await panel(1).locator('time').allTextContents(), Array(3).fill('30 paź 2026'))
  assert.equal(await panel(1).locator('b, textarea').count(), 0)
  assert.equal(await panel(1).getByRole('button', { name: /Pokaż wszystkie/ }).count(), 0)
  const first = panel(1).locator('.goal-journal-entry').nth(0), second = panel(1).locator('.goal-journal-entry').nth(1)
  await first.getByRole('button', { name: 'Pokaż więcej', exact: true }).click()
  assert.equal(await first.getByRole('button', { name: 'Pokaż mniej', exact: true }).getAttribute('aria-expanded'), 'true')
  assert.equal(await second.getByRole('button', { name: 'Pokaż więcej', exact: true }).getAttribute('aria-expanded'), 'false')
  await first.getByRole('button', { name: 'Pokaż mniej', exact: true }).click()
  assert.equal(await panel(1).locator('.goal-journal-entry').nth(2).getByRole('button', { name: /Pokaż więcej/ }).count(), 0)
  await panel(1).getByRole('heading').click()
  assert.equal(await card(1).locator('.habit-description').isVisible(), false)
  for (const width of [320, 360, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.ok(await panel(1).evaluate(el => el.scrollWidth <= el.clientWidth))
    await first.getByRole('button', { name: 'Pokaż więcej', exact: true }).click()
    assert.ok(await panel(1).evaluate(el => el.scrollWidth <= el.clientWidth))
    await first.getByRole('button', { name: 'Pokaż mniej', exact: true }).click()
    if (width === 360) await panel(1).screenshot({ path: '../.local-backups/habit-journal.png' })
  }
  await open(3)
  await panel(3).getByRole('alert').waitFor()
  assert.equal(await card(3).getByRole('button', { name: 'Rozpocznij nawyk: Zaplanowany' }).count(), 1)
  fail = false
  await panel(3).getByRole('button', { name: 'Spróbuj ponownie' }).click()
  await panel(3).getByText('Brak wpisów w dzienniku', { exact: true }).waitFor()
  assert.equal(await panel(3).getByRole('heading').innerText(), 'Dziennik nawyku (0)')
  await page.locator('.habit-finished-section:not(.habit-waiting-section) > summary').click()
  await open(4)
  await panel(4).getByText('Historia zakończonego', { exact: true }).waitFor()
  assert.equal(await panel(4).locator('.task-menu-trigger').count(), 0)
  await open(5)
  await panel(5).getByRole('alert').filter({ hasText: 'Nawyk został usunięty' }).waitFor()
  assert.equal(await panel(5).getByRole('button', { name: 'Spróbuj ponownie' }).isEnabled(), true)
  assert.equal(await card(1).locator('.habit-progress-summary').innerText(), progress)
  assert.equal(await card(1).getByRole('checkbox').isChecked(), false)
  assert.deepEqual(reads, [1, 2, 3, 3, 4, 5])
  assert.deepEqual(writes, [])
  assert.deepEqual(errors, [])
  console.log('PASS: habit journal lazy/cache/races, all statuses/types, counts, empty/retry/404, keyboard/focus, safe text, mobile 320/360/390 and desktop, no writes')
} finally { await browser.close() }
