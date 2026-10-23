import { chromium } from '../../.local-backups/reward-edit-browser-check/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 800 } })
  page.on('pageerror', error => console.error(error.message))
  const milestones = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    let body = []
    if (path === '/api/users/me') body = { id: 1, login: 'test', points: 0, theme: 'PURPLE' }
    else if (path === '/api/tasks/overview') body = { tasks: [], completedCount: 0 }
    else if (path === '/api/auth/csrf') body = { headerName: 'X-CSRF-TOKEN', token: 'test' }
    else if (path.includes('email')) body = { verifiedEmail: null }
    else if (path === '/api/goals') body = [{ id: 1, title: 'Przebiegam 5 km', currentState: null, desiredOutcome: null }]
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
  console.log('PASS milestone empty state, create, cancel, reload and layout at 320/390/1280px (mock API)')
} finally { await browser.close() }
