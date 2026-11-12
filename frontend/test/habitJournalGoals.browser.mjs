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
  const parents = [1, 2, 3].map(id => ({ id, title: `Cel ${id}`, completed: id === 3, currentState: '', desiredOutcome: '', completedAt: id === 3 ? '2026-10-30T12:00:00Z' : null }))
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
    const links = path.match(/^\/api\/goals\/(\d+)\/habits(?:\/(\d+|available))?$/)
    if (links) {
      const id = Number(links[1])
      if (links[2] === 'available') return route.fulfill({ json: { habits: goals.filter(h => !h.goalIds.includes(id)), hasMore: false } })
      if (links[2]) {
        const habit = goals.find(h => h.id === Number(links[2]))
        habit.goalIds = habit.goalIds.filter(g => g !== id)
        if (req.method() === 'PUT') habit.goalIds.push(id)
        return route.fulfill({ status: 204 })
      }
      return route.fulfill({ json: goals.filter(h => h.goalIds.includes(id)).map(h => ({ id: h.id, name: h.name })) })
    }
    if (/^\/api\/goals\/\d+\/entries$/.test(path)) {
      assert.equal(req.method(), 'GET')
      return route.fulfill({ json: { entries: [entry(999, 'Independent goal journal')], totalElements: 1, hasMore: false } })
    }
    if (/^\/api\/goals\/\d+\/completion$/.test(path)) {
      const goal = parents.find(g => g.id === Number(path.split('/')[3]))
      goal.completed = req.postDataJSON().completed
      return route.fulfill({ json: goal })
    }
    if (/^\/api\/goals\/\d+$/.test(path) && req.method() === 'DELETE') {
      const id = Number(path.split('/')[3])
      parents.splice(parents.findIndex(g => g.id === id), 1)
      goals.forEach(h => { h.goalIds = h.goalIds.filter(g => g !== id) })
      return route.fulfill({ status: 204 })
    }
    if (/^\/api\/habits\/\d+$/.test(path) && req.method() === 'DELETE') {
      const id = Number(path.split('/')[3])
      goals.splice(goals.findIndex(h => h.id === id), 1)
      delete records[id]
      return route.fulfill({ status: 204 })
    }
    assert.equal(req.method(), 'GET', `Unexpected mutation: ${path}`)
    return route.fulfill({ json: path === '/api/habits' ? goals : path === '/api/goals' ? parents
      : path === '/api/users/me' ? { id: 1, login: 'test', points: 0, theme: 'PURPLE' }
      : path === '/api/tasks/overview' ? { tasks: [], completedCount: 0 } : [] })
  })
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5197')
  const nav = page.getByRole('navigation', { name: 'Widoki aplikacji' })
  const parent = id => page.locator(`#goal-card-${id}`)
  const row = (goal, habit) => page.locator(`#goal-habits-${goal} [data-habit-id="${habit}"]`)
  const journal = (goal, habit = 1) => page.locator(`#goal-${goal}-habit-journal-${habit}`)
  const form = panel => panel.getByRole('form')
  const entries = panel => panel.locator('.goal-journal-entry')
  async function menu(target, label) {
    await target.locator('.task-menu-trigger').first().click()
    await page.getByRole('menuitem', { name: label, exact: true }).click()
  }
  async function openGoal(id) {
    await nav.getByRole('button', { name: 'Cele', exact: true }).click()
    await parent(id).getByRole('button', { name: `Cel ${id}`, exact: true }).click()
    await page.locator(`#goal-tab-habits-${id}`).click()
    await row(id, 1).waitFor()
  }
  async function openJournal(goal, habit = 1) {
    await menu(row(goal, habit), 'Dziennik nawyku')
    await entries(journal(goal, habit)).first().waitFor()
  }
  async function add(panel, content) {
    await panel.getByRole('button', { name: 'Dodaj wpis do dziennika', exact: true }).click()
    await form(panel).getByRole('textbox').fill(content)
    await form(panel).getByRole('button', { name: 'Dodaj', exact: true }).click()
    await form(panel).waitFor({ state: 'detached' })
  }
  async function discard(keep = false) {
    await page.getByRole('dialog').getByRole('button', { name: keep ? 'Kontynuuj edycję' : 'Odrzuć zmiany', exact: true }).click()
  }
  await openGoal(1)
  assert.equal(reads.length, 0)
  await openJournal(1)
  assert.deepEqual(reads, [{ goal: 1, page: 0, size: 3 }])
  await parent(1).getByRole('button', { name: /^Dziennik celu/ }).click()
  await parent(1).getByText('Independent goal journal', { exact: true }).waitFor()
  await add(journal(1), 'Wspólny wpis z celu A')
  assert.equal(await journal(1).getByRole('heading').innerText(), 'Dziennik nawyku (26)')
  assert.equal(await parent(1).getByRole('button', { name: /^Dziennik celu/ }).innerText(), 'Dziennik celu (1)')
  await openGoal(2); await openJournal(2)
  await journal(2).getByText('Wspólny wpis z celu A', { exact: true }).waitFor()
  assert.equal(reads.length, 1)
  await menu(journal(2).locator('[data-entry-id="100"]'), 'Edytuj')
  await form(journal(2)).getByRole('textbox').fill('Wspólny wpis po edycji')
  // Every navigation path offers the existing discard dialog.
  await page.locator('#goal-tab-tasks-2').click(); await discard(true)
  assert.equal(await page.locator('#goal-tab-habits-2').getAttribute('aria-selected'), 'true')
  await parent(2).getByRole('button', { name: 'Cel 2', exact: true }).click(); await discard(true)
  await parent(1).getByRole('button', { name: 'Cel 1', exact: true }).click(); await discard(true)
  await menu(row(2, 2), 'Dziennik nawyku'); await discard(true)
  await menu(row(2, 1), 'Odepnij od celu'); await discard(true)
  await nav.getByRole('button', { name: 'Nawyki', exact: true }).click(); await discard(true)
  await form(journal(2)).getByRole('button', { name: 'Zapisz', exact: true }).click()
  await form(journal(2)).waitFor({ state: 'detached' })
  await nav.getByRole('button', { name: 'Nawyki', exact: true }).click()
  const mainCard = page.locator('#habits-page li').filter({ has: page.getByRole('button', { name: 'Więcej opcji dla nawyku „Nawyk 1”', exact: true }) }).first()
  await menu(mainCard, 'Dziennik nawyku')
  const main = page.locator('#habit-journal-1')
  await main.getByText('Wspólny wpis po edycji', { exact: true }).waitFor()
  assert.equal(reads.length, 1)
  await menu(main.locator('[data-entry-id="100"]'), 'Usuń')
  await page.getByRole('dialog').getByRole('button', { name: 'Usuń', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  await main.getByRole('button', { name: 'Dodaj wpis do dziennika', exact: true }).click()
  await form(main).getByRole('textbox').fill('Niezapisany szkic z Nawyków')
  await nav.getByRole('button', { name: 'Cele', exact: true }).click(); await discard(true)
  assert.equal(await form(main).getByRole('textbox').inputValue(), 'Niezapisany szkic z Nawyków')
  await nav.getByRole('button', { name: 'Cele', exact: true }).click(); await discard()
  assert.equal(await journal(2).getByText('Wspólny wpis po edycji', { exact: true }).count(), 0)
  assert.equal(await journal(2).getByRole('heading').innerText(), 'Dziennik nawyku (25)')
  // Unlink only the relation, then attach the same habit with its original journal.
  const saved = JSON.stringify(records)
  await menu(row(2, 1), 'Odepnij od celu')
  await row(2, 1).waitFor({ state: 'detached' })
  assert.equal(JSON.stringify(records), saved)
  await parent(2).getByRole('button', { name: 'Dodaj nawyk do celu', exact: true }).click()
  await page.getByRole('menuitem', { name: /Przypnij istniejące/ }).click()
  await page.getByRole('button', { name: 'Przypnij nawyk: Nawyk 1', exact: true }).click()
  await page.getByRole('button', { name: 'Gotowe', exact: true }).click()
  await openJournal(2)
  assert.equal(JSON.stringify(records), saved)
  await journal(2).getByRole('button', { name: /^Pokaż wszystkie/ }).click()
  await page.waitForFunction(() => document.querySelectorAll('#goal-2-habit-journal-1 .goal-journal-entry').length === 10)
  await journal(2).getByRole('button', { name: 'Pokaż więcej wpisów', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('#goal-2-habit-journal-1 .goal-journal-entry').length === 20)
  for (const width of [320, 360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.ok(await journal(2).evaluate(el => el.scrollWidth <= el.clientWidth))
    await menu(journal(2).locator('[data-entry-id="24"]'), 'Edytuj')
    await form(journal(2)).getByRole('textbox').fill('Długi tekst '.repeat(100))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await form(journal(2)).getByRole('button', { name: 'Anuluj', exact: true }).click()
    if (width === 360) await journal(2).screenshot({ path: '../.local-backups/habit-journal-goals.png' })
  }
  // Active, paused, planned and finished habits retain their own permissions.
  for (const id of [2, 3, 5, 6]) {
    await openJournal(2, id)
    assert.equal(await journal(2, id).getByRole('button', { name: 'Dodaj wpis do dziennika', exact: true }).count(), id === 3 ? 0 : 1)
  }
  await page.getByRole('button', { name: /Osiągnięte/ }).click()
  await openGoal(3); await openJournal(3)
  assert.equal(await journal(3).getByRole('button', { name: 'Dodaj wpis do dziennika', exact: true }).count(), 0)
  assert.equal(await journal(3).locator('.task-menu-trigger').count(), 0)
  await journal(3).getByRole('button', { name: /^Pokaż wszystkie/ }).click()
  await page.waitForFunction(() => document.querySelectorAll('#goal-3-habit-journal-1 .goal-journal-entry').length === 20)
  await menu(parent(3), 'Wznów cel')
  await openGoal(3); await openJournal(3)
  await journal(3).getByRole('button', { name: 'Dodaj wpis do dziennika', exact: true }).waitFor()
  await menu(parent(3), 'Usuń')
  await parent(3).waitFor({ state: 'detached' })
  assert.equal(JSON.stringify(records), saved)
  await nav.getByRole('button', { name: 'Nawyki', exact: true }).click()
  assert.equal(await main.getByRole('button', { name: 'Dodaj wpis do dziennika', exact: true }).count(), 1)
  assert.equal(await mainCard.getByRole('checkbox').isChecked(), false)
  await page.getByText('Saldo 0 pkt', { exact: true }).waitFor()
  // A deleted habit disappears from both lists; unrelated journals remain intact.
  const otherEntries = JSON.stringify(records[2])
  await menu(mainCard, 'Usuń')
  await mainCard.waitFor({ state: 'detached' })
  assert.equal(await main.count(), 0)
  await nav.getByRole('button', { name: 'Cele', exact: true }).click()
  await parent(2).getByRole('button', { name: 'Cel 2', exact: true }).click()
  await page.locator('#goal-tab-habits-2').click()
  await row(2, 2).waitFor()
  assert.equal(await row(2, 1).count(), 0)
  await openJournal(2, 2)
  assert.equal(JSON.stringify(records[2]), otherEntries)
  assert.deepEqual(errors, [])
  console.log('PASS: shared habit journal across goals/main, independent goal journal, CRUD/cache, navigation draft guards, attach/unlink/delete goal, context read-only/resume, habit statuses, history, mobile/tablet/desktop')
} finally { await browser.close() }
