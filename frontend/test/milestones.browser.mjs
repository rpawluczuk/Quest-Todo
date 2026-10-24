import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 800 } })
  page.on('pageerror', error => console.error(error.message))
  const milestones = []
  let failCreate = false
  let failCompletion = false
  let failChange = false
  let orderFailure = 0
  let orderWrites = 0
  const availableTask = {
    id: 101, title: 'Konsultacja GPT', description: null, points: 5, completed: false,
    completedAt: null, inFocus: true, dueDate: '2026-10-30', dueTime: '21:52', category: null,
    goalId: null, goalTitle: null,
  }
  const longAvailableTask = {
    ...availableTask, id: 102, title: 'Bardzo długie zadanie przypięte do celu, które zawija się naturalnie na małym ekranie telefonu',
    points: 1000, inFocus: false, dueDate: null, dueTime: null,
  }
  const availableHabit = {
    id: 201, name: 'Bardzo długi nawyk przypięty do celu, którego nazwa zawija się na telefonie',
    weeklyCompletedDays: 1, rewardPoints: 2, target: { targetDays: 3, effectiveFrom: '2026-10-19' },
  }
  const attachedTasks = []
  const attachedHabits = []
  const longGoalTitle = 'Bardzo długi cel, którego nazwa zawija się na kilku liniach na małym ekranie telefonu'
  const longCurrentState = 'To jest długi opis obecnej sytuacji. '.repeat(18)
  const longDesiredOutcome = 'To jest szczegółowy opis zamierzonego rezultatu. '.repeat(18)
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    let body = []
    if (path === '/api/users/me') body = { id: 1, login: 'test', points: 0, theme: 'PURPLE' }
    else if (path === '/api/tasks/overview') body = { tasks: [], completedCount: 0 }
    else if (path === '/api/tasks/101') body = availableTask
    else if (path === '/api/tasks/101/completion') {
      availableTask.completed = route.request().postDataJSON().completed
      body = availableTask
    }
    else if (path === '/api/habits') body = [availableHabit]
    else if (path === '/api/auth/csrf') body = { headerName: 'X-CSRF-TOKEN', token: 'test' }
    else if (path.includes('email')) body = { verifiedEmail: null }
    else if (path === '/api/goals') body = [
      { id: 1, title: 'Przebiegam 5 km', currentState: longCurrentState, desiredOutcome: longDesiredOutcome },
      { id: 2, title: longGoalTitle, currentState: 'Krótki opis.', desiredOutcome: 'Linia pierwsza\nLinia druga\nLinia trzecia' },
      { id: 3, title: 'Cel bez opisu', currentState: null, desiredOutcome: null },
    ]
    else if (path === '/api/goals/1/tasks/available') body = { tasks: [availableTask, longAvailableTask], hasMore: false }
    else if (path === '/api/goals/1/tasks') body = attachedTasks
    else if (/^\/api\/goals\/1\/tasks\/\d+$/.test(path)) {
      const task = [availableTask, longAvailableTask].find(item => item.id === Number(path.split('/').at(-1)))
      if (route.request().method() === 'PUT' && task && !attachedTasks.some(item => item.id === task.id)) attachedTasks.push(task)
    }
    else if (path === '/api/goals/1/habits/available') body = { habits: [availableHabit], hasMore: false }
    else if (path === '/api/goals/1/habits') body = attachedHabits
    else if (path === '/api/goals/1/habits/201') {
      if (route.request().method() === 'PUT' && attachedHabits.length === 0) attachedHabits.push(availableHabit)
      if (route.request().method() === 'DELETE') attachedHabits.splice(0, attachedHabits.length)
    }
    else if (path === '/api/goals/1/milestones/order') {
      orderWrites++
      if (orderFailure) return route.fulfill({ status: orderFailure, json: { detail: 'Nie udało się zapisać kolejności.' } })
      const ids = route.request().postDataJSON().milestoneIds
      const reordered = ids.map((id, position) => ({ ...milestones.find(item => item.id === id), position }))
      milestones.splice(0, milestones.length, ...reordered)
      body = milestones
    }
    else if (path.endsWith('/completion')) {
      if (failCompletion) return route.fulfill({ status: 503, json: { detail: 'Nie udało się zapisać ukończenia.' } })
      const item = milestones.find(value => value.id === Number(path.split('/')[5]))
      item.completed = route.request().postDataJSON().completed
      body = item
    }
    else if (/^\/api\/goals\/1\/milestones\/\d+$/.test(path)) {
      if (failChange) return route.fulfill({ status: 503, json: { detail: 'Nie udało się zapisać zmiany.' } })
      const index = milestones.findIndex(value => value.id === Number(path.split('/')[5]))
      if (route.request().method() === 'DELETE') {
        milestones.splice(index, 1)
        return route.fulfill({ status: 204 })
      }
      milestones[index].title = route.request().postDataJSON().title
      body = milestones[index]
    }
    else if (path === '/api/goals/1/milestones') {
      if (route.request().method() === 'POST') {
        if (failCreate) return route.fulfill({ status: 503, json: { detail: 'Nie udało się dodać kamienia milowego.' } })
        const { title } = route.request().postDataJSON()
        body = { id: milestones.length + 1, title, completed: false, position: milestones.length }
        milestones.push(body)
      } else body = milestones
    }
    await route.fulfill({ status: route.request().method() === 'POST' ? 201 : 200,
      contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(process.env.MILESTONES_TEST_URL ?? 'http://127.0.0.1:5186')
  await page.getByRole('button', { name: 'Cele', exact: true }).click()
  async function expectSuccessCriterionField(form) {
    const field = form.locator('.goal-definition-field').filter({ hasText: 'Kiedy uznam cel za osiągnięty?' })
    await field.waitFor()
    await field.getByText('Opisz konkretny rezultat lub warunki, po których poznasz, że cel został osiągnięty.',
      { exact: true }).waitFor()
    return field
  }
  await page.getByRole('button', { name: 'Dodaj cel', exact: true }).click()
  const createGoalForm = page.locator('.goal-form').filter({ has: page.getByRole('button', { name: 'Dodaj cel', exact: true }) })
  await createGoalForm.getByRole('button', { name: '+ Doprecyzuj cel', exact: true }).click()
  await expectSuccessCriterionField(createGoalForm)
  await createGoalForm.getByRole('button', { name: 'Anuluj', exact: true }).click()
  const firstGoalCard = page.locator('.goal-card').first()
  await firstGoalCard.locator('.task-menu-trigger').click()
  await page.getByRole('menuitem', { name: 'Edytuj', exact: true }).click()
  const editGoalForm = firstGoalCard.locator('.goal-edit-form')
  const editSuccessField = await expectSuccessCriterionField(editGoalForm)
  assert.equal(await editSuccessField.locator('textarea').inputValue(), longDesiredOutcome)
  await editGoalForm.getByRole('button', { name: 'Anuluj', exact: true }).click()
  const summary = page.locator('.goal-milestone-summary')
  const expectMilestoneCount = async value => {
    if (await goalToggle.getAttribute('aria-expanded') === 'true') {
      const total = value.includes('/') ? value.split('/')[1] : value
      await milestoneTab.locator('.goal-tab-count').getByText(total, { exact: true }).waitFor()
      assert.equal(await goalCard.locator('.goal-milestone-summary').count(), 0)
    } else {
      await summary.getByText(`${value} kamieni milowych`, { exact: true }).waitFor()
    }
  }
  const assertHeaderControlsAligned = async () => {
    const cards = page.locator('.goal-card')
    for (let index = 0; index < await cards.count(); index++) {
      const card = cards.nth(index)
      const cardBox = await card.boundingBox()
      const title = await card.locator('.goal-details-toggle').boundingBox()
      const actions = await card.locator('.goal-header-actions').boundingBox()
      const chevron = await card.locator('.goal-chevron-button').boundingBox()
      const menu = await card.locator('.goal-header-actions .task-menu-trigger').boundingBox()
      assert.ok(cardBox && title && actions && chevron && menu)
      assert.equal(chevron.width, 32)
      assert.equal(chevron.height, 32)
      assert.equal(menu.width, 32)
      assert.equal(menu.height, 32)
      assert.ok(Math.abs(chevron.y + chevron.height / 2 - (menu.y + menu.height / 2)) < 0.5)
      assert.ok(Math.abs(menu.x - (chevron.x + chevron.width) - 4) < 0.5)
      assert.ok(cardBox.x + cardBox.width - (menu.x + menu.width) >= 12)
      assert.ok(cardBox.x + cardBox.width - (menu.x + menu.width) <= 14)
      assert.ok(title.x + title.width <= actions.x)
    }
  }
  assert.equal(await summary.count(), 0)
  await assertHeaderControlsAligned()
  const emptyDescriptionToggle = page.getByRole('button', { name: 'Cel bez opisu', exact: true })
  await emptyDescriptionToggle.click()
  const emptyDescriptionCard = emptyDescriptionToggle.locator('..')
  await emptyDescriptionCard.getByText('Nie określono kryterium osiągnięcia celu', { exact: true }).waitFor()
  assert.equal(await emptyDescriptionCard.locator('.goal-success-criterion').count(), 0)
  assert.equal(await emptyDescriptionCard.locator('.goal-initial-state-toggle').count(), 0)
  assert.equal(await emptyDescriptionCard.getByRole('button', { name: 'Opis celu', exact: true }).count(), 0)
  await emptyDescriptionToggle.click()
  const exactThreeLineToggle = page.getByRole('button', { name: longGoalTitle, exact: true })
  await exactThreeLineToggle.click()
  const exactThreeLineCard = exactThreeLineToggle.locator('..')
  const exactSuccess = exactThreeLineCard.locator('.goal-success-criterion')
  await exactSuccess.getByText('Linia pierwsza', { exact: false }).waitFor()
  assert.equal(await exactSuccess.locator('.goal-definition-expand').count(), 1)
  assert.ok(await exactSuccess.locator('p').evaluate(element => {
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight)
    return element.clientHeight <= lineHeight * 2 + 1 && element.scrollHeight > element.clientHeight
  }))
  const exactInitialToggle = exactThreeLineCard.getByRole('button', { name: 'Stan początkowy', exact: true })
  assert.equal(await exactInitialToggle.getAttribute('aria-expanded'), 'false')
  await exactInitialToggle.click()
  await exactThreeLineCard.locator('.goal-initial-state').getByText('Krótki opis.', { exact: true }).waitFor()
  assert.equal(await exactThreeLineCard.locator('.goal-initial-state .goal-definition-expand').count(), 0)
  await exactThreeLineToggle.click()
  const goalToggle = page.getByRole('button', { name: 'Przebiegam 5 km', exact: true })
  await goalToggle.click()
  const goalCard = goalToggle.locator('..')
  const successCriterion = goalCard.locator('.goal-success-criterion')
  await successCriterion.getByRole('heading', { name: 'Kiedy uznam cel za osiągnięty?', exact: true }).waitFor()
  const successExpand = successCriterion.locator('.goal-definition-expand')
  await successExpand.waitFor()
  assert.ok(await successCriterion.locator('p').evaluate(element => {
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight)
    return element.clientHeight <= lineHeight * 2 + 1 && element.scrollHeight > element.clientHeight
  }))
  await successExpand.click()
  assert.equal(await successExpand.getAttribute('aria-expanded'), 'true')
  const initialStateToggle = goalCard.getByRole('button', { name: 'Stan początkowy', exact: true })
  const initialState = goalCard.locator('.goal-initial-state')
  assert.equal(await initialStateToggle.getAttribute('aria-expanded'), 'false')
  assert.equal(await initialState.isHidden(), true)
  await initialStateToggle.click()
  const initialExpand = initialState.locator('.goal-definition-expand')
  await initialExpand.waitFor()
  assert.equal(await initialStateToggle.getAttribute('aria-expanded'), 'true')
  assert.equal(await successExpand.getAttribute('aria-expanded'), 'true')
  assert.ok(await initialState.locator('p').evaluate(element => {
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight)
    return element.clientHeight <= lineHeight * 3 + 1 && element.scrollHeight > element.clientHeight
  }))
  await initialExpand.click()
  assert.equal(await initialExpand.getAttribute('aria-expanded'), 'true')
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 800 })
    assert.equal(await successCriterion.locator('.goal-definition-expand').count(), 1)
    assert.equal(await initialState.locator('.goal-definition-expand').count(), 1)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
  const taskTabBeforeContentChecks = page.locator('#goal-tab-tasks-1')
  await taskTabBeforeContentChecks.click()
  assert.equal(await initialStateToggle.getAttribute('aria-expanded'), 'true')
  assert.equal(await initialExpand.getAttribute('aria-expanded'), 'true')
  assert.equal(await successExpand.getAttribute('aria-expanded'), 'true')
  assert.equal(await goalToggle.getAttribute('aria-expanded'), 'true')
  await page.locator('#goal-tab-milestones-1').click()
  await page.getByText('Nie masz jeszcze kamieni milowych dla tego celu.').waitFor()
  const section = page.getByRole('region', { name: 'Kamienie milowe' })
  const taskSection = page.locator('#goal-tasks-1')
  const habitSection = page.locator('#goal-habits-1')
  const milestoneTab = page.locator('#goal-tab-milestones-1')
  const taskTab = page.locator('#goal-tab-tasks-1')
  const habitTab = page.locator('#goal-tab-habits-1')
  const milestonePanel = page.locator('#goal-panel-milestones-1')
  const taskPanel = page.locator('#goal-panel-tasks-1')
  const habitPanel = page.locator('#goal-panel-habits-1')
  const contextualAction = goalCard.locator('.goal-tabs-add')
  await contextualAction.waitFor()
  assert.equal(await contextualAction.count(), 1)
  assert.equal(await goalCard.locator('.goal-subsection-header').count(), 0)
  async function assertTabsActionLayout(tab, sectionSelector, actionLabel) {
    await tab.click()
    await contextualAction.waitFor({ state: 'visible' })
    assert.equal(await contextualAction.getAttribute('aria-label'), actionLabel)
    const metrics = await goalCard.locator('.goal-tabs-row').evaluate(element => {
      const rowBox = element.getBoundingClientRect()
      const tabs = element.querySelector('.goal-tabs')
      const addButton = element.querySelector('.goal-tabs-add')
      const tabsBox = tabs.getBoundingClientRect()
      const buttonBox = addButton.getBoundingClientRect()
      return {
        tabsFit: tabs.scrollWidth <= tabs.clientWidth,
        tabsCenter: tabsBox.top + tabsBox.height / 2,
        buttonCenter: buttonBox.top + buttonBox.height / 2,
        buttonWidth: buttonBox.width,
        buttonHeight: buttonBox.height,
        buttonInsideRow: buttonBox.right <= rowBox.right + 0.5,
      }
    })
    assert.equal(metrics.tabsFit, true)
    assert.ok(Math.abs(metrics.tabsCenter - metrics.buttonCenter) < 0.5)
    assert.equal(metrics.buttonInsideRow, true)
    assert.equal(metrics.buttonWidth, 32)
    assert.equal(metrics.buttonHeight, 32)
    assert.equal(await page.locator(sectionSelector).evaluate(element => getComputedStyle(element).paddingTop), '8px')
  }
  assert.equal(await milestoneTab.getAttribute('aria-selected'), 'true')
  assert.equal(await milestonePanel.isVisible(), true)
  assert.equal(await taskPanel.isHidden(), true)
  assert.equal(await habitPanel.isHidden(), true)
  await milestoneTab.focus()
  await page.keyboard.press('ArrowRight')
  assert.equal(await taskTab.getAttribute('aria-selected'), 'true')
  assert.equal(await taskTab.evaluate(element => element === document.activeElement), true)
  assert.equal(await taskPanel.isVisible(), true)
  await page.keyboard.press('End')
  assert.equal(await habitTab.getAttribute('aria-selected'), 'true')
  assert.equal(await habitPanel.isVisible(), true)
  await habitSection.getByText('Brak przypisanych nawyków', { exact: true }).waitFor()
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 800 })
    const tabBoxes = await page.locator('#goal-tab-milestones-1, #goal-tab-tasks-1, #goal-tab-habits-1')
      .evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect()
      return { top: box.top, bottom: box.bottom }
    }))
    assert.ok(tabBoxes.every(box => Math.abs(box.top - tabBoxes[0].top) < 0.5
      && Math.abs(box.bottom - tabBoxes[0].bottom) < 0.5))
    assert.ok(await page.locator('.goal-tabs').evaluate(element => element.scrollWidth <= element.clientWidth))
    await assertTabsActionLayout(milestoneTab, '#goal-milestones-1', 'Dodaj kamień milowy')
    await assertTabsActionLayout(taskTab, '#goal-tasks-1', 'Przypnij zadanie')
    await assertTabsActionLayout(habitTab, '#goal-habits-1', 'Przypnij nawyk')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
  await taskTab.click()
  await contextualAction.click()
  const taskDialog = page.getByRole('dialog', { name: 'Przypnij zadania' })
  const availableTaskRows = taskDialog.locator('.goal-available-task')
  assert.equal(await taskDialog.getByRole('heading', { name: 'Moje priorytety' }).count(), 1)
  assert.equal(await taskDialog.getByRole('heading', { name: 'Pozostałe zadania' }).count(), 1)
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 800 })
    const shortRow = availableTaskRows.filter({ hasText: 'Konsultacja GPT' })
    const longRow = availableTaskRows.filter({ hasText: longAvailableTask.title })
    const [shortBox, longBox, attachBox] = await Promise.all([
      shortRow.boundingBox(),
      longRow.boundingBox(),
      shortRow.getByRole('button').boundingBox(),
    ])
    assert.ok(shortBox && shortBox.height >= 52 && shortBox.height <= 56)
    assert.ok(longBox && shortBox && longBox.height > shortBox.height)
    assert.ok(attachBox && attachBox.width >= 44 && attachBox.height >= 44)
    assert.equal(await shortRow.evaluate(element => getComputedStyle(element).borderBottomWidth), '1px')
    assert.ok(await taskDialog.evaluate(element => element.scrollWidth <= element.clientWidth))
  }
  await taskDialog.getByRole('button', { name: 'Przypnij zadanie: Konsultacja GPT' }).click()
  await page.waitForFunction(() => document.querySelector('#goal-tab-tasks-1')?.textContent?.includes('1'))
  await taskDialog.getByRole('button', { name: `Przypnij zadanie: ${longAvailableTask.title}` }).click()
  await page.waitForFunction(() => document.querySelector('#goal-tab-tasks-1')?.textContent?.includes('2'))
  await taskDialog.getByRole('button', { name: 'Gotowe', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('#goal-tab-tasks-1')?.textContent?.includes('2'))
  await habitTab.click()
  await contextualAction.click()
  const habitDialog = page.getByRole('dialog', { name: 'Przypnij nawyki' })
  await habitDialog.getByRole('button', { name: `Przypnij nawyk: ${availableHabit.name}` }).click()
  await page.waitForFunction(() => document.querySelector('#goal-tab-habits-1')?.textContent?.includes('1'))
  await habitDialog.getByRole('button', { name: 'Gotowe', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('#goal-tab-habits-1')?.textContent?.includes('1'))
  assert.equal(await goalToggle.getAttribute('aria-expanded'), 'true')
  assert.equal(await page.getByText('+ Przypnij zadanie', { exact: true }).count(), 0)
  assert.equal(await page.getByText('+ Przypnij nawyk', { exact: true }).count(), 0)
  const linkedTaskRows = taskSection.locator('.goal-linked-task')
  const linkedHabitRow = habitSection.locator('.goal-linked-habit')
  await linkedTaskRows.nth(1).waitFor({ state: 'attached' })
  await linkedHabitRow.waitFor({ state: 'attached' })
  await taskTab.click()
  await taskSection.getByText('30 paź, 21:52', { exact: true }).waitFor()
  await taskSection.getByText('5 pkt', { exact: true }).waitFor()
  await taskSection.getByText('1000 pkt', { exact: true }).waitFor()
  await habitTab.click()
  await habitSection.getByText('1/3 dni w tygodniu', { exact: true }).waitFor()
  await habitSection.getByText('2 pkt', { exact: true }).waitFor()
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 800 })
    await taskTab.click()
    for (const row of [linkedTaskRows.first(), linkedTaskRows.nth(1)]) {
      const styles = await row.evaluate(element => {
        const style = getComputedStyle(element)
        return { borderWidth: style.borderTopWidth, radius: style.borderRadius }
      })
      assert.equal(styles.borderWidth, '1px')
      assert.equal(styles.radius, '8px')
    }
    await habitTab.click()
    const habitStyles = await linkedHabitRow.evaluate(element => {
      const style = getComputedStyle(element)
      return { borderWidth: style.borderTopWidth, radius: style.borderRadius }
    })
    assert.equal(habitStyles.borderWidth, '1px')
    assert.equal(habitStyles.radius, '8px')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
  await taskTab.click()
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/api/tasks/101/completion')),
    linkedTaskRows.first().getByRole('checkbox').click(),
  ])
  assert.equal(availableTask.completed, true)
  assert.equal(await taskTab.locator('.goal-tab-count').textContent(), '2')
  await linkedTaskRows.first().getByRole('button', { name: /Więcej opcji/ }).click()
  await page.getByRole('menuitem', { name: 'Odepnij od celu' }).waitFor()
  await page.keyboard.press('Escape')
  await habitTab.click()
  await linkedHabitRow.getByRole('button', { name: /Więcej opcji/ }).click()
  await page.getByRole('menuitem', { name: 'Odepnij od celu' }).click()
  await page.waitForFunction(() => document.querySelector('#goal-tab-habits-1')?.textContent?.includes('0'))
  await habitSection.getByText('Brak przypisanych nawyków', { exact: true }).waitFor()
  await milestoneTab.click()
  await contextualAction.click()
  let createMilestoneForm = section.locator('.milestone-create-form')
  let createMilestoneInput = createMilestoneForm.getByLabel('Nazwa kamienia milowego')
  await createMilestoneForm.waitFor()
  assert.equal(await createMilestoneForm.getByRole('heading').count(), 0)
  assert.equal(await createMilestoneInput.evaluate(element => element === document.activeElement), true)
  const createCancel = createMilestoneForm.getByRole('button', { name: 'Anuluj', exact: true })
  const createSubmit = createMilestoneForm.getByRole('button', { name: 'Dodaj', exact: true })
  assert.equal(await createSubmit.isDisabled(), true)
  assert.equal(await createSubmit.locator('svg').count(), 1)
  const formStyles = await createMilestoneForm.evaluate(element => {
    const style = getComputedStyle(element)
    return {
      border: style.borderTopWidth,
      padding: style.paddingTop,
      background: style.backgroundColor,
      rowGap: style.rowGap,
      marginBottom: style.marginBottom,
    }
  })
  assert.equal(formStyles.border, '0px')
  assert.equal(formStyles.padding, '0px')
  assert.equal(formStyles.background, 'rgba(0, 0, 0, 0)')
  assert.equal(formStyles.rowGap, '7px')
  assert.equal(formStyles.marginBottom, '10px')
  assert.equal(await createSubmit.evaluate(element => getComputedStyle(element).opacity), '0.58')
  const [cancelBox, submitBox] = await Promise.all([createCancel.boundingBox(), createSubmit.boundingBox()])
  assert.ok(cancelBox && submitBox && cancelBox.height >= 40 && submitBox.height >= 40)
  assert.ok(Math.abs(cancelBox.y - submitBox.y) < 0.5)
  const emptyStateBox = await section.getByText('Nie masz jeszcze kamieni milowych dla tego celu.').boundingBox()
  const initialFormBox = await createMilestoneForm.boundingBox()
  assert.ok(initialFormBox && emptyStateBox && initialFormBox.y < emptyStateBox.y)
  await createMilestoneInput.fill('Anulowany rezultat')
  await createMilestoneInput.press('Escape')
  await createMilestoneForm.waitFor({ state: 'hidden' })
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Dodaj kamień milowy')
  assert.equal(await contextualAction.evaluate(element => element === document.activeElement), true)
  await contextualAction.click()
  createMilestoneForm = section.locator('.milestone-create-form')
  createMilestoneInput = createMilestoneForm.getByLabel('Nazwa kamienia milowego')
  await createMilestoneInput.fill('Zapis po błędzie')
  failCreate = true
  await createMilestoneForm.getByRole('button', { name: 'Dodaj', exact: true }).click()
  await createMilestoneForm.getByRole('alert').waitFor()
  assert.equal(await createMilestoneInput.inputValue(), 'Zapis po błędzie')
  failCreate = false
  await createMilestoneInput.fill('  Przebiegam 2 km bez przerwy  ')
  await createMilestoneInput.press('Enter')
  await section.getByText('Przebiegam 2 km bez przerwy', { exact: true }).waitFor()
  await page.getByRole('status').getByText('Dodano kamień milowy.', { exact: true }).waitFor()
  assert.equal(milestones[0].title, 'Przebiegam 2 km bez przerwy')
  await expectMilestoneCount('0/1')
  await section.getByRole('button', { name: 'Pokaż mniej', exact: true }).waitFor()
  assert.equal(await section.locator('.milestone-grip').count(), 1)
  await section.getByRole('button', { name: 'Pokaż mniej', exact: true }).click()
  assert.equal(await section.locator('.milestone-list-toggle').count(), 0)
  await assertHeaderControlsAligned()
  await section.getByRole('checkbox').check()
  await expectMilestoneCount('1/1')
  await page.waitForFunction(() => !document.querySelector('.milestone-list input').disabled)
  await contextualAction.click()
  createMilestoneForm = section.locator('.milestone-create-form')
  const listBox = await section.locator('.milestone-list').boundingBox()
  const formBox = await createMilestoneForm.boundingBox()
  assert.ok(formBox && listBox && formBox.y < listBox.y)
  await createMilestoneForm.getByLabel('Nazwa kamienia milowego').fill('Drugi rezultat')
  await createMilestoneForm.getByRole('button', { name: 'Dodaj', exact: true }).click()
  await expectMilestoneCount('1/2')
  assert.equal(await section.locator('.milestone-list > li').count(), 2)
  assert.equal(await section.locator('.milestone-grip').count(), 2)
  await section.getByRole('button', { name: 'Pokaż mniej', exact: true }).click()
  await section.getByRole('checkbox').first().check()
  await expectMilestoneCount('2/2')
  await page.waitForFunction(() => [...document.querySelectorAll('.milestone-list input')].every(input => !input.disabled))
  assert.deepEqual(await section.locator('.milestone-row > span').allTextContents(), ['Drugi rezultat'])
  await taskTab.click()
  await milestoneTab.click()
  await section.getByText('Wszystkie kamienie milowe ukończone', { exact: true }).waitFor()
  await section.getByRole('button', { name: 'Pokaż wszystkie (2)', exact: true }).click()
  assert.deepEqual(await section.locator('.milestone-row > span').allTextContents(),
    ['Przebiegam 2 km bez przerwy', 'Drugi rezultat'])
  await section.getByRole('checkbox').first().uncheck()
  await expectMilestoneCount('1/2')
  await page.waitForFunction(() => !document.querySelector('.milestone-list input').disabled)
  await goalToggle.click()
  assert.equal(await goalToggle.getAttribute('aria-expanded'), 'false')
  await expectMilestoneCount('1/2')
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 800 })
    await assertHeaderControlsAligned()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
  await page.getByRole('button', { name: 'Rozwiń cel „Przebiegam 5 km”' }).click()
  await section.getByRole('checkbox').first().waitFor()
  assert.equal(await initialStateToggle.getAttribute('aria-expanded'), 'false')
  assert.equal(await successExpand.getAttribute('aria-expanded'), 'false')
  assert.equal(await milestoneTab.getAttribute('aria-selected'), 'true')
  failCompletion = true
  await section.getByRole('checkbox').first().check()
  await section.getByRole('alert').getByText('Nie udało się zapisać ukończenia.').waitFor()
  assert.equal(await section.getByRole('checkbox').first().isChecked(), false)
  assert.equal(await section.getByRole('checkbox').count(), 1)
  assert.equal(milestones.find(item => item.title === 'Drugi rezultat').completed, true)
  await expectMilestoneCount('1/2')
  failCompletion = false
  for (const width of [320, 375, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    await assertHeaderControlsAligned()
    await contextualAction.click()
    await section.getByLabel('Nazwa kamienia milowego').fill('Rezultat '.repeat(12))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await section.getByRole('button', { name: 'Anuluj' }).click()
  }
  await page.reload()
  await page.getByRole('button', { name: 'Cele', exact: true }).click()
  await page.getByRole('button', { name: 'Przebiegam 5 km', exact: true }).click()
  await page.getByText('Przebiegam 2 km bez przerwy', { exact: true }).waitFor()
  await expectMilestoneCount('1/2')
  await section.getByRole('button', { name: 'Pokaż wszystkie (2)', exact: true }).click()
  assert.equal(await section.getByRole('checkbox').nth(1).isChecked(), true)
  const rows = section.locator('.milestone-list > li')
  async function moveFirstDown() {
    await page.waitForTimeout(350)
    const handle = rows.first().getByRole('button', { name: /Zmień kolejność/ })
    await handle.scrollIntoViewIfNeeded()
    await handle.focus()
    await page.keyboard.press('Space')
    await page.locator('.milestone-dragging').waitFor()
    await page.waitForTimeout(100)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(300)
    const response = page.waitForResponse(response => response.url().endsWith('/milestones/order'))
    await page.keyboard.press('Space')
    await response
    await page.waitForFunction(() => !document.querySelector('.milestone-grip').disabled)
  }
  const originalNames = await rows.locator('.milestone-row > span').allTextContents()
  await moveFirstDown()
  assert.deepEqual(await rows.locator('.milestone-row > span').allTextContents(), [...originalNames].reverse())
  assert.equal(await rows.first().getByRole('checkbox').isChecked(), true)
  await page.reload()
  await page.getByRole('button', { name: 'Cele', exact: true }).click()
  await page.getByRole('button', { name: 'Przebiegam 5 km', exact: true }).click()
  await expectMilestoneCount('1/2')
  await section.getByRole('button', { name: 'Pokaż wszystkie (2)', exact: true }).click()
  assert.deepEqual(await rows.locator('.milestone-row > span').allTextContents(), [...originalNames].reverse())
  await moveFirstDown()
  orderFailure = 503
  await moveFirstDown()
  await section.getByText('Nie udało się zapisać kolejności.').waitFor()
  assert.deepEqual(await rows.locator('.milestone-row > span').allTextContents(), originalNames)
  orderFailure = 0
  const beforeCancel = orderWrites
  await rows.first().getByRole('button', { name: /Zmień kolejność/ }).focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Escape')
  assert.equal(orderWrites, beforeCancel)
  assert.deepEqual(await rows.locator('.milestone-row > span').allTextContents(), originalNames)
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 })
    await rows.first().scrollIntoViewIfNeeded()
    const start = await rows.first().locator('.milestone-grip').boundingBox()
    const end = await rows.nth(1).locator('.milestone-grip').boundingBox()
    const client = await page.context().newCDPSession(page)
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x + 20, y: start.y + 20 }] })
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + 20, y: start.y + 30 }] })
    await page.waitForTimeout(100)
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: end.x + 20, y: end.y + 20 }] })
    await page.waitForTimeout(100)
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForFunction(() => !document.querySelector('.milestone-grip').disabled)
    assert.deepEqual(await rows.locator('.milestone-row > span').allTextContents(), [...originalNames].reverse())
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await moveFirstDown()
    await client.detach()
  }
  await page.setViewportSize({ width: 1280, height: 900 })
  await rows.first().scrollIntoViewIfNeeded()
  const mouseStart = await rows.first().locator('.milestone-grip').boundingBox()
  const mouseEnd = await rows.nth(1).locator('.milestone-grip').boundingBox()
  await page.mouse.move(mouseStart.x + 20, mouseStart.y + 20)
  await page.mouse.down()
  await page.mouse.move(mouseStart.x + 20, mouseStart.y + 30, { steps: 3 })
  await page.mouse.move(mouseEnd.x + 20, mouseEnd.y + 20, { steps: 8 })
  await page.mouse.up()
  await page.waitForFunction(() => !document.querySelector('.milestone-grip').disabled)
  assert.deepEqual(await rows.locator('.milestone-row > span').allTextContents(), [...originalNames].reverse())
  await moveFirstDown()
  orderFailure = 409
  milestones.push({ id: 99, title: 'Dodany w innej sesji', completed: false, position: 2 })
  await moveFirstDown()
  await section.getByText('Dodany w innej sesji', { exact: true }).waitFor()
  await expectMilestoneCount('1/3')
  orderFailure = 0
  milestones.pop()
  await page.reload()
  await page.getByRole('button', { name: 'Cele', exact: true }).click()
  await page.getByRole('button', { name: 'Przebiegam 5 km', exact: true }).click()
  await expectMilestoneCount('1/2')
  await section.getByRole('button', { name: 'Pokaż wszystkie (2)', exact: true }).click()
  async function edit(index) {
    await rows.nth(index).getByRole('button', { name: /Więcej opcji/ }).click()
    await page.getByRole('menuitem', { name: 'Edytuj', exact: true }).click()
  }
  await edit(0)
  await rows.first().getByLabel('Nazwa kamienia milowego').fill('Anulowana nazwa')
  await rows.first().getByRole('button', { name: 'Anuluj' }).click()
  assert.equal(await rows.first().locator('.milestone-row > span').textContent(), 'Przebiegam 2 km bez przerwy')
  for (const index of [0, 1]) {
    await edit(index)
    const field = rows.nth(index).getByLabel('Nazwa kamienia milowego')
    await field.fill(' ')
    await rows.nth(index).getByRole('button', { name: 'Zapisz' }).click()
    await rows.nth(index).getByRole('alert').waitFor()
    await field.fill('Nowa nazwa ' + index)
    failChange = true
    await rows.nth(index).getByRole('button', { name: 'Zapisz' }).click()
    await rows.nth(index).getByText('Nie udało się zapisać zmiany.').waitFor()
    assert.equal(await field.inputValue(), 'Nowa nazwa ' + index)
    failChange = false
    await rows.nth(index).getByRole('button', { name: 'Zapisz' }).click()
    await rows.nth(index).getByRole('checkbox').waitFor()
    assert.equal(await rows.nth(index).getByRole('checkbox').isChecked(), index === 1)
  }
  async function removeFirst(accept) {
    page.once('dialog', dialog => {
      assert.ok(dialog.message().includes('kamień milowy'))
      return accept ? dialog.accept() : dialog.dismiss()
    })
    await rows.first().getByRole('button', { name: /Więcej opcji/ }).click()
    await page.getByRole('menuitem', { name: 'Usuń', exact: true }).click()
  }
  await removeFirst(false)
  assert.equal(await rows.count(), 2)
  failChange = true
  await removeFirst(true)
  await rows.first().getByText('Nie udało się zapisać zmiany.').waitFor()
  assert.equal(await rows.count(), 2)
  failChange = false
  await removeFirst(true)
  await expectMilestoneCount('1/1')
  assert.equal(await rows.first().locator('.milestone-row > span').textContent(), 'Nowa nazwa 1')
  await removeFirst(true)
  await section.getByText('Nie masz jeszcze kamieni milowych dla tego celu.').waitFor()
  assert.equal(await section.locator('.task-section-count').count(), 0)
  await page.waitForFunction(() => !document.querySelector('.goal-milestone-summary'))
  milestones.push(
    { id: 1, title: 'Krótki rezultat', completed: false, position: 0 },
    { id: 2, title: 'Dłuższa nazwa rezultatu, która naturalnie zawija się na kilka linii', completed: false, position: 1 },
    { id: 3, title: 'Ukończony rezultat', completed: true, position: 2 },
    { id: 4, title: 'Czwarty rezultat', completed: false, position: 3 },
    { id: 5, title: 'Piąty rezultat', completed: false, position: 4 },
  )
  await page.reload()
  await page.getByRole('button', { name: 'Cele', exact: true }).click()
  await page.getByRole('button', { name: 'Przebiegam 5 km', exact: true }).click()
  await section.locator('.milestone-list > li').nth(2).waitFor()
  assert.deepEqual(await section.locator('.milestone-row > span').allTextContents(), [
    'Krótki rezultat',
    'Dłuższa nazwa rezultatu, która naturalnie zawija się na kilka linii',
    'Czwarty rezultat',
  ])
  assert.equal(await section.locator('.milestone-grip').count(), 0)
  await section.getByRole('button', { name: 'Pokaż wszystkie (5)', exact: true }).click()
  await section.locator('.milestone-list > li').nth(4).waitFor()
  assert.equal(await section.locator('.milestone-grip').count(), 5)
  await section.getByRole('button', { name: 'Pokaż mniej', exact: true }).click()
  assert.equal(await section.locator('.milestone-list > li').count(), 3)
  assert.equal(await section.locator('.milestone-grip').count(), 0)
  await section.getByRole('button', { name: 'Pokaż wszystkie (5)', exact: true }).click()
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 800 })
    const compactRows = section.locator('.milestone-list > li')
    const shortRow = await compactRows.first().boundingBox()
    const list = await section.locator('.milestone-list').boundingBox()
    const checkbox = await compactRows.first().getByRole('checkbox').boundingBox()
    const grip = await compactRows.first().locator('.milestone-grip').boundingBox()
    const menu = await compactRows.first().locator('.task-menu-trigger').boundingBox()
    assert.ok(shortRow && list && checkbox && grip && menu)
    assert.ok(shortRow.height <= 46)
    assert.ok(list.height < 340)
    assert.equal(grip.width, 32)
    assert.equal(grip.height, 32)
    assert.equal(menu.width, 32)
    assert.equal(menu.height, 32)
    assert.ok(Math.abs(checkbox.y + checkbox.height / 2 - (grip.y + grip.height / 2)) < 0.5)
    assert.ok(Math.abs(grip.y + grip.height / 2 - (menu.y + menu.height / 2)) < 0.5)
    assert.ok(await compactRows.nth(2).locator('.milestone-title').evaluate(element => element.classList.contains('milestone-completed')))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
  console.log('PASS milestone completion, undo, counts, order, API error rollback, creation, reload and responsive layout (mock API)')
  console.log('PASS success criterion clamps at two lines and initial state clamps at three lines on 320/375/390px widths')
  console.log('PASS success criterion stays visible while initial state defaults closed and empty description variants remain compact')
  console.log('PASS goal tabs switch with pointer/keyboard, keep one panel visible and fit at 320/375/390px')
  console.log('PASS editing both states, validation, cancel, failed edit/delete, confirmed deletion and counters')
  console.log('PASS reorder via keyboard/touch at 320/390px, reload, cancellation, rollback and conflict refresh')
  console.log('PASS compact three-item milestone preview and full five-row list at 320/375/390px')
  console.log('PASS contextual tab action creates a milestone and attaches a task/habit at 320/375/390px')
  console.log('PASS compact linked task/habit rows show metadata, wrap on mobile and preserve checkbox/menu actions')
} finally { await browser.close() }
