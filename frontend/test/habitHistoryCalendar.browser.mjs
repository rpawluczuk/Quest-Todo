import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'
import { historyMonths } from '../src/habitHistoryCalendar.ts'

function fixture(year) {
  const today = year === 2024 ? '2024-11-24' : '2026-11-24'
  const months = historyMonths(year)
  const days = months.flatMap(month => month.rows.flatMap(row => row.days.filter(Boolean).map(day => ({
    date: day.date, completed: ['2024-02-29', '2024-09-30', '2026-01-01', '2025-12-31'].includes(day.date),
    status: day.date > today ? 'FUTURE' : day.date.endsWith('-10') ? 'INACTIVE' : 'ACTIVE',
  }))))
  const weeks = [...new Set(months.flatMap(month => month.rows.map(row => row.weekStart)))].map(weekStart => ({
    weekStart, completedDays: 0, targetDays: null, requiredDays: null, status: 'NEUTRAL',
  }))
  for (const week of weeks) {
    if (week.weekStart === '2024-09-30') Object.assign(week, { completedDays: 4, targetDays: 7, requiredDays: 3, status: 'MET' })
    if (week.weekStart === '2024-11-11') Object.assign(week, { completedDays: 1, targetDays: 3, requiredDays: 3, status: 'MISSED' })
    if (week.weekStart === '2024-11-18') Object.assign(week, { completedDays: 2, targetDays: 7, requiredDays: 3, status: 'IN_PROGRESS' })
    if (week.weekStart === '2025-12-29') Object.assign(week, { completedDays: 5, targetDays: 5, requiredDays: 5, status: 'MET' })
  }
  return { id: 42, name: 'Czytanie i chwila dla siebie', year, today, days, weeks }
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const errors = [], requests = []
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, timezoneId: 'Pacific/Kiritimati', hasTouch: true })
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message) })
  let data = fixture(2024)
  // Isolated presentation harness: no application routes, API client or production entry-point changes.
  const renderHarness = route => route.fulfill({ contentType: 'text/html', body: `
    <!doctype html><html lang="pl"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body><main id="root" style="max-width:850px;margin:auto;padding:24px"></main><script type="module">
      import RefreshRuntime from '/@react-refresh'
      RefreshRuntime.injectIntoGlobalHook(window)
      window.$RefreshReg$ = () => {}
      window.$RefreshSig$ = () => type => type
      window.__vite_plugin_react_preamble_installed__ = true
      const {default: React} = await import('/node_modules/.vite/deps/react.js')
      const {default: {createRoot}} = await import('/node_modules/.vite/deps/react-dom_client.js')
      await import('/src/index.css')
      const {default: Calendar} = await import('/src/components/HabitHistoryCalendar.tsx')
      createRoot(document.getElementById('root')).render(React.createElement(Calendar, {history: ${JSON.stringify(data)}}))
    </script></body></html>` })
  await page.route('**/__habit-history-calendar-test', renderHarness)
  await page.route('**/api/**', route => { requests.push(route.request().url()); return route.abort() })
  const url = `${process.env.TEST_URL ?? 'http://127.0.0.1:5197'}/__habit-history-calendar-test`
  async function load(year) {
    data = fixture(year)
    await page.goto(url)
    await page.getByRole('heading', { name: data.name, exact: true }).waitFor()
  }
  await load(2024)
  const months = page.locator('.habit-history-month')
  assert.equal(await months.count(), 12)
  assert.deepEqual(await months.locator('h3').allTextContents(), ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'])
  assert.equal(await page.locator('[data-date]').count(), 366)
  assert.equal(await page.locator('[data-date="2024-02-29"]').innerText(), '29')
  assert.match(await page.locator('[data-date="2024-02-29"]').getAttribute('aria-label'), /29 lutego 2024.*Zapisane wykonanie/)
  const septemberFirst = months.nth(8).locator('tbody tr').first()
  assert.equal(await septemberFirst.locator('td').count(), 8)
  for (let i = 0; i < 6; i++) assert.equal(await septemberFirst.locator('td').nth(i).innerText(), '')
  assert.equal(await septemberFirst.locator('td').nth(6).innerText(), '1')
  const shared = page.locator('[data-week-start="2024-09-30"]')
  assert.equal(await shared.count(), 2)
  assert.deepEqual(await shared.locator('summary').allTextContents(), ['✓', '✓'])
  assert.deepEqual(await shared.locator('summary').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label'))),
    Array(2).fill('Tydzień od 30 września 2024. Cel osiągnięty. Wykonano 4 z 3 wymaganych dni.'))
  assert.equal(await page.locator('[data-week-start="2024-11-11"] summary').innerText(), '×')
  assert.equal(await page.locator('[data-week-start="2024-11-18"] summary').innerText(), '2/3')
  const summary = page.locator('[data-week-start="2024-11-18"] summary')
  await summary.focus(); await page.keyboard.press('Enter')
  await page.locator('[data-week-start="2024-11-18"] details p').waitFor({ state: 'visible' })
  assert.match(await page.locator('[data-week-start="2024-11-18"] details p').innerText(), /Wykonano 2 z 3/)
  await page.keyboard.press('Enter')
  assert.doesNotMatch((await page.locator('summary').allTextContents()).join(' '), /0\/0/)
  assert.match(await page.locator('[data-date="2024-01-10"]').getAttribute('aria-label'), /Dzień nieaktywny/)
  const boxes = await months.evaluateAll(nodes => nodes.slice(0, 3).map(n => ({ x: n.getBoundingClientRect().x, y: n.getBoundingClientRect().y })))
  assert.equal(boxes[0].y, boxes[1].y); assert.ok(boxes[0].x < boxes[1].x); assert.ok(boxes[2].y > boxes[0].y)
  await page.screenshot({ path: '../.local-backups/habit-history-desktop.png', fullPage: true })

  await page.setViewportSize({ width: 375, height: 850 })
  const phoneBoxes = await months.evaluateAll(nodes => nodes.slice(0, 2).map(n => ({ x: n.getBoundingClientRect().x, y: n.getBoundingClientRect().y })))
  assert.equal(phoneBoxes[0].x, phoneBoxes[1].x); assert.ok(phoneBoxes[1].y > phoneBoxes[0].y)
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await page.screenshot({ path: '../.local-backups/habit-history-phone.png', fullPage: true })
  await page.locator('[data-week-start="2024-11-18"] summary').tap()
  await page.locator('[data-week-start="2024-11-18"] details p').waitFor({ state: 'visible' })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await page.setViewportSize({ width: 320, height: 850 })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await load(2026)
  const crossYear = page.locator('[data-week-start="2025-12-29"] summary')
  assert.equal(await crossYear.innerText(), '✓')
  assert.match(await crossYear.getAttribute('aria-label'), /Wykonano 5 z 5/)
  assert.equal(await page.locator('[data-date="2026-12-01"].is-muted').count(), 1)
  assert.match(await page.locator('[data-date="2026-12-01"]').getAttribute('aria-label'), /Dzień przyszły/)
  const eastern = await page.locator('[data-date]').evaluateAll(nodes => nodes.map(n => [n.dataset.date, n.getAttribute('aria-label')]))
  const western = await browser.newPage({ viewport: { width: 375, height: 850 }, timezoneId: 'Pacific/Honolulu' })
  western.on('pageerror', error => errors.push(error.message))
  await western.route('**/__habit-history-calendar-test', renderHarness)
  await western.route('**/api/**', route => { requests.push(route.request().url()); return route.abort() })
  await western.goto(url)
  await western.getByRole('heading', { name: data.name, exact: true }).waitFor()
  assert.deepEqual(await western.locator('[data-date]').evaluateAll(nodes => nodes.map(n => [n.dataset.date, n.getAttribute('aria-label')])), eastern)
  assert.deepEqual(errors, []); assert.deepEqual(requests, [])
  console.log('PASS: annual calendar, all markers, keyboard/touch descriptions, month/year boundaries, leap day, desktop/mobile and browser timezones')
} finally { await browser.close() }
