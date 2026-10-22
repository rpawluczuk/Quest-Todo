import assert from 'node:assert/strict'
import test from 'node:test'
import { completionConditionsMessage, createRefreshGate, displayedCompletionBonusPoints } from '../src/habitBonus.ts'
import type { Habit } from '../src/types/Habit.ts'

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 1, name: 'Nawyk', description: null, createdOn: '2026-10-01', completed: false,
    rewardPoints: 2, weeklyRewardGranted: false, startDate: '2026-10-01', endDate: null,
    completionLimit: 10, completionBonusPoints: 50, requiredSuccessPercent: null,
    regularity: null, completionBonusGranted: false, completionBonusSettledOn: null,
    completionBonusEverGranted: false, completionBonusConditionsLocked: false,
    completionBonusTargetLocked: false, completionBonusAwardPoints: null,
    totalCompletions: 1, status: 'ACTIVE', endedOn: null, endReason: null,
    target: { targetDays: 2, effectiveFrom: '2026-09-28' }, latestTarget: null,
    weeklyCompletedDays: 1, category: null, goalIds: [], goalTitles: [], ...overrides,
  }
}

test('uses configured points while pending and the actual backend award after granting', () => {
  assert.equal(displayedCompletionBonusPoints(habit()), 50)
  assert.equal(displayedCompletionBonusPoints(habit({
    completionBonusGranted: true, completionBonusAwardPoints: 20,
  })), 20)
  assert.equal(displayedCompletionBonusPoints(habit({
    completionBonusGranted: false, completionBonusEverGranted: true, completionBonusAwardPoints: null,
  })), 50)
})

test('explains locks from backend state without deriving eligibility', () => {
  assert.equal(completionConditionsMessage(habit()), null)
  assert.match(completionConditionsMessage(habit({
    completionBonusConditionsLocked: true, completionBonusEverGranted: true,
  }))!, /premia została już przyznana/)
  assert.match(completionConditionsMessage(habit({
    endDate: '2026-10-20', completionLimit: null, requiredSuccessPercent: 80,
    completionBonusConditionsLocked: true, completionBonusSettledOn: '2026-10-21',
  }))!, /nawyk został już rozliczony/)
})

test('deduplicates simultaneous refresh signals and throttles adjacent focus events', async () => {
  const gate = createRefreshGate(10_000)
  let calls = 0
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  const refresh = async () => { calls++; await pending }
  const first = gate(refresh, 20_000)
  const duplicate = gate(refresh, 20_001)
  assert.equal(first, duplicate)
  assert.equal(calls, 1)
  release()
  await first
  await gate(refresh, 20_002)
  assert.equal(calls, 1)
  await gate(async () => { calls++ }, 30_001)
  assert.equal(calls, 2)
})
