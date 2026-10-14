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

export default function HabitScheduleFields({ value, onChange, disabled }: {
  value: HabitSchedule; onChange: (value: HabitSchedule) => void; disabled: boolean
}) {
  const [mode, setMode] = useState(value.endDate ? 'date' : value.completionLimit !== null ? 'count' : 'none')
  return <fieldset className="habit-schedule-fields">
    <legend>Okres trwania</legend>
    <p className="habit-schedule-summary">{scheduleSummary(value)}</p>
    <div className="habit-schedule-inputs">
      <label className="form-field">
        <span>Od kiedy</span>
        <input type="date" required value={value.startDate} disabled={disabled}
          onChange={event => onChange({ ...value, startDate: event.target.value })} />
      </label>
      <label className="form-field">
        <span>Data zakończenia</span>
        <select value={mode} disabled={disabled} onChange={event => {
          const next = event.target.value
          setMode(next)
          onChange({ ...value, endDate: next === 'date' ? value.startDate : null,
            completionLimit: next === 'count' ? 30 : null })
        }}>
          <option value="none">Bez daty końcowej</option>
          <option value="date">W wybranym dniu</option>
          <option value="count">Po określonej liczbie wykonań</option>
        </select>
      </label>
      {mode === 'date' && <label className="form-field">
        <span>Ostatni dzień</span>
        <input type="date" required min={value.startDate} value={value.endDate ?? ''} disabled={disabled}
          onChange={event => onChange({ ...value, endDate: event.target.value || null })} />
      </label>}
      {mode === 'count' && <label className="form-field">
        <span>Łączna liczba wykonań</span>
        <input type="number" required min="1" max="2147483647" step="1" value={value.completionLimit ?? ''} disabled={disabled}
          onChange={event => onChange({ ...value, completionLimit: event.target.value ? Number(event.target.value) : null })} />
        <small>Od daty rozpoczęcia, niezależnie od celu tygodniowego.</small>
      </label>}
    </div>
  </fieldset>
}
