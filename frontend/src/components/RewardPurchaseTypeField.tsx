import type { RewardPurchaseType } from '../types/Reward'

export default function RewardPurchaseTypeField({ value, onChange, disabled }: {
  value: RewardPurchaseType
  onChange: (value: RewardPurchaseType) => void
  disabled: boolean
}) {
  return <label className="form-field reward-purchase-type">
    <span>Dostępność nagrody</span>
    <select value={value} onChange={event => onChange(event.target.value as RewardPurchaseType)} disabled={disabled}>
      <option value="REPEATABLE">Wielokrotna</option>
      <option value="ONE_TIME">Jednorazowa</option>
    </select>
    <small>{value === 'ONE_TIME'
      ? 'Po kolejnym zakupie zniknie z dostępnych nagród. Wcześniejsze zakupy nie mają wpływu.'
      : 'Możesz kupować tę nagrodę wielokrotnie.'}</small>
  </label>
}
