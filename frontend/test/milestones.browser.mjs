import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 800 } })
  page.on('pageerror', error => console.error(error.message))
  const milestones = []
  let failCompletion = false
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    let body = []
    if (path === '/api/users/me') body = { id: 1, login: 'test', points: 0, theme: 'PURPLE' }
    else if (path === '/api/tasks/overview') body = { tasks: [], completedCount: 0 }
    else if (path === '/api/auth/csrf') body = { headerName: 'X-CSRF-TOKEN', token: 'test' }
    else if (path.includes('email')) body = { verifiedEmail: null }
    else if (path === '/api/goals') body = [{ id: 1, title: 'Przebiegam 5 km', currentState: null, desiredOutcome: null }]
    else if (path.endsWith('/completion')) {
      if (failCompletion) return route.fulfill({ status: 503, json: { detail: 'Nie udało się zapisać ukończenia.' } })
      const item = milestones.find(value => value.id === Number(path.split('/')[5]))
      item.completed = route.request().postDataJSON().completed
      body = item
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
  await page.getByRole('button', { name: 'Przebiegam 5 km', exact: true }).click()
  await page.getByText('Nie masz jeszcze kamieni milowych dla tego celu.').waitFor()
  const section = page.getByRole('region', { name: 'Kamienie milowe' })
  await section.getByRole('button', { name: 'Dodaj kamień milowy' }).click()
  await section.getByLabel('Nazwa kamienia milowego').fill('  Przebiegam 2 km bez przerwy  ')
  await section.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await section.getByText('Przebiegam 2 km bez przerwy', { exact: true }).waitFor()
  assert.equal(milestones[0].title, 'Przebiegam 2 km bez przerwy')
  await section.getByText('0/1', { exact: true }).waitFor()
  await section.getByRole('checkbox').check()
  await section.getByText('1/1', { exact: true }).waitFor()
  await page.waitForFunction(() => !document.querySelector('.milestone-list input').disabled)
  await section.getByRole('button', { name: 'Dodaj kamień milowy' }).click()
  await section.getByLabel('Nazwa kamienia milowego').fill('Drugi rezultat')
  await section.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await section.getByText('1/2', { exact: true }).waitFor()
  await section.getByRole('checkbox').nth(1).check()
  await section.getByText('2/2', { exact: true }).waitFor()
  await page.waitForFunction(() => [...document.querySelectorAll('.milestone-list input')].every(input => !input.disabled))
  assert.deepEqual(await section.locator('.milestone-row > span').allTextContents(),
    ['Przebiegam 2 km bez przerwy', 'Drugi rezultat'])
  await section.getByRole('checkbox').first().uncheck()
  await section.getByText('1/2', { exact: true }).waitFor()
  await page.waitForFunction(() => !document.querySelector('.milestone-list input').disabled)
  failCompletion = true
  await section.getByRole('checkbox').first().check()
  await section.getByRole('alert').getByText('Nie udało się zapisać ukończenia.').waitFor()
  assert.equal(await section.getByRole('checkbox').first().isChecked(), false)
  assert.equal(await section.getByRole('checkbox').nth(1).isChecked(), true)
  await section.getByText('1/2', { exact: true }).waitFor()
  failCompletion = false
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    await section.getByRole('button', { name: 'Dodaj kamień milowy' }).click()
    await section.getByLabel('Nazwa kamienia milowego').fill('Rezultat '.repeat(12))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await section.getByRole('button', { name: 'Anuluj' }).click()
  }
  await page.reload()
  await page.getByRole('button', { name: 'Cele', exact: true }).click()
  await page.getByRole('button', { name: 'Przebiegam 5 km', exact: true }).click()
  await page.getByText('Przebiegam 2 km bez przerwy', { exact: true }).waitFor()
  await page.getByText('1/2', { exact: true }).waitFor()
  assert.equal(await page.getByRole('checkbox').nth(1).isChecked(), true)
  console.log('PASS milestone completion, undo, counts, order, API error rollback, creation, reload and responsive layout (mock API)')
} finally { await browser.close() }
