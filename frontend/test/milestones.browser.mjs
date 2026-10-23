import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 800 } })
  page.on('pageerror', error => console.error(error.message))
  const milestones = []
  let failCompletion = false
  let failChange = false
  let orderFailure = 0
  let orderWrites = 0
  const availableTask = {
    id: 101, title: 'Konsultacja GPT', description: null, points: 5, completed: false,
    completedAt: null, inFocus: false, dueDate: '2026-10-30', dueTime: '21:52', category: null,
    goalId: null, goalTitle: null,
  }
  const longAvailableTask = {
    ...availableTask, id: 102, title: 'Bardzo długie zadanie przypięte do celu, które zawija się naturalnie na małym ekranie telefonu',
    points: 1000, dueDate: null, dueTime: null,
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
        const { title } = route.request().postDataJSON()
        body = { id: milestones.length + 1, title, completed: false, position: milestones.length }
        milestones.push(body)
      } else body = milestones
    }
    await route.fulfill({ status: route.request().method() === 'POST' ? 201 : 200,
      contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto('http://127.0.0.1:5186')
  await page.getByRole('button', { name: 'Cele', exact: true }).click()
  const summary = page.locator('.goal-milestone-summary')
  const expectSummary = value => summary.getByText(`${value} kamieni milowych`, { exact: true }).waitFor()
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
  const exactThreeLineToggle = page.getByRole('button', { name: longGoalTitle, exact: true })
  await exactThreeLineToggle.click()
  const exactThreeLineDefinition = exactThreeLineToggle.locator('..').locator('.goal-definition')
  await exactThreeLineDefinition.getByText('Linia pierwsza', { exact: false }).waitFor()
  assert.equal(await exactThreeLineDefinition.locator('.goal-definition-expand').count(), 0)
  await exactThreeLineToggle.click()
  const goalToggle = page.getByRole('button', { name: 'Przebiegam 5 km', exact: true })
  await goalToggle.click()
  const goalDefinition = goalToggle.locator('..').locator('.goal-definition')
  const definitionSections = goalDefinition.locator('section')
  const definitionButtons = goalDefinition.locator('.goal-definition-expand')
  await definitionButtons.nth(1).waitFor()
  assert.equal(await definitionButtons.count(), 2)
  for (let index = 0; index < 2; index++) {
    assert.ok(await definitionSections.nth(index).locator('p').evaluate(element => {
      const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight)
      return element.clientHeight <= lineHeight * 3 + 1 && element.scrollHeight > element.clientHeight
    }))
  }
  await definitionButtons.first().click()
  assert.equal(await definitionButtons.first().getAttribute('aria-expanded'), 'true')
  assert.equal(await definitionButtons.nth(1).getAttribute('aria-expanded'), 'false')
  await definitionButtons.nth(1).click()
  assert.equal(await definitionButtons.nth(1).getAttribute('aria-expanded'), 'true')
  await definitionButtons.first().click()
  assert.equal(await definitionButtons.first().getAttribute('aria-expanded'), 'false')
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 800 })
    assert.equal(await definitionButtons.count(), 2)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
  await page.getByText('Nie masz jeszcze kamieni milowych dla tego celu.').waitFor()
  const section = page.getByRole('region', { name: 'Kamienie milowe' })
  const taskSection = page.locator('#goal-tasks-1')
  const habitSection = page.locator('#goal-habits-1')
  const subsectionButtons = page.locator([
    '#goal-milestones-1 > .goal-subsection-header .goal-subsection-add',
    '#goal-tasks-1 > .goal-subsection-header .goal-subsection-add',
    '#goal-habits-1 > .goal-subsection-header .goal-subsection-add',
  ].join(', '))
  await subsectionButtons.nth(2).waitFor()
  assert.equal(await subsectionButtons.count(), 3)
  await habitSection.getByText('Brak przypisanych nawyków', { exact: true }).waitFor()
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 800 })
    const boxes = await subsectionButtons.evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect()
      return { width: box.width, height: box.height, right: box.right }
    }))
    assert.ok(boxes.every(box => box.width === 32 && box.height === 32))
    assert.ok(boxes.every(box => Math.abs(box.right - boxes[0].right) < 0.5))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
  await taskSection.getByRole('button', { name: 'Przypnij zadanie', exact: true }).click()
  const taskDialog = page.getByRole('dialog', { name: 'Przypnij zadania' })
  await taskDialog.getByRole('button', { name: 'Przypnij zadanie: Konsultacja GPT' }).click()
  await taskSection.getByText('Zadania · 1', { exact: true }).waitFor()
  await taskDialog.getByRole('button', { name: `Przypnij zadanie: ${longAvailableTask.title}` }).click()
  await taskSection.getByText('Zadania · 2', { exact: true }).waitFor()
  await taskDialog.getByRole('button', { name: 'Gotowe', exact: true }).click()
  await habitSection.getByRole('button', { name: 'Przypnij nawyk', exact: true }).click()
  const habitDialog = page.getByRole('dialog', { name: 'Przypnij nawyki' })
  await habitDialog.getByRole('button', { name: `Przypnij nawyk: ${availableHabit.name}` }).click()
  await habitSection.getByText('Nawyki · 1', { exact: true }).waitFor()
  await habitDialog.getByRole('button', { name: 'Gotowe', exact: true }).click()
  assert.equal(await goalToggle.getAttribute('aria-expanded'), 'true')
  assert.equal(await page.getByText('+ Przypnij zadanie', { exact: true }).count(), 0)
  assert.equal(await page.getByText('+ Przypnij nawyk', { exact: true }).count(), 0)
  const linkedTaskRows = taskSection.locator('.goal-linked-task')
  const linkedHabitRow = habitSection.locator('.goal-linked-habit')
  await linkedTaskRows.nth(1).waitFor()
  await linkedHabitRow.waitFor()
  await taskSection.getByText('30 paź, 21:52', { exact: true }).waitFor()
  await taskSection.getByText('5 pkt', { exact: true }).waitFor()
  await taskSection.getByText('1000 pkt', { exact: true }).waitFor()
  await habitSection.getByText('1/3 dni w tygodniu', { exact: true }).waitFor()
  await habitSection.getByText('2 pkt', { exact: true }).waitFor()
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 800 })
    for (const row of [linkedTaskRows.first(), linkedTaskRows.nth(1), linkedHabitRow]) {
      const styles = await row.evaluate(element => {
        const style = getComputedStyle(element)
        return { borderWidth: style.borderTopWidth, radius: style.borderRadius }
      })
      assert.equal(styles.borderWidth, '1px')
      assert.equal(styles.radius, '8px')
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/api/tasks/101/completion')),
    linkedTaskRows.first().getByRole('checkbox').click(),
  ])
  assert.equal(availableTask.completed, true)
  await linkedTaskRows.first().getByRole('button', { name: /Więcej opcji/ }).click()
  await page.getByRole('menuitem', { name: 'Odepnij od celu' }).waitFor()
  await page.keyboard.press('Escape')
  await linkedHabitRow.getByRole('button', { name: /Więcej opcji/ }).click()
  await page.getByRole('menuitem', { name: 'Odepnij od celu' }).click()
  await habitSection.getByText('Nawyki · 0', { exact: true }).waitFor()
  await habitSection.getByText('Brak przypisanych nawyków', { exact: true }).waitFor()
  await section.getByRole('button', { name: 'Dodaj kamień milowy' }).click()
  await section.getByLabel('Nazwa kamienia milowego').fill('  Przebiegam 2 km bez przerwy  ')
  await section.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await section.getByText('Przebiegam 2 km bez przerwy', { exact: true }).waitFor()
  assert.equal(milestones[0].title, 'Przebiegam 2 km bez przerwy')
  await expectSummary('0/1')
  await assertHeaderControlsAligned()
  await section.getByRole('checkbox').check()
  await expectSummary('1/1')
  await page.waitForFunction(() => !document.querySelector('.milestone-list input').disabled)
  await section.getByRole('button', { name: 'Dodaj kamień milowy' }).click()
  await section.getByLabel('Nazwa kamienia milowego').fill('Drugi rezultat')
  await section.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await expectSummary('1/2')
  await section.getByRole('checkbox').nth(1).check()
  await expectSummary('2/2')
  await page.waitForFunction(() => [...document.querySelectorAll('.milestone-list input')].every(input => !input.disabled))
  assert.deepEqual(await section.locator('.milestone-row > span').allTextContents(),
    ['Przebiegam 2 km bez przerwy', 'Drugi rezultat'])
  await section.getByRole('checkbox').first().uncheck()
  await expectSummary('1/2')
  await page.waitForFunction(() => !document.querySelector('.milestone-list input').disabled)
  await goalToggle.click()
  assert.equal(await goalToggle.getAttribute('aria-expanded'), 'false')
  await expectSummary('1/2')
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 800 })
    await assertHeaderControlsAligned()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
  await page.getByRole('button', { name: 'Rozwiń cel „Przebiegam 5 km”' }).click()
  await section.getByRole('checkbox').first().waitFor()
  failCompletion = true
  await section.getByRole('checkbox').first().check()
  await section.getByRole('alert').getByText('Nie udało się zapisać ukończenia.').waitFor()
  assert.equal(await section.getByRole('checkbox').first().isChecked(), false)
  assert.equal(await section.getByRole('checkbox').nth(1).isChecked(), true)
  await expectSummary('1/2')
  failCompletion = false
  for (const width of [320, 375, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    await assertHeaderControlsAligned()
    await section.getByRole('button', { name: 'Dodaj kamień milowy' }).click()
    await section.getByLabel('Nazwa kamienia milowego').fill('Rezultat '.repeat(12))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await section.getByRole('button', { name: 'Anuluj' }).click()
  }
  await page.reload()
  await page.getByRole('button', { name: 'Cele', exact: true }).click()
  await page.getByRole('button', { name: 'Przebiegam 5 km', exact: true }).click()
  await page.getByText('Przebiegam 2 km bez przerwy', { exact: true }).waitFor()
  await expectSummary('1/2')
  assert.equal(await page.getByRole('checkbox').nth(1).isChecked(), true)
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
  await expectSummary('1/2')
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
  await expectSummary('1/3')
  orderFailure = 0
  milestones.pop()
  await page.reload()
  await page.getByRole('button', { name: 'Cele', exact: true }).click()
  await page.getByRole('button', { name: 'Przebiegam 5 km', exact: true }).click()
  await expectSummary('1/2')
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
  await expectSummary('1/1')
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
  await section.locator('.milestone-list > li').nth(4).waitFor()
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
  console.log('PASS goal descriptions clamp at three lines, expand independently and react to 320/375/390px widths')
  console.log('PASS editing both states, validation, cancel, failed edit/delete, confirmed deletion and counters')
  console.log('PASS reorder via keyboard/touch at 320/390px, reload, cancellation, rollback and conflict refresh')
  console.log('PASS compact five-row milestone list with short, wrapped and completed items at 320/375/390px')
  console.log('PASS goal subsection header actions create a milestone and attach a task/habit at 320/375/390px')
  console.log('PASS compact linked task/habit rows show metadata, wrap on mobile and preserve checkbox/menu actions')
} finally { await browser.close() }
