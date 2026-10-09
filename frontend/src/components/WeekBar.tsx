import { useState } from 'react'
import { moveWeek, startOfWeek, weekDays } from '../weekDates'

const labels = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']
const fullDate = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'full' })
const rangeDate = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })

export default function WeekBar() {
  const [monday, setMonday] = useState(() => startOfWeek(new Date()))
  const [selectedDay, setSelectedDay] = useState(() => new Date().toDateString())
  const today = new Date()
  const days = weekDays(monday)

  function navigate(direction: -1 | 1) {
    setMonday(current => moveWeek(current, direction, new Date()))
  }

  return (
    <div className="week-bar" role="group" aria-label="Przegląd tygodni">
      <p className="week-range" aria-live="polite" aria-atomic="true">
        {rangeDate.format(days[0])} – {rangeDate.format(days[6])}
      </p>
      <div className="week-navigation">
        <button type="button" className="secondary-button week-arrow" aria-label="Poprzedni tydzień" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
        </button>
        <ol className="week-days">
          {days.map((day, index) => {
            const isToday = day.toDateString() === today.toDateString()
            const isFuture = !isToday && day > today
            const isSelected = day.toDateString() === selectedDay
            return <li key={index}>
              <button type="button"
                className={`week-day${isToday ? ' week-day-today' : ''}${isSelected ? ' week-day-selected' : ''}`}
                aria-label={fullDate.format(day)} aria-pressed={isSelected}
                disabled={isFuture}
                onClick={() => setSelectedDay(day.toDateString())}>
              <span aria-hidden="true">{labels[index]}</span>
              <time aria-label={fullDate.format(day)} aria-current={isToday ? 'date' : undefined}
                dateTime={`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`}>
                {day.getDate()}
              </time>
              </button>
            </li>
          })}
        </ol>
        <button type="button" className="secondary-button week-arrow" aria-label="Następny tydzień"
          disabled={monday >= startOfWeek(today)} onClick={() => navigate(1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  )
}
