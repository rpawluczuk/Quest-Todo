import { targetLabel } from '../habitTarget'

export default function HabitTargetField({ value, onChange, disabled }: {
  value: number
  onChange: (days: number) => void
  disabled: boolean
}) {
  return <label className="form-field">
    <span>Jak często?</span>
    <select value={value} onChange={event => onChange(Number(event.target.value))} disabled={disabled}>
      {[7, 1, 2, 3, 4, 5, 6].map(days => <option key={days} value={days}>{targetLabel(days)}</option>)}
    </select>
  </label>
}
