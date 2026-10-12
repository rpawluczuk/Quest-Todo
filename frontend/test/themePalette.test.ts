import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const palettes = [...css.matchAll(/:root(?:\[data-theme='pink'\])?\s*\{([^}]+)\}/g)]
  .map(match => Object.fromEntries([...match[1].matchAll(/(--color-[\w-]+):\s*(#[\da-f]{6})/gi)]
    .map(entry => [entry[1], entry[2]])))

function luminance(hex: string) {
  const channels = [1, 3, 5].map(start => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

test('pink overrides every accent token so purple accents cannot leak into it', () => {
  assert.equal(palettes.length, 2)
  assert.ok(Object.keys(palettes[0]).length > 0)
  assert.deepEqual(Object.keys(palettes[1]).sort(), Object.keys(palettes[0]).sort())
})

test('both palettes keep readable primary buttons, links and status text', () => {
  for (const palette of palettes) {
    for (const color of ['--color-primary', '--color-primary-hover']) {
      assert.ok(contrast(palette[color], '#ffffff') >= 4.5, `${color} on white`)
      assert.ok(contrast(palette[color], '#f7f5fa') >= 4.5, `${color} on page`)
    }
    assert.ok(contrast(palette['--color-primary'], palette['--color-primary-soft']) >= 4.5)
    assert.ok(contrast(palette['--color-primary-status-strong'], palette['--color-primary-toast-background']) >= 4.5)
  }
})
