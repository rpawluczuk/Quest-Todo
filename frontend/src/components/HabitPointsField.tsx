import { useId, useState } from 'react'

export default function HabitPointsField({ value, onChange, disabled }: {
  value: string; onChange: (value: string) => void; disabled: boolean
}) {
  const inputId = useId()
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const message = 'Punkty otrzymasz po osiągnięciu celu tygodniowego'
  return <div className="form-field habit-points-field">
    <span className="habit-points-label">
      <label htmlFor={inputId}>
        Punkty <span className="required-field-marker" aria-hidden="true">*</span>
      </label>
      <button type="button" className={`habit-points-info${tooltipOpen ? ' habit-points-info-open' : ''}`}
        aria-label={message} aria-expanded={tooltipOpen} data-tooltip={message}
        onClick={() => setTooltipOpen(open => !open)} onBlur={() => setTooltipOpen(false)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
        </svg>
      </button>
    </span>
    <input id={inputId} type="number" min="0" max="2147483647" step="1" required value={value}
      disabled={disabled} onChange={event => onChange(event.target.value)} />
  </div>
}
