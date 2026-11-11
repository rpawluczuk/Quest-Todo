import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const counts = { 1: 25, 2: 4, 3: 25, 4: 0, 5: 1, 6: 3 }
  const base = { createdOn: '2026-10-01', startDate: '2026-10-01', endDate: null, endedOn: null, endReason: null,
    status: 'ACTIVE', activityStatus: 'ACTIVE', completed: false, weeklyRewardGranted: false, rewardPoints: 3,
    description: '', completionLimit: null, completionBonusPoints: null, requiredSuccessPercent: null,
    totalCompletions: 42, weeklyCompletedDays: 2, target: { targetDays: 3, effectiveFrom: '2026-10-26' },
    latestTarget: { targetDays: 3, effectiveFrom: '2026-10-26' }, category: null, goalIds: [1, 2, 3], goalTitles: [],
    regularity: null, completionBonusGranted: false, completionBonusEverGranted: false,
    completionBonusConditionsLocked: false, completionBonusTargetLocked: false,
    completionBonusSettledOn: null, completionBonusAwardPoints: null }
  const goals = Object.keys(counts).map(Number).map(id => ({ ...base, id, name: `Nawyk ${id}`,
    status: id === 3 ? 'FINISHED' : 'ACTIVE', endedOn: id === 3 ? '2026-10-30' : null,
    activityStatus: id === 5 ? 'PAUSED' : id === 6 ? 'PLANNED' : 'ACTIVE' }))
  const entry = (id, content = `Wpis ${id}`) => ({ id, type: ['NOTE', 'SUCCESS', 'DIFFICULTY', 'INSIGHT'][id % 4], content,
    createdAt: '2026-10-30T12:00:00Z', updatedAt: '2026-10-30T12:00:00Z' })
  const records = Object.fromEntries(Object.entries(counts).map(([id, count]) => [id,
    Array.from({ length: count }, (_, index) => entry(count - index, count - index === 25 ? 'Bardzo długi wpis\n'.repeat(60) : `Wpis ${count - index}`))]))
  const reads = [], writes = [], statusWrites = [], errors = []
  let failurePage = -1, holdPage = -1, gate, release
  page.on('pageerror', error => errors.push(error.message))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname
    if (path === '/api/auth/csrf') return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'test' } })
    const match = path.match(/^\/api\/habits\/(\d+)\/entries(?:\/(\d+))?$/)
    if (match) {
      const goal = Number(match[1]), id = Number(match[2]), list = records[goal]
      if (req.method() === 'GET') {
        const pageIndex = Number(url.searchParams.get('page')), size = Number(url.searchParams.get('size'))
        reads.push({ goal, page: pageIndex, size })
        assert.ok(size === 3 || size === 10)
        if (size === 3) assert.equal(pageIndex, 0)
        if (size === 10 && pageIndex === holdPage && gate) await gate
        if (size === 10 && pageIndex === failurePage) return route.fulfill({ status: 503, json: { detail: 'Nie udało się pobrać historii.' } })
        return route.fulfill({ json: { entries: list.slice(pageIndex * size, (pageIndex + 1) * size), totalElements: list.length, hasMore: (pageIndex + 1) * size < list.length } })
      }
      const method = req.method(), body = method === 'DELETE' ? undefined : req.postDataJSON()
      writes.push({ goal, id, method, body })
      assert.equal(req.headers()['x-csrf-token'], 'test')
      if (method === 'POST') {
        const added = { ...entry(100), ...body, createdAt: '2026-10-31T12:00:00Z' }
        records[goal].unshift(added); return route.fulfill({ status: 201, json: added })
      }
      if (method === 'PATCH') {
        const updated = { ...list.find(item => item.id === id), ...body, updatedAt: '2026-10-31T12:00:00Z' }
        records[goal] = list.map(item => item.id === id ? updated : item)
        return route.fulfill({ json: updated })
      }
      assert.equal(method, 'DELETE')
      records[goal] = list.filter(item => item.id !== id)
      return route.fulfill({ status: 204 })
    }
    const lifecycle = path.match(/^\/api\/habits\/(\d+)\/(status|ending)$/)
    if (lifecycle) {
      const habit = goals.find(h => h.id === Number(lifecycle[1]))
      statusWrites.push({ id: habit.id, operation: lifecycle[2] })
      if (lifecycle[2] === 'status') habit.activityStatus = req.postDataJSON().status
      else { habit.endedOn = '2026-11-01'; habit.endReason = req.postDataJSON().reason; habit.status = 'FINISHED' }
      return route.fulfill({ json: habit })
    }
    assert.equal(req.method(), 'GET', `Unexpected mutation: ${path}`)
    return route.fulfill({ json: path === '/api/habits' ? goals
      : path === '/api/users/me' ? { id: 1, login: 'test', points: 0, theme: 'PURPLE' }
      : path === '/api/tasks/overview' ? { tasks: [], completedCount: 0 } : [] })
  })
  const card = id => page.locator('li').filter({ has: page.getByRole('button', { name: `Więcej opcji dla nawyku „Nawyk ${id}”`, exact: true }) }).first()
  const journal = id => card(id).locator('.goal-journal')
  const item = (goal, id) => journal(goal).locator(`[data-entry-id="${id}"]`)
  const all = goal => journal(goal).getByRole('button', { name: /^Pokaż wszystkie wpisy/ })
  const more = goal => journal(goal).getByRole('button', { name: 'Pokaż więcej wpisów', exact: true })
  const less = goal => journal(goal).locator('.goal-journal-history-actions').getByRole('button', { name: 'Pokaż mniej', exact: true })
  const toggle = goal => journal(goal).getByRole('heading')
  const form = goal => journal(goal).getByRole('form')
  const ids = goal => journal(goal).locator('.goal-journal-entry').evaluateAll(nodes => nodes.map(node => Number(node.dataset.entryId)))
  async function open(goal) {
    await card(goal).locator('.task-menu-trigger').first().click()
    await page.getByRole('menuitem', { name: 'Dziennik nawyku', exact: true }).click()
  }
  async function waitCount(goal, count) {
    await page.waitForFunction(({ goal, count }) => document.querySelectorAll(`#habit-journal-${goal} .goal-journal-entry`).length === count, { goal, count })
    await page.waitForFunction(goal => !document.querySelector(`#habit-journal-${goal} .goal-journal-content [role="status"]`), goal)
  }
  async function action(goal, id, name) {
    await item(goal, id).locator('.task-menu-trigger').click(); await page.getByRole('menuitem', { name, exact: true }).click()
  }
  async function remove(goal, id) {
    await action(goal, id, 'Usuń')
    await page.getByRole('dialog').getByRole('button', { name: 'Usuń', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
  }
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5197')
  await page.getByRole('navigation', { name: 'Widoki aplikacji' }).getByRole('button', { name: 'Nawyki', exact: true }).click()
  await page.locator('.habit-waiting-section > summary').click()
  assert.equal(reads.length, 0)
  for (const [goal, count] of [[4, 0], [5, 1], [6, 3], [2, 3]]) {
    await open(goal); await waitCount(goal, count)
    assert.equal(await all(goal).count(), goal === 2 ? 1 : 0)
  }
  await all(2).click(); await waitCount(2, 4)
  await remove(2, 4); await waitCount(2, 3)
  assert.equal(await all(2).count(), 0); assert.equal(await less(2).count(), 0)
  await open(1); await waitCount(1, 3)
  assert.deepEqual(reads.filter(read => read.goal === 1), [{ goal: 1, page: 0, size: 3 }])
  failurePage = 0
  await all(1).click(); await journal(1).getByRole('alert').waitFor()
  assert.equal((await ids(1)).length, 3)
  assert.equal(await toggle(1).innerText(), 'Dziennik nawyku (25)')
  failurePage = -1; holdPage = 0; gate = new Promise(done => { release = done })
  await journal(1).getByRole('button', { name: 'Spróbuj ponownie' }).click()
  await journal(1).getByRole('status').waitFor()
  assert.equal((await ids(1)).length, 3)
  release(); gate = undefined; holdPage = -1
  await waitCount(1, 10)
  const readCount = reads.length
  await item(1, 25).getByRole('button', { name: 'Pokaż więcej', exact: true }).click()
  await item(1, 25).getByRole('button', { name: 'Pokaż mniej', exact: true }).click()
  assert.equal(reads.length, readCount)
  failurePage = 1
  await more(1).click(); await journal(1).getByRole('alert').waitFor()
  assert.equal((await ids(1)).length, 10)
  failurePage = -1; holdPage = 1; gate = new Promise(done => { release = done })
  await journal(1).getByRole('button', { name: 'Spróbuj ponownie' }).click()
  await journal(1).getByRole('status').waitFor()
  assert.equal(await journal(1).getByRole('button', { name: 'Ładowanie…', exact: true }).isDisabled(), true)
  release(); gate = undefined; holdPage = -1
  await waitCount(1, 20)
  assert.deepEqual(await ids(1), Array.from({ length: 20 }, (_, index) => 25 - index))
  await action(1, 7, 'Edytuj')
  await form(1).getByRole('textbox', { name: /Treść/ }).fill('Niezapisany starszy wpis')
  await less(1).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Kontynuuj edycję' }).click()
  assert.equal(await form(1).getByRole('textbox', { name: /Treść/ }).inputValue(), 'Niezapisany starszy wpis')
  await less(1).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Odrzuć zmiany' }).click()
  await waitCount(1, 3)
  await page.waitForFunction(() => document.activeElement?.id === 'habit-journal-heading-1')
  const readsBeforeReopen = reads.length
  await all(1).click(); await waitCount(1, 20)
  assert.equal(reads.length, readsBeforeReopen)
  const beforeEdit = reads.length
  await action(1, 7, 'Edytuj')
  await form(1).getByRole('textbox', { name: /Treść/ }).fill('Starszy wpis po edycji')
  await form(1).getByRole('button', { name: 'Zapisz', exact: true }).click()
  await form(1).waitFor({ state: 'detached' })
  assert.equal(reads.length, beforeEdit)
  assert.equal((await ids(1)).indexOf(7), 18)
  await journal(1).getByRole('button', { name: 'Dodaj wpis do dziennika', exact: true }).click()
  await form(1).getByRole('textbox', { name: /Treść/ }).fill('Nowy wpis podczas historii')
  await form(1).getByRole('button', { name: 'Dodaj', exact: true }).click()
  await form(1).waitFor({ state: 'detached' }); await waitCount(1, 20)
  assert.deepEqual(await ids(1), records[1].slice(0, 20).map(item => item.id))
  assert.equal(await toggle(1).innerText(), 'Dziennik nawyku (26)')
  await remove(1, 10); await waitCount(1, 20)
  assert.deepEqual(await ids(1), records[1].slice(0, 20).map(item => item.id))
  assert.equal(await toggle(1).innerText(), 'Dziennik nawyku (25)')
  await remove(1, 100); await waitCount(1, 20)
  assert.deepEqual(await ids(1), records[1].slice(0, 20).map(item => item.id))
  // A change outside this client shifts page boundaries. Extending reconciles the loaded prefix.
  records[1] = records[1].filter(item => item.id !== 23)
  await more(1).click(); await waitCount(1, 23)
  assert.deepEqual(await ids(1), records[1].map(item => item.id))
  assert.equal(await more(1).count(), 0)
  assert.equal(await toggle(1).innerText(), 'Dziennik nawyku (23)')
  const cached = reads.length
  await less(1).click(); await waitCount(1, 3)
  assert.equal(await toggle(1).evaluate(el => el === document.activeElement), true)
  assert.ok(await toggle(1).evaluate(el => el.getBoundingClientRect().bottom > 0 && el.getBoundingClientRect().top < innerHeight))
  assert.equal(reads.length, cached)
  await all(1).focus(); await page.keyboard.press('Enter'); await waitCount(1, 23)
  assert.equal(reads.length, cached)
  for (const width of [320, 360, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.ok(await journal(1).evaluate(el => el.scrollWidth <= el.clientWidth))
    if (width === 360) await journal(1).screenshot({ path: '../.local-backups/habit-journal-history.png' })
  }
  await open(5); await waitCount(5, 1)
  assert.equal(await all(5).count(), 0)
  await page.locator('.habit-finished-section:not(.habit-waiting-section) > summary').click()
  await open(3); await waitCount(3, 3)
  await all(3).click(); await waitCount(3, 10)
  await more(3).click(); await waitCount(3, 20)
  await more(3).click(); await waitCount(3, 25)
  assert.equal(await journal(3).locator('.task-menu-trigger').count(), 0)
  assert.equal(await journal(3).getByRole('button', { name: 'Dodaj wpis do dziennika', exact: true }).count(), 0)
  assert.equal(writes.filter(write => write.goal === 3).length, 0)
  const savedEntries = JSON.stringify(records), journalReads = reads.length, journalWrites = writes.length
  const week = await page.locator('.week-range').innerText()
  await open(1); await waitCount(1, 3)
  await all(1).click(); await waitCount(1, 23)
  await card(1).locator('.task-menu-trigger').first().click()
  await page.getByRole('menuitem', { name: 'Wstrzymaj nawyk', exact: true }).click()
  await page.locator('.habit-waiting-card').filter({ hasText: 'Nawyk 1' }).waitFor()
  await waitCount(1, 23)
  assert.equal(await journal(1).getByRole('button', { name: 'Dodaj wpis do dziennika', exact: true }).count(), 1)
  await card(1).getByRole('button', { name: 'Wznów nawyk: Nawyk 1', exact: true }).click()
  await page.locator('.habit-card').filter({ has: page.getByRole('button', { name: 'Więcej opcji dla nawyku „Nawyk 1”', exact: true }) }).waitFor()
  await waitCount(1, 23)
  await open(6); await waitCount(6, 3)
  await card(6).getByRole('button', { name: 'Rozpocznij nawyk: Nawyk 6', exact: true }).click()
  await page.locator('.habit-card').filter({ hasText: 'Nawyk 6' }).waitFor()
  await waitCount(6, 3)
  await open(1); await all(1).click(); await waitCount(1, 23)
  await action(1, 7, 'Edytuj')
  await form(1).getByRole('textbox').fill('Szkic przed zakończeniem')
  await card(1).locator('.task-menu-trigger').first().click()
  await page.getByRole('menuitem', { name: 'Zakończ nawyk', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Kontynuuj edycję' }).click()
  assert.equal(await form(1).getByRole('textbox').inputValue(), 'Szkic przed zakończeniem')
  assert.equal(statusWrites.length, 3)
  await card(1).locator('.task-menu-trigger').first().click()
  await page.getByRole('menuitem', { name: 'Zakończ nawyk', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Odrzuć zmiany' }).click()
  await page.getByRole('dialog').getByRole('radio', { name: 'Osiągnąłem zamierzony efekt' }).check()
  await page.getByRole('dialog').getByRole('button', { name: 'Zakończ nawyk', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  await waitCount(1, 23)
  assert.equal(await journal(1).locator('.task-menu-trigger').count(), 0)
  assert.equal(await journal(1).getByRole('button', { name: 'Dodaj wpis do dziennika', exact: true }).count(), 0)
  assert.equal(JSON.stringify(records), savedEntries)
  assert.equal(reads.length, journalReads)
  assert.equal(writes.length, journalWrites)
  assert.equal(await page.locator('.week-range').innerText(), week)
  assert.equal(await card(1).getByRole('checkbox').isChecked(), false)
  await page.getByText('Saldo 0 pkt', { exact: true }).waitFor()
  assert.equal(await page.locator('.habit-waiting-section > summary').getAttribute('aria-expanded'), 'true')
  // Extending an automatically finished habit restores writes without losing cached pages.
  goals.find(h => h.id === 6).endDate = '2026-10-31'
  await page.getByRole('button', { name: 'Poprzedni tydzień', exact: true }).click()
  await open(6); await waitCount(6, 3)
  assert.equal(await journal(6).locator('.task-menu-trigger').count(), 0)
  goals.find(h => h.id === 6).endDate = '2099-12-31'
  await page.getByRole('button', { name: 'Następny tydzień', exact: true }).click()
  await open(6); await waitCount(6, 3)
  assert.equal(await journal(6).locator('.task-menu-trigger').count(), 3)
  assert.equal(reads.length, journalReads)
  assert.equal(JSON.stringify(records), savedEntries)
  // External refresh remounts the card in another group: keep the draft, block writes.
  await action(6, 3, 'Edytuj')
  await form(6).getByRole('textbox').fill('Szkic po zmianie statusu w innej sesji')
  Object.assign(goals.find(h => h.id === 6), { endedOn: '2026-11-01', status: 'FINISHED' })
  // The existing account refresh gate throttles focus events for ten seconds.
  await page.waitForTimeout(10_100)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.waitForFunction(() => document.querySelector('#habit-journal-6 textarea')?.readOnly)
  const finishedSection = page.locator('.habit-finished-section:not(.habit-waiting-section)')
  if (!(await finishedSection.evaluate(el => el.open))) await finishedSection.locator('summary').click()
  assert.equal(await form(6).getByRole('textbox').inputValue(), 'Szkic po zmianie statusu w innej sesji')
  assert.equal(await form(6).getByRole('button', { name: 'Zapisz', exact: true }).isDisabled(), true)
  await form(6).getByRole('alert').waitFor()
  await form(6).evaluate(el => el.requestSubmit())
  assert.equal(writes.length, journalWrites)
  assert.equal(JSON.stringify(records), savedEntries)
  await form(6).getByRole('button', { name: 'Anuluj', exact: true }).click()
  assert.deepEqual(errors, [])
  console.log('PASS: compact 0/1/3/4/25, 10-entry pages, retry/load states, cached show less/all, older edit, create/delete boundary synchronization, external changes, achieved history, focus/keyboard, mobile/desktop')
} finally { await browser.close() }
