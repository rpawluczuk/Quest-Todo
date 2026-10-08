import assert from 'node:assert/strict'
import test from 'node:test'
import { canDeleteAccount, currentPasswordError, loginConfirmationError } from '../src/deleteAccountValidation.ts'

test('requires the exact current login', () => {
  assert.equal(loginConfirmationError('demo7', ''), 'Wpisz swój login.')
  assert.equal(loginConfirmationError('demo7', 'Demo7'), 'Wpisany login nie jest zgodny z loginem konta.')
  assert.equal(loginConfirmationError('demo7', 'demo7'), '')
})

test('requires a present password within the backend byte limit', () => {
  assert.equal(currentPasswordError(''), 'Podaj obecne hasło.')
  assert.equal(currentPasswordError('password123'), '')
  assert.equal(currentPasswordError('ą'.repeat(37)), 'Hasło jest za długie. Wpisz poprawne obecne hasło.')
})

test('enables deletion only after all confirmations are valid', () => {
  assert.equal(canDeleteAccount('demo7', 'demo7', 'password123', true), true)
  assert.equal(canDeleteAccount('demo7', 'wrong', 'password123', true), false)
  assert.equal(canDeleteAccount('demo7', 'demo7', '', true), false)
  assert.equal(canDeleteAccount('demo7', 'demo7', 'password123', false), false)
})
