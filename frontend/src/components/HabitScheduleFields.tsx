import { useState } from 'react'
import type { HabitSchedule } from '../types/Habit'
import FormSelect, { FormSelectItem } from './FormSelect'

const modeLabels = {
  none: 'Bezterminowo',
  date: 'W określonym dniu',
  count: 'Po określonej liczbie wykonań',
} as const

function scheduleMode(value: HabitSchedule): 'none' | 'date' | 'count' {
  return value.endDate ? 'date' : value.completionLimit !== null ? 'count' : 'none'
}

export default function HabitScheduleFields({ value, onChange, disabled, lockMessage }: {
  value: HabitSchedule; onChange: (value: HabitSchedule) => void; disabled: boolean; lockMessage?: string | null
}) {
  const [mode, setMode] = useState(() => scheduleMode(value))
  const displayedMode = lockMessage ? scheduleMode(value) : mode
  return <fieldset className="habit-schedule-fields">
    <legend>Okres trwania</legend>
    {lockMessage && <p className="habit-ending-lock-message" role="note">{lockMessage}</p>}
    <div className="habit-schedule-inputs">
      <label className="form-field">
        <span>Od kiedy <span className="required-field-marker" aria-hidden="true">*</span></span>
        <input type="date" required value={value.startDate} disabled={disabled}
          onChange={event => onChange({ ...value, startDate: event.target.value })} />
      </label>
      <div className="form-field">
        <span>Sposób zakończenia <span className="required-field-marker" aria-hidden="true">*</span></span>
        <FormSelect value={displayedMode} disabled={disabled} required ariaLabel="Sposób zakończenia"
          triggerContent={<span>{modeLabels[displayedMode]}</span>} onValueChange={selectedMode => {
          const next = selectedMode as typeof mode
          setMode(next)
          onChange({ ...value, endDate: next === 'date' ? value.startDate : null,
            completionLimit: next === 'count' ? 30 : null,
            completionBonusPoints: null, requiredSuccessPercent: null })
        }}>
          {(Object.keys(modeLabels) as Array<keyof typeof modeLabels>).map(option =>
            <FormSelectItem className="goal-select-item" key={option} value={option}>
              {modeLabels[option]}
            </FormSelectItem>)}
        </FormSelect>
      </div>
      {displayedMode === 'date' && <label className="form-field">
        <span>Data zakończenia <span className="required-field-marker" aria-hidden="true">*</span></span>
        <input type="date" required min={value.startDate} value={value.endDate ?? ''} disabled={disabled}
          onChange={event => onChange({ ...value, endDate: event.target.value || null })} />
      </label>}
      {displayedMode === 'count' && <label className="form-field">
        <span>Liczba wykonań <span className="required-field-marker" aria-hidden="true">*</span></span>
        <input type="number" required min="1" max="2147483647" step="1" value={value.completionLimit ?? ''} disabled={disabled}
          onChange={event => onChange({ ...value, completionLimit: event.target.value ? Number(event.target.value) : null })} />
        <small>Od daty rozpoczęcia, niezależnie od celu tygodniowego.</small>
      </label>}
      {displayedMode !== 'none' && <label className="form-field habit-completion-bonus-field">
        <span>Premia za ukończenie (pkt)</span>
        <input type="number" min="1" max="2147483647" step="1" value={value.completionBonusPoints ?? ''}
          disabled={disabled} onChange={event => onChange({ ...value,
            completionBonusPoints: event.target.value === '' ? null : Number(event.target.value),
            requiredSuccessPercent: event.target.value === '' || displayedMode !== 'date' ? null : value.requiredSuccessPercent })} />
      </label>}
      {displayedMode === 'date' && value.completionBonusPoints !== null && <label className="form-field habit-completion-bonus-field">
        <span>Wymagana regularność (%) <span className="required-field-marker" aria-hidden="true">*</span></span>
        <input type="number" required min="1" max="100" step="1" value={value.requiredSuccessPercent ?? ''}
          disabled={disabled} onChange={event => onChange({ ...value,
            requiredSuccessPercent: event.target.value === '' ? null : Number(event.target.value) })} />
        <small>Premię otrzymasz po zakończeniu nawyku, jeśli osiągniesz wymagany procent zaliczonych tygodni</small>
      </label>}
    </div>
  </fieldset>
}
