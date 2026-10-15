export type RewardPurchaseType = 'REPEATABLE' | 'ONE_TIME'

export type Reward = {
  readonly id: number
  readonly title: string
  readonly cost: number
  readonly purchaseType: RewardPurchaseType
}
