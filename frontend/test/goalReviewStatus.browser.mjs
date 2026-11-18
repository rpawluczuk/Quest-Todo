import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 },
    timezoneId: 'America/Los_Angeles', reducedMotion: 'reduce' })
  await page.clock.install({ time: new Date('2026-12-16T22:59:30Z') })
  const goals = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, title: `Cel ${index + 1}`,
    currentState: '', desiredOutcome: '', completed: index === 6,
    reviewFrequency: index === 5 ? null : 'MONTHLY',
    nextReviewDate: index === 7 ? '2027-02-17' : index === 4 ? '2026-12-17' : '2026-12-16', reviewDue: index !== 4 && index !== 7 }))
  const entries = Object.fromEntries(goals.map(goal => [goal.id, []]))
  Object.assign(goals[0], { title: 'Bardzo długi cel rozwoju zawodowego i osobistego wymagający regularnej refleksji',
    currentState: 'Punkt początkowy. '.repeat(30), desiredOutcome: 'Mierzalne kryterium sukcesu. '.repeat(30) })
  entries[5] = [4, 3, 2, 1].map(id => ({ id, type: 'NOTE', content: `Historia ${id}`,
    createdAt: '2026-12-01T00:00:00Z', updatedAt: '2026-12-01T00:00:00Z' }))
  const requests = [], errors = []
  let failPost = false, failDetail = false, failJournal = false, holdList = false, releaseList, listHeld = false
  page.on('pageerror', error => errors.push(error.message))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), path = new URL(req.url()).pathname, method = req.method()
    requests.push({ path, method })
    if (path === '/api/auth/csrf') return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'test' } })
    if (path === '/api/goals') {
      const snapshot = structuredClone(goals)
      if (holdList) { listHeld = true; await new Promise(resolve => { releaseList = resolve }) }
      return route.fulfill({ json: snapshot })
    }
    const detail = path.match(/^\/api\/goals\/(\d+)$/)
    if (detail) return route.fulfill({ status: failDetail ? 503 : 200,
      json: failDetail ? { detail: 'Błąd odświeżania' } : goals[Number(detail[1]) - 1] })
    const journal = path.match(/^\/api\/goals\/(\d+)\/entries$/)
    if (journal) {
      const id = Number(journal[1])
      if (method === 'GET') {
        if (failJournal) return route.fulfill({ status: 503, json: { detail: 'Błąd Dziennika' } })
        const limit = Number(new URL(req.url()).searchParams.get('size') ?? 3)
        return route.fulfill({ json: { entries: entries[id].slice(0, limit),
          totalElements: entries[id].length, hasMore: entries[id].length > limit } })
      }
      assert.equal(method, 'POST')
      if (failPost) return route.fulfill({ status: 400, json: { detail: 'Nieprawidłowy wpis' } })
      const added = { id: 100 + requests.length, ...req.postDataJSON(),
        reviewCompleted: goals[id - 1].reviewDue,
        createdAt: '2026-12-17T00:00:00Z', updatedAt: '2026-12-17T00:00:00Z' }
      entries[id].unshift(added)
      if (goals[id - 1].reviewDue) Object.assign(goals[id - 1], { reviewDue: false, nextReviewDate: '2027-01-17' })
      return route.fulfill({ status: 201, json: added })
    }
    return route.fulfill({ json: path === '/api/users/me' ? { id: 1, login: 'test', points: 37, theme: 'PURPLE' }
      : path === '/api/tasks/overview' ? { tasks: [], completedCount: 0 } : [] })
  })
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5197')
  await page.getByRole('navigation', { name: 'Widoki aplikacji' }).getByRole('button', { name: 'Cele', exact: true }).click()
  const card = id => page.locator(`#goal-card-${id}`)
  const badge = id => card(id).locator('.goal-review-status')
  const journal = id => card(id).locator('.goal-journal')
  const form = id => journal(id).getByRole('form')
  const textarea = id => form(id).getByRole('textbox', { name: /Treść/ })
  const prompt = id => card(id).locator('.goal-review-prompt').getByRole('button')
  const open = id => card(id).getByRole('button', { name: goals[id - 1].title, exact: true }).click()
  const listCount = () => requests.filter(r => r.path === '/api/goals').length
  const postCount = () => requests.filter(r => r.method === 'POST').length
  await badge(1).waitFor()
  for (const id of [1, 2, 3, 4]) assert.equal(await badge(id).count(), 1)
  for (const id of [5, 6, 8]) assert.equal(await badge(id).count(), 0)
  await page.getByRole('button', { name: /Osiągnięte \(/ }).click()
  assert.equal(await badge(7).count(), 0)
  for (const width of [320, 360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
  await page.setViewportSize({ width: 360, height: 844 })
  await card(1).screenshot({ path: '../.local-backups/goal-review-status-collapsed.png' })
  await open(1)
  await page.locator('#goal-tab-tasks-1').click()
  await prompt(1).focus(); await page.keyboard.press('Enter')
  await textarea(1).waitFor()
  await page.waitForFunction(() => document.activeElement?.tagName === 'TEXTAREA')
  await textarea(1).fill('Mój szkic')
  await prompt(1).click()
  assert.equal(await textarea(1).inputValue(), 'Mój szkic')
  assert.equal(await form(1).count(), 1)
  assert.equal(await page.locator('#goal-tab-tasks-1').getAttribute('aria-selected'), 'true')
  for (const width of [320, 360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.ok(await prompt(1).evaluate(el => el.getBoundingClientRect().height >= 44))
  }
  await page.setViewportSize({ width: 360, height: 844 })
  await card(1).screenshot({ path: '../.local-backups/goal-review-status-expanded.png' })
  failPost = true
  await form(1).getByRole('button', { name: 'Dodaj', exact: true }).click()
  await form(1).getByRole('alert').waitFor()
  assert.equal(await textarea(1).inputValue(), 'Mój szkic')
  assert.equal(await badge(1).count(), 1)
  failPost = false
  // Warsaw midnight, even though the browser is still on the previous day.
  const initialLists = listCount()
  goals[4].reviewDue = true
  await page.clock.fastForward(60_000)
  await badge(5).waitFor()
  assert.equal(listCount(), initialLists + 1)
  assert.equal(await textarea(1).inputValue(), 'Mój szkic')
  await page.clock.fastForward(60_000)
  assert.equal(listCount(), initialLists + 1, 'No continuous network polling')
  // Older background list must not undo a successful journal review.
  holdList = true
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.waitForTimeout(100)
  assert.ok(listHeld)
  const detailsBefore = requests.filter(r => /^\/api\/goals\/\d+$/.test(r.path)).length
  await form(1).getByRole('button', { name: 'Dodaj', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Przegląd celu zaliczony' }).waitFor()
  assert.equal(await badge(1).count(), 0)
  assert.equal(await card(1).locator('.goal-review-next time').getAttribute('datetime'), '2027-01-17')
  assert.equal(requests.filter(r => /^\/api\/goals\/\d+$/.test(r.path)).length, detailsBefore + 1)
  holdList = false; releaseList()
  await page.waitForTimeout(100)
  assert.equal(await badge(1).count(), 0)
  assert.equal(await page.locator('#goal-tab-tasks-1').getAttribute('aria-selected'), 'true')
  // Every entry type can complete a review; failed GET retries never duplicate the POST.
  for (const [id, label] of [[2, 'Sukces'], [3, 'Trudność'], [4, 'Wniosek']]) {
    await open(id); await prompt(id).click(); await textarea(id).fill(label)
    await form(id).getByRole('combobox').click()
    await page.getByRole('option', { name: label, exact: true }).click()
    failDetail = id === 2
    await form(id).getByRole('button', { name: 'Dodaj', exact: true }).click()
    await form(id).waitFor({ state: 'detached' })
    if (failDetail) {
      await card(id).getByRole('alert').waitFor()
      await page.getByRole('status').filter({ hasText: 'Wpis został dodany' }).waitFor()
      assert.equal(await badge(id).count(), 1)
      assert.equal(entries[id].length, 1)
      const posts = postCount()
      failDetail = false
      await card(id).getByRole('button', { name: 'Odśwież dane celu' }).click()
      await badge(id).waitFor({ state: 'detached' })
      assert.equal(postCount(), posts)
      assert.equal(await journal(id).locator('.goal-journal-entry').count(), 1)
    } else {
      await page.getByRole('status').filter({ hasText: 'Przegląd celu zaliczony' }).waitFor()
      await badge(id).waitFor({ state: 'detached' })
    }
  }
  // An early entry retains its schedule and ordinary success message.
  await open(8)
  await journal(8).getByRole('button', { name: 'Dodaj wpis do dziennika', exact: true }).click()
  await textarea(8).fill('Zwykły wpis')
  await form(8).getByRole('button', { name: 'Dodaj', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Wpis został dodany' }).waitFor()
  assert.equal(await card(8).locator('.goal-review-next time').getAttribute('datetime'), '2027-02-17')
  // Existing history and dirty-edit protection also apply to the review action.
  await open(5)
  failJournal = true
  await prompt(5).click()
  await journal(5).getByRole('alert').waitFor()
  assert.equal(await badge(5).count(), 1)
  failJournal = false
  await journal(5).getByRole('button', { name: 'Spróbuj ponownie' }).click()
  await journal(5).locator('.goal-journal-entry').first().waitFor()
  await form(5).getByRole('button', { name: 'Anuluj', exact: true }).click()
  await journal(5).getByRole('button', { name: 'Pokaż wszystkie wpisy (4)' }).click()
  await journal(5).locator('.goal-journal-entry').nth(3).waitFor()
  await journal(5).locator('.goal-journal-entry').first().locator('.task-menu-trigger').click()
  await page.getByRole('menuitem', { name: 'Edytuj', exact: true }).click()
  await textarea(5).fill('Niezapisana edycja')
  await prompt(5).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Kontynuuj edycję' }).click()
  assert.equal(await textarea(5).inputValue(), 'Niezapisana edycja')
  await prompt(5).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Odrzuć zmiany' }).click()
  await page.waitForFunction(() => document.activeElement?.tagName === 'TEXTAREA')
  assert.equal(await textarea(5).inputValue(), '')
  assert.equal(await journal(5).locator('.goal-journal-entry').count(), 4)
  assert.equal(await journal(5).getByRole('button', { name: 'Pokaż mniej' }).isVisible(), true)
  // Another tab completed the review while this tab still displayed the old due flag.
  Object.assign(goals[4], { reviewDue: false, nextReviewDate: '2027-01-17' })
  await textarea(5).fill('Wpis po przeglądzie w innej karcie')
  await form(5).getByRole('button', { name: 'Dodaj', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Wpis został dodany' }).waitFor()
  await badge(5).waitFor({ state: 'detached' })
  assert.equal(await page.getByRole('status').filter({ hasText: 'Przegląd celu zaliczony' }).count(), 0)
  assert.deepEqual(errors, [])
  assert.ok(requests.filter(r => r.method !== 'GET').every(r => r.method === 'POST' && /\/entries$/.test(r.path)))
  console.log('Goal review status browser checks passed: badges, 4 types, drafts, keyboard, widths, errors, midnight, focus and stale list race')
} finally { await browser.close() }
