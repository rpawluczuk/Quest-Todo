export type RewardEmptyState = {
  message: string
  buttonLabel: string
  firstReward: boolean
}

export function getRewardEmptyState(rewardCount: number, purchaseCount: number): RewardEmptyState | null {
  if (rewardCount > 0) return null

  const firstReward = purchaseCount === 0
  return {
    message: firstReward
      ? 'Nie masz jeszcze nagród. Dodaj pierwszą i zacznij zbierać na nią punkty!'
      : 'Nie masz obecnie dostępnych nagród.',
    buttonLabel: firstReward ? '+ Dodaj pierwszą nagrodę' : '+ Dodaj nagrodę',
    firstReward,
  }
}
