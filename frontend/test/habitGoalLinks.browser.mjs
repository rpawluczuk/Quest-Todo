import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, hasTouch: true })
  await page.clock.install({ time: new Date('2026-11-25T12:00:00Z') })
  const base = { createdOn: '2026-11-25', startDate: '2026-11-25', endDate: null, endedOn: null,
    endReason: null, status: 'ACTIVE', activityStatus: 'ACTIVE', completed: false, weeklyRewardGranted: false,
    rewardPoints: 1, description: '', completionLimit: null, completionBonusPoints: null,
    requiredSuccessPercent: null, totalCompletions: 0, weeklyCompletedDays: 0,
    target: { targetDays: 7, effectiveFrom: '2026-11-23' }, latestTarget: { targetDays: 7, effectiveFrom: '2026-11-23' },
    category: null, goalIds: [], goalTitles: [], regularity: null, completionBonusGranted: false,
    completionBonusEverGranted: false, completionBonusConditionsLocked: false, completionBonusTargetLocked: false,
    completionBonusSettledOn: null, completionBonusAwardPoints: null }
  const habits = [{ ...base, id: 1, name: 'Czytanie' }]
  const goals = [{ id: 11, title: 'Rozwój', completed: false }, { id: 12, title: 'Zdrowie', completed: false }]
  const writes = [], errors = []
  let rejectSave = false
  page.on('pageerror', error => errors.push(error.message))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    let body = []
    if (path === '/api/users/me') body = { id: 1, login: 'test', points: 0, theme: 'PURPLE' }
    else if (path === '/api/auth/csrf') body = { headerName: 'X-CSRF-TOKEN', token: 'test' }
    else if (path === '/api/tasks/overview') body = { tasks: [], completedCount: 0 }
    else if (path === '/api/goals') body = goals
    else if (/^\/api\/goals\/\d+\/habits$/.test(path)) body = habits.filter(h => h.goalIds.includes(Number(path.split('/')[3]))).map(({ id, name }) => ({ id, name }))
    else if (path === '/api/habits' && req.method() === 'GET') body = habits
    else if ((path === '/api/habits' && req.method() === 'POST') || /^\/api\/habits\/\d+\/configuration$/.test(path)) {
      const data = req.postDataJSON()
      if (rejectSave) return route.fulfill({ status: 500, json: { detail: 'Zapis nie powiódł się.' } })
      writes.push({ path, goalIds: data.goalIds })
      const saved = { ...base, ...data, id: req.method() === 'POST' ? habits.length + 1 : Number(path.split('/')[3]),
        goalTitles: data.goalIds.map(id => goals.find(g => g.id === id).title) }
      if (req.method() === 'POST') { habits.push(saved); body = saved }
      else { habits.splice(habits.findIndex(h => h.id === saved.id), 1, saved); body = { habit: saved, balance: null, award: null } }
    }
    await route.fulfill({ json: body })
  })
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5173')
  const nav = page.getByRole('navigation', { name: 'Widoki aplikacji' })
  const goalHabits = page.locator('#goal-habits-11')
  const form = page.locator('dialog.habit-form-dialog')
  const tile = name => page.locator('#habits-page li.habit-card').filter({ has: page.getByText(name, { exact: true }) })
  async function selectGoal(name, checked = true) {
    await form.locator('.goal-multiselect-trigger').click()
    const picker = page.getByRole('dialog', { name: 'Wybierz cele', exact: true })
    if (page.viewportSize().width < 500) await picker.getByText(name, { exact: true }).tap()
    else await picker.getByText(name, { exact: true }).click()
    assert.equal(await picker.getByRole('checkbox', { name, exact: true }).isChecked(), checked)
    await page.keyboard.press('Escape')
  }
  async function edit(name) {
    await tile(name).locator('.task-menu-trigger').click()
    await tile(name).getByRole('menuitem', { name: 'Edytuj', exact: true }).click()
    await form.waitFor()
  }
  async function save() {
    await form.getByRole('button', { name: 'Zapisz', exact: true }).click()
    await form.waitFor({ state: 'hidden' })
  }
  // Keep the expanded goal mounted while editing from the Habits section.
  await nav.getByRole('button', { name: 'Cele', exact: true }).click()
  await page.getByRole('button', { name: 'Rozwój', exact: true }).click()
  await page.locator('#goal-tab-habits-11').click()
  await goalHabits.getByText('Brak przypisanych nawyków', { exact: true }).waitFor()
  await nav.getByRole('button', { name: 'Nawyki', exact: true }).click()
  await edit('Czytanie'); await selectGoal('Rozwój'); await save()
  assert.deepEqual(writes.at(-1).goalIds, [11])
  await tile('Czytanie').locator('.task-card-goals').getByText('Rozwój', { exact: true }).waitFor()
  await nav.getByRole('button', { name: 'Cele', exact: true }).click()
  await goalHabits.getByText('Czytanie', { exact: true }).waitFor()
  assert.equal(await page.locator('#goal-tab-habits-11 .goal-tab-count').innerText(), '1')
  await nav.getByRole('button', { name: 'Nawyki', exact: true }).click()
  await edit('Czytanie'); await selectGoal('Rozwój', false); await save()
  await nav.getByRole('button', { name: 'Cele', exact: true }).click()
  await goalHabits.getByText('Brak przypisanych nawyków', { exact: true }).waitFor()
  await nav.getByRole('button', { name: 'Nawyki', exact: true }).click()
  await page.setViewportSize({ width: 375, height: 844 })
  await page.getByRole('button', { name: 'Dodaj nawyk', exact: true }).click()
  await form.getByRole('textbox', { name: /^Nazwa nawyku/ }).fill('Nowy nawyk z celami')
  await selectGoal('Rozwój'); await selectGoal('Zdrowie')
  await form.locator('.goal-multiselect-trigger').focus()
  await page.keyboard.press('ArrowDown')
  const keyboardPicker = page.getByRole('dialog', { name: 'Wybierz cele', exact: true })
  await page.waitForFunction(() => document.querySelector('.goal-multiselect-popover input') === document.activeElement)
  await page.keyboard.press('Space')
  assert.equal(await keyboardPicker.getByRole('checkbox', { name: 'Rozwój', exact: true }).isChecked(), false)
  await page.keyboard.press('Space')
  assert.equal(await keyboardPicker.getByRole('checkbox', { name: 'Rozwój', exact: true }).isChecked(), true)
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab')
  await keyboardPicker.waitFor({ state: 'hidden' })
  rejectSave = true
  await form.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await form.getByRole('alert').filter({ hasText: 'Zapis nie powiódł' }).waitFor()
  const summary = await form.locator('.goal-multiselect-trigger').innerText()
  assert.match(summary, /Rozwój/); assert.match(summary, /Zdrowie/)
  rejectSave = false; await save()
  assert.deepEqual(writes.at(-1).goalIds.toSorted((a, b) => a - b), [11, 12])
  await nav.getByRole('button', { name: 'Cele', exact: true }).click()
  await goalHabits.getByText('Nowy nawyk z celami', { exact: true }).waitFor()
  assert.equal(await page.locator('#goal-tab-habits-11 .goal-tab-count').innerText(), '1')
  assert.deepEqual(errors, [])
  console.log('PASS: attaching/detaching goals from habit edit, creating with multiple goals, save failure/retry, refreshed goal lists/counts, desktop/mobile')
} finally { await browser.close() }
