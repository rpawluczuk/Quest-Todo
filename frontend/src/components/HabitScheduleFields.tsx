import { useState } from 'react'
import type { HabitSchedule } from '../types/Habit'
import { dateFromKey, habitToday } from '../weekDates'

const displayDate = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })

function scheduleSummary(value: HabitSchedule): string {
  const start = value.startDate === habitToday()
    ? 'Od dziś'
    : `Od ${displayDate.format(dateFromKey(value.startDate))}`
  const end = value.endDate
    ? `do ${displayDate.format(dateFromKey(value.endDate))}`
    : value.completionLimit !== null
      ? `do ${value.completionLimit} wykonań`
      : 'bez końca'
  return `${start} · ${end}`
}

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
    <p className="habit-schedule-summary">{scheduleSummary(value)}</p>
    {lockMessage && <p className="habit-ending-lock-message" role="note">{lockMessage}</p>}
    <div className="habit-schedule-inputs">
      <label className="form-field">
        <span>Od kiedy <span className="required-field-marker" aria-hidden="true">*</span></span>
        <input type="date" required value={value.startDate} disabled={disabled}
          onChange={event => onChange({ ...value, startDate: event.target.value })} />
      </label>
      <label className="form-field">
        <span>Data zakończenia <span className="required-field-marker" aria-hidden="true">*</span></span>
        <select value={displayedMode} disabled={disabled} required onChange={event => {
          const next = event.target.value as typeof mode
          setMode(next)
          onChange({ ...value, endDate: next === 'date' ? value.startDate : null,
            completionLimit: next === 'count' ? 30 : null,
            completionBonusPoints: null, requiredSuccessPercent: null })
        }}>
          <option value="none">Bez daty końcowej</option>
          <option value="date">W wybranym dniu</option>
          <option value="count">Po określonej liczbie wykonań</option>
        </select>
      </label>
      {displayedMode === 'date' && <label className="form-field">
        <span>Ostatni dzień <span className="required-field-marker" aria-hidden="true">*</span></span>
        <input type="date" required min={value.startDate} value={value.endDate ?? ''} disabled={disabled}
          onChange={event => onChange({ ...value, endDate: event.target.value || null })} />
      </label>}
      {displayedMode === 'count' && <label className="form-field">
        <span>Łączna liczba wykonań <span className="required-field-marker" aria-hidden="true">*</span></span>
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
