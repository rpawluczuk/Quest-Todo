import type { Habit } from './types/Habit'

export function displayedCompletionBonusPoints(habit: Habit): number | null {
  return habit.completionBonusGranted
    ? habit.completionBonusAwardPoints
    : habit.completionBonusPoints
}

export function completionConditionsMessage(habit: Habit): string | null {
  if (!habit.completionBonusConditionsLocked) return null
  if (habit.completionBonusEverGranted === true) {
    return 'Warunki zakończenia są zablokowane, ponieważ premia została już przyznana.'
  }
  if (habit.endDate && habit.completionBonusSettledOn) {
    return 'Warunki zakończenia są zablokowane, ponieważ nawyk został już rozliczony.'
  }
  return 'Warunki zakończenia są zablokowane ze względu na wcześniejsze rozliczenie premii.'
}

export function createRefreshGate(minimumIntervalMs: number, initializedAt = 0) {
  let lastStarted = initializedAt
  let running: Promise<void> | null = null
  return (refresh: () => Promise<void>, now = Date.now(), force = false): Promise<void> => {
    if (running) return running
    if (!force && now - lastStarted < minimumIntervalMs) return Promise.resolve()
    lastStarted = now
    running = refresh().finally(() => { running = null })
    return running
  }
}
