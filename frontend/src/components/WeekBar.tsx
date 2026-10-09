import { useState } from 'react'
import { dateFromKey, dateKey, moveWeek, selectedDayInWeek, startOfWeek, weekDays } from '../weekDates'

const labels = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']
const fullDate = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'full' })
const rangeDate = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })

export default function WeekBar({ selectedDay, today: todayKey, onSelect, disabled = false }: {
  selectedDay: string
  today: string
  onSelect: (date: string) => void
  disabled?: boolean
}) {
  const [monday, setMonday] = useState(() => startOfWeek(dateFromKey(selectedDay)))
  const today = dateFromKey(todayKey)
  const days = weekDays(monday)

  function navigate(direction: -1 | 1) {
    const next = moveWeek(monday, direction, today)
    setMonday(next)
    onSelect(selectedDayInWeek(selectedDay, next, todayKey))
  }

  return (
    <div className="week-bar" role="group" aria-label="Przegląd tygodni">
      <p className="week-range" aria-live="polite" aria-atomic="true">
        {rangeDate.format(days[0])} – {rangeDate.format(days[6])}
      </p>
      <div className="week-navigation">
        <button type="button" className="secondary-button week-arrow" aria-label="Poprzedni tydzień" disabled={disabled} onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
        </button>
        <ol className="week-days">
          {days.map((day, index) => {
            const key = dateKey(day)
            const isToday = key === todayKey
            const isFuture = key > todayKey
            const isSelected = key === selectedDay
            return <li key={index}>
              <button type="button"
                className={`week-day${isToday ? ' week-day-today' : ''}${isSelected ? ' week-day-selected' : ''}`}
                aria-label={fullDate.format(day)} aria-pressed={isSelected}
                disabled={disabled || isFuture}
                onClick={() => onSelect(key)}>
              <span aria-hidden="true">{labels[index]}</span>
              <time aria-label={fullDate.format(day)} aria-current={isToday ? 'date' : undefined}
                dateTime={key}>
                {day.getDate()}
              </time>
              </button>
            </li>
          })}
        </ol>
        <button type="button" className="secondary-button week-arrow" aria-label="Następny tydzień"
          disabled={disabled || monday >= startOfWeek(today)} onClick={() => navigate(1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  )
}
