import assert from 'node:assert/strict'
import test from 'node:test'
import { getRewardEmptyState } from '../src/rewardEmptyState.ts'

test('guides a new user to add the first reward', () => {
  assert.deepEqual(getRewardEmptyState(0, 0), {
    message: 'Nie masz jeszcze nagród. Dodaj pierwszą i zacznij zbierać na nią punkty!',
    buttonLabel: '+ Dodaj pierwszą nagrodę',
    firstReward: true,
  })
})

test('uses regular wording when purchase history exists', () => {
  assert.deepEqual(getRewardEmptyState(0, 2), {
    message: 'Nie masz obecnie dostępnych nagród.',
    buttonLabel: '+ Dodaj nagrodę',
    firstReward: false,
  })
})

test('does not show an empty state when rewards are available', () => {
  assert.equal(getRewardEmptyState(1, 0), null)
  assert.equal(getRewardEmptyState(2, 3), null)
})
