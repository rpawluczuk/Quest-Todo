import { useId } from 'react'
import InfoTooltipButton from './InfoTooltipButton'

export default function HabitPointsField({ value, onChange, disabled }: {
  value: string; onChange: (value: string) => void; disabled: boolean
}) {
  const inputId = useId()
  const message = 'Punkty otrzymasz po osiągnięciu celu tygodniowego'
  return <div className="form-field habit-points-field">
    <span className="habit-points-label">
      <label className="required-field-label" htmlFor={inputId}>
        <span>Punkty</span>
        <span className="required-field-marker" aria-hidden="true">*</span>
      </label>
      <InfoTooltipButton className="habit-points-info" message={message} />
    </span>
    <input id={inputId} type="number" min="0" max="2147483647" step="1" required value={value}
      disabled={disabled} onChange={event => onChange(event.target.value)} />
  </div>
}
