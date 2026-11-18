import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  for (const timezoneId of ['America/Los_Angeles', 'Pacific/Kiritimati']) {
    const page = await browser.newPage({ timezoneId, viewport: { width: 390, height: 844 } })
    await page.clock.install({ time: new Date('2026-12-16T22:59:50Z') })
    const goal = { id: 1, title: 'Przegląd po północy', completed: false, currentState: '', desiredOutcome: '',
      reviewFrequency: 'MONTHLY', nextReviewDate: '2026-12-17', reviewDue: false }
    let listReads = 0, entryReads = 0, hold = true, release, fail = false, requested
    let started = new Promise(resolve => { requested = resolve })
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const path = new URL(route.request().url()).pathname
      assert.equal(route.request().method(), 'GET')
      if (path === '/api/goals') {
        listReads++
        const snapshot = structuredClone(goal)
        if (hold) await new Promise(resolve => { release = resolve; requested() })
        return route.fulfill({ status: fail ? 503 : 200, json: fail ? { detail: 'Błąd odświeżenia' } : [snapshot] })
      }
      if (path.endsWith('/entries')) entryReads++
      return route.fulfill({ json: path === '/api/auth/csrf' ? { headerName: 'X-CSRF-TOKEN', token: 'test' }
        : path === '/api/users/me' ? { id: 1, login: 'test', points: 37, theme: 'PURPLE' }
        : path === '/api/tasks/overview' ? { tasks: [], completedCount: 0 } : [] })
    })
    await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5197')
    await started
    await page.clock.fastForward(20_000)
    goal.reviewDue = true
    hold = false; release()
    await page.getByRole('navigation', { name: 'Widoki aplikacji' }).getByRole('button', { name: 'Cele', exact: true }).click()
    const card = page.locator('#goal-card-1'), badge = card.locator('.goal-review-status')
    await card.waitFor()
    assert.equal(await badge.count(), 0)
    const initialReads = listReads // Development StrictMode may abort and repeat the initial read.
    await page.clock.fastForward(61_000)
    await badge.waitFor()
    assert.equal(listReads, initialReads + 1, 'Initial request spanning midnight must not mark the new day as refreshed')
    assert.equal(entryReads, 0)

    // The same race during a later focus refresh, with no intervening mutations.
    await page.clock.setSystemTime(new Date('2026-12-17T22:59:50Z'))
    Object.assign(goal, { nextReviewDate: '2026-12-18', reviewDue: false })
    hold = true; started = new Promise(resolve => { requested = resolve })
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await started
    await page.clock.setSystemTime(new Date('2026-12-17T23:00:10Z'))
    goal.reviewDue = true
    hold = false; release()
    await badge.waitFor({ state: 'detached' })
    await page.clock.fastForward(61_000)
    await badge.waitFor()
    assert.equal(listReads, initialReads + 3)

    // Background tabs defer reads, then revalidate once on visibility/focus.
    await page.evaluate(() => {
      window.testHidden = true
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.testHidden ? 'hidden' : 'visible' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.clock.setSystemTime(new Date('2026-12-18T23:01:00Z'))
    await page.clock.fastForward(61_000)
    assert.equal(listReads, initialReads + 3)
    goal.title = 'Odświeżony cel'
    await page.evaluate(() => {
      window.testHidden = false
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('focus'))
    })
    await card.getByRole('button', { name: 'Odświeżony cel', exact: true }).waitFor()
    assert.equal(listReads, initialReads + 4)
    await page.clock.fastForward(120_000)
    assert.equal(listReads, initialReads + 4, 'No continuous polling')
    fail = true
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await page.getByRole('alert').filter({ hasText: 'Nie udało się odświeżyć statusu celów.' }).waitFor()
    assert.equal(await badge.count(), 1)
    fail = false
    await page.getByRole('button', { name: 'Odśwież cele', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Nie udało się odświeżyć statusu celów.' }).waitFor({ state: 'detached' })
    assert.equal(listReads, initialReads + 6)
    assert.equal(entryReads, 0)
    await page.close()
  }
  console.log('PASS: initial/background reads crossing Warsaw midnight, opposite browser zones, hidden/visible/focus, throttling, failed GET retry, no journal reads')
} finally { await browser.close() }
