import { useId, useState } from 'react'
import { Info } from 'lucide-react'

export default function HabitPointsField({ value, onChange, disabled }: {
  value: string; onChange: (value: string) => void; disabled: boolean
}) {
  const inputId = useId()
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const message = 'Punkty otrzymasz po osiągnięciu celu tygodniowego'
  return <div className="form-field habit-points-field">
    <span className="habit-points-label">
      <label className="required-field-label" htmlFor={inputId}>
        <span>Punkty</span>
        <span className="required-field-marker" aria-hidden="true">*</span>
      </label>
      <button type="button" className={`habit-points-info${tooltipOpen ? ' habit-points-info-open' : ''}`}
        aria-label={message} aria-expanded={tooltipOpen} data-tooltip={message}
        onClick={() => setTooltipOpen(open => !open)} onBlur={() => setTooltipOpen(false)}>
        <Info size={18} strokeWidth={2} aria-hidden="true" />
      </button>
    </span>
    <input id={inputId} type="number" min="0" max="2147483647" step="1" required value={value}
      disabled={disabled} onChange={event => onChange(event.target.value)} />
  </div>
}
