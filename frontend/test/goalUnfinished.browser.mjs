import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message) })
  const milestones = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, title: `Kamień ${i + 1}`, position: i, completed: i < 2 }))
  const tasks = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, title: `Zadanie ${i + 1}`, completed: i < 2,
    points: 5, description: '', inFocus: true, dueDate: null, dueTime: null, category: null,
    goalId: 1, goalTitle: 'Cel testowy', subtaskCount: 0, completedSubtaskCount: 0 }))
  const habits = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, name: `Nawyk ${i + 1}`,
    createdOn: '2026-10-01', startDate: '2026-10-01', endDate: null, endReason: null,
    completionLimit: null, completionBonusPoints: null, requiredSuccessPercent: null, regularity: null,
    completionBonusGranted: false, completionBonusEverGranted: false, completionBonusConditionsLocked: false,
    completionBonusTargetLocked: false, completionBonusSettledOn: null, completionBonusAwardPoints: null,
    activityStatus: 'ACTIVE', status: 'ACTIVE', completed: true, weeklyCompletedDays: i < 2 ? 3 : 1,
    target: { targetDays: 3 }, latestTarget: { targetDays: 3 }, rewardPoints: 3, goalIds: [1], goalTitles: ['Cel testowy'],
    endedOn: null, description: '', totalCompletions: 10, weeklyRewardGranted: false }))
  // A reward already granted and today's completion do not imply a reached weekly target.
  habits[2].weeklyRewardGranted = true
  habits[3].target = null
  let rejectMilestone = true, rejectTask = true
  const writes = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (req.method() !== 'GET') writes.push({ path, method: req.method() })
    let body = []
    if (path === '/api/auth/csrf') body = { headerName: 'X-CSRF-TOKEN', token: 'test' }
    else if (path === '/api/users/me') body = { id: 1, login: 'test', points: 37, theme: 'PURPLE' }
    else if (path === '/api/tasks/overview') body = { tasks: tasks.filter(t => !t.completed), completedCount: 2 }
    else if (path === '/api/goals') body = [{ id: 1, title: 'Cel testowy', completed: false, currentState: '', desiredOutcome: '' }]
    else if (path === '/api/goals/1/milestones') body = milestones
    else if (/\/milestones\/\d+\/completion$/.test(path)) {
      if (rejectMilestone) { rejectMilestone = false; return route.fulfill({ status: 500, json: { detail: 'Błąd zapisu' } }) }
      body = milestones.find(m => m.id === Number(path.split('/')[5])); body.completed = true
    }
    else if (path === '/api/goals/1/tasks') body = tasks
    else if (/^\/api\/tasks\/\d+(\/completion)?$/.test(path)) {
      body = tasks.find(t => t.id === Number(path.split('/')[3]))
      if (req.method() === 'PATCH') {
        if (rejectTask) { rejectTask = false; return route.fulfill({ status: 500, json: { detail: 'Błąd zapisu' } }) }
        body.completed = true
      }
    }
    else if (path === '/api/goals/1/habits') body = habits.map(({ id, name }) => ({ id, name }))
    else if (path === '/api/habits') body = habits
    await route.fulfill({ json: body })
  })
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5197')
  const nav = page.getByRole('navigation', { name: 'Widoki aplikacji' })
  async function openGoal() {
    await nav.getByRole('button', { name: 'Cele', exact: true }).click()
    await page.getByRole('button', { name: 'Cel testowy', exact: true }).click()
  }
  async function count(tab, value) {
    await page.locator(`#goal-tab-${tab}-1 .goal-tab-count`).filter({ hasText: new RegExp(`^${value}$`) }).waitFor()
  }
  await openGoal()
  const ms = page.locator('#goal-milestones-1')
  await count('milestones', 4)
  assert.equal(await ms.getByRole('checkbox').count(), 3)
  await ms.getByRole('button', { name: 'Pokaż wszystkie (4)' }).click()
  assert.equal(await ms.getByRole('checkbox').count(), 4)
  assert.equal(await ms.getByText('Kamień 1', { exact: true }).count(), 0)
  await ms.getByRole('checkbox', { name: 'Kamień 3', exact: true }).click()
  await ms.getByRole('alert').waitFor()
  await count('milestones', 4)
  assert.equal(await ms.getByRole('checkbox', { name: 'Kamień 3', exact: true }).isChecked(), false)
  for (let id = 3; id <= 6; id++) {
    await ms.getByRole('checkbox', { name: `Kamień ${id}`, exact: true }).click()
    await count('milestones', 6 - id)
  }
  await ms.getByText('Wszystkie kamienie milowe ukończone').waitFor()
  assert.equal(await ms.getByRole('button', { name: /Pokaż/ }).count(), 0)
  await page.locator('#goal-tab-tasks-1').click()
  const ts = page.locator('#goal-tasks-1')
  await count('tasks', 4)
  assert.equal(await ts.getByRole('checkbox').count(), 3)
  await ts.getByRole('button', { name: 'Pokaż wszystkie (4)' }).click()
  assert.equal(await ts.getByRole('checkbox').count(), 4)
  await ts.getByRole('checkbox', { name: 'Wykonane: Zadanie 3', exact: true }).click()
  await ts.getByRole('alert').waitFor()
  await count('tasks', 4)
  for (let id = 3; id <= 6; id++) {
    await ts.getByRole('checkbox', { name: `Wykonane: Zadanie ${id}`, exact: true }).click()
    await count('tasks', 6 - id)
  }
  await ts.getByText('Wszystkie zadania ukończone').waitFor()
  assert.equal(await ts.getByRole('checkbox').count(), 0)
  await page.locator('#goal-tab-habits-1').click()
  const hs = page.locator('#goal-habits-1')
  await count('habits', 4)
  assert.equal(await hs.locator('.goal-linked-habit').count(), 3)
  await hs.getByRole('button', { name: 'Pokaż wszystkie (4)' }).click()
  assert.equal(await hs.locator('.goal-linked-habit').count(), 4)
  assert.equal(await hs.getByText('Nawyk 1', { exact: true }).count(), 0)
  await hs.getByRole('button', { name: 'Pokaż mniej' }).click()
  assert.equal(await hs.locator('.goal-linked-habit').count(), 3)
  // Reload current weekly data: fulfilled targets disappear, then reappear after reset.
  habits.forEach(h => { h.target = { targetDays: 3 }; h.weeklyCompletedDays = 3 })
  await page.reload(); await openGoal(); await page.locator('#goal-tab-habits-1').click()
  await hs.getByText('Cele tygodniowe wszystkich nawyków osiągnięte').waitFor()
  await count('habits', 0)
  habits.forEach(h => { h.weeklyCompletedDays = 0 })
  await page.reload(); await openGoal(); await page.locator('#goal-tab-habits-1').click()
  await count('habits', 6)
  assert.equal(await hs.locator('.goal-linked-habit').count(), 3)
  assert.equal(milestones.length, 6); assert.equal(tasks.length, 6); assert.equal(habits.length, 6)
  assert.ok(writes.every(w => w.path.endsWith('/completion')))
  assert.deepEqual(errors, [])
  console.log('PASS: goal unfinished counts, previews, completion, rollback, weekly targets and reset')
} finally { await browser.close() }


