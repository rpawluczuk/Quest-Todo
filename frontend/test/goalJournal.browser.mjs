import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Los_Angeles' })
  const goals = [1, 2, 3, 4, 5].map(id => ({ id, title: `Cel ${id}`, currentState: 'Punkt początkowy',
    desiredOutcome: 'Warunek sukcesu', completed: id === 5, completedAt: id === 5 ? '2026-10-30T12:00:00Z' : null }))
  const long = '<b>To jest zwykły tekst, nie HTML.</b>\n' + 'Obserwacja po kilku tygodniach pracy nad celem. '.repeat(35)
    + '\nhttps://example.test/' + 'bardzodlugiadres'.repeat(25)
  const entry = (id, type, content) => ({ id, type, content, createdAt: '2026-10-29T23:30:00Z', updatedAt: '2026-10-30T12:00:00Z' })
  const replies = {
    1: { entries: [entry(8, 'SUCCESS', long), entry(7, 'DIFFICULTY', long), entry(6, 'NOTE', 'Krótka notatka')], totalElements: 8, hasMore: true },
    2: { entries: [entry(1, 'INSIGHT', 'Wniosek drugiego celu')], totalElements: 1, hasMore: false },
    3: { entries: [entry(3, 'NOTE', 'Trzeci'), entry(2, 'INSIGHT', 'Drugi'), entry(1, 'SUCCESS', 'Pierwszy')], totalElements: 3, hasMore: false },
    4: { entries: [], totalElements: 0, hasMore: false },
    5: { entries: [entry(1, 'NOTE', 'Historia osiągniętego celu')], totalElements: 1, hasMore: false },
  }
  const reads = [], writes = [], errors = []
  let release, fail = true
  const gate = new Promise(resolve => { release = resolve })
  page.on('pageerror', error => errors.push(error.message))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname
    if (req.method() !== 'GET') writes.push(path)
    if (/^\/api\/goals\/\d+\/entries$/.test(path)) {
      const id = Number(path.split('/')[3]); reads.push(id)
      assert.equal(url.searchParams.get('page'), '0'); assert.equal(url.searchParams.get('size'), '3')
      if (id === 1) await gate
      if (id === 4 && fail) return route.fulfill({ status: 503, json: { detail: 'Nie udało się pobrać dziennika.' } })
      return route.fulfill({ json: replies[id] })
    }
    return route.fulfill({ json: path === '/api/goals' ? goals
      : path === '/api/users/me' ? { id: 1, login: 'test', points: 0, theme: 'PURPLE' }
      : path === '/api/tasks/overview' ? { tasks: [], completedCount: 0 } : [] })
  })
  const nav = page.getByRole('navigation', { name: 'Widoki aplikacji' })
  const card = id => page.locator(`#goal-card-${id}`)
  const journal = id => card(id).locator('.goal-journal')
  const toggle = id => journal(id).getByRole('button', { name: /^Dziennik celu/ })
  const content = id => journal(id).locator('.goal-journal-content')
  async function openGoal(id) {
    await page.getByRole('button', { name: `Cel ${id}`, exact: true }).click()
    await toggle(id).waitFor()
  }
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5197')
  await nav.getByRole('button', { name: 'Cele', exact: true }).click()
  assert.deepEqual(reads, [])
  await openGoal(1)
  assert.equal(await toggle(1).getAttribute('aria-expanded'), 'false')
  assert.equal(await content(1).isVisible(), false)
  assert.deepEqual(reads, [])
  assert.ok(await journal(1).evaluate(el => !!(el.compareDocumentPosition(
    el.parentElement.querySelector('.goal-initial-state-toggle:not(.goal-journal-toggle)')) & Node.DOCUMENT_POSITION_FOLLOWING)))
  assert.ok(await journal(1).evaluate(el => !!(el.parentElement.querySelector('[id="goal-panel-habits-1"]')
    .compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)))
  assert.equal(await card(1).getByRole('tab').count(), 3)
  await toggle(1).focus(); await page.keyboard.press('Enter')
  await content(1).getByRole('status').filter({ hasText: 'Ładowanie wpisów' }).waitFor()
  assert.equal(await toggle(1).innerText(), 'Dziennik celu')
  await page.locator('#goal-tab-tasks-1').click()
  assert.equal(await toggle(1).getAttribute('aria-expanded'), 'true')
  await toggle(1).click(); await toggle(1).click()
  assert.deepEqual(reads, [1])
  await openGoal(2); await toggle(2).click()
  await content(2).getByText('Wniosek drugiego celu', { exact: true }).waitFor()
  assert.equal(await toggle(2).innerText(), 'Dziennik celu (1)')
  assert.equal(await content(2).getByText('Wniosek', { exact: true }).count(), 1)
  assert.equal(await content(2).getByRole('button').count(), 0)
  release()
  await page.waitForResponse(response => new URL(response.url()).pathname === '/api/goals/1/entries')
  assert.equal(await content(2).getByText('Wniosek drugiego celu', { exact: true }).isVisible(), true)
  assert.equal(await content(2).getByText('Krótka notatka', { exact: true }).count(), 0)
  await openGoal(1)
  assert.equal(await toggle(1).getAttribute('aria-expanded'), 'false')
  await toggle(1).click()
  await content(1).getByText('Łącznie 8 wpisów', { exact: true }).waitFor()
  assert.equal(await toggle(1).innerText(), 'Dziennik celu (8)')
  assert.deepEqual(await content(1).locator('.goal-journal-entry-type').allTextContents(), ['Sukces', 'Trudność', 'Notatka'])
  assert.deepEqual(await content(1).locator('time').allTextContents(), Array(3).fill('30 paź 2026'))
  assert.equal(await content(1).locator('b').count(), 0)
  assert.equal(await content(1).getByRole('button', { name: /Pokaż wszystkie/ }).count(), 0)
  const first = content(1).locator('li').nth(0), second = content(1).locator('li').nth(1)
  await first.getByRole('button', { name: 'Pokaż więcej', exact: true }).click()
  assert.equal(await first.getByRole('button', { name: 'Pokaż mniej', exact: true }).getAttribute('aria-expanded'), 'true')
  assert.equal(await second.getByRole('button', { name: 'Pokaż więcej', exact: true }).getAttribute('aria-expanded'), 'false')
  await first.getByRole('button', { name: 'Pokaż mniej', exact: true }).click()
  const initial = card(1).getByRole('button', { name: 'Stan początkowy', exact: true })
  await initial.click(); await toggle(1).click()
  assert.equal(await initial.getAttribute('aria-expanded'), 'true')
  await toggle(1).focus(); await page.keyboard.press('Space')
  for (const tab of ['milestones', 'tasks', 'habits']) {
    await page.locator(`#goal-tab-${tab}-1`).click()
    assert.equal(await toggle(1).getAttribute('aria-expanded'), 'true')
  }
  for (const width of [320, 360, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.ok(await journal(1).evaluate(el => el.scrollWidth <= el.clientWidth))
    await page.waitForFunction(() => {
      const el = document.querySelector('.goal-journal-entry p')
      return el && el.clientHeight <= parseFloat(getComputedStyle(el).lineHeight) * 3 + 1
    })
    if (width === 360) await journal(1).screenshot({ path: '../.local-backups/goal-journal.png' })
  }
  assert.deepEqual(reads, [1, 2])
  await openGoal(3); await toggle(3).click()
  await content(3).getByText('Trzeci', { exact: true }).waitFor()
  assert.equal(await toggle(3).innerText(), 'Dziennik celu (3)')
  assert.deepEqual(await content(3).locator('.goal-journal-entry > p').allTextContents(), ['Trzeci', 'Drugi', 'Pierwszy'])
  assert.equal(await content(3).getByText(/Łącznie/).count(), 0)
  await openGoal(4); await toggle(4).click()
  await content(4).getByRole('alert').waitFor()
  assert.equal(await toggle(4).getAttribute('aria-expanded'), 'true')
  assert.equal(await card(4).getByRole('tab').count(), 3)
  fail = false
  await content(4).getByRole('button', { name: 'Spróbuj ponownie', exact: true }).click()
  await content(4).getByText('Brak wpisów w dzienniku', { exact: true }).waitFor()
  assert.equal(await toggle(4).innerText(), 'Dziennik celu (0)')
  assert.equal(await content(4).getByRole('alert').count(), 0)
  await toggle(4).click(); await toggle(4).click()
  assert.deepEqual(reads, [1, 2, 3, 4, 4])
  await page.getByRole('button', { name: /Osiągnięte \(/ }).click()
  await openGoal(5); await toggle(5).click()
  await content(5).getByText('Historia osiągniętego celu', { exact: true }).waitFor()
  assert.equal(await toggle(5).innerText(), 'Dziennik celu (1)')
  assert.deepEqual(writes, [])
  assert.deepEqual(errors, [])
  console.log('PASS: lazy journal/cache/isolation, total count, 0/1/3/8 entries, all types, Warsaw dates, clamped independent text, retry, read-only, keyboard, mobile/desktop')
} finally { await browser.close() }
