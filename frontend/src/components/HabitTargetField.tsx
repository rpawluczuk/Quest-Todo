import { targetLabel } from '../habitTarget'

export default function HabitTargetField({ value, onChange, disabled }: {
  value: number
  onChange: (days: number) => void
  disabled: boolean
}) {
  return <label className="form-field habit-frequency-field">
    <span>
      Cel tygodniowy <span className="required-field-marker" aria-hidden="true">*</span>
    </span>
    <select value={value} onChange={event => onChange(Number(event.target.value))} disabled={disabled} required>
      {[7, 1, 2, 3, 4, 5, 6].map(days => <option key={days} value={days}>
        {days === 7 ? 'Codziennie (7 dni)' : targetLabel(days)}
      </option>)}
    </select>
  </label>
}
