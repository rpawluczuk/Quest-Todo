import type { HabitHistoryDay, HabitHistoryWeek } from './types/HabitHistory'

export const historyMonthNames = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'] as const

// Use only UTC setters/getters for calendar arithmetic, including years 1–99.
function calendarDate(year: number, month: number, day: number): Date {
  const date = new Date(0)
  date.setUTCFullYear(year, month, day)
  date.setUTCHours(12, 0, 0, 0)
  return date
}

function isoDate(date: Date): string {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function historyMonths(year: number) {
  return historyMonthNames.map((name, month) => {
    const offset = (calendarDate(year, month, 1).getUTCDay() + 6) % 7
    const length = calendarDate(year, month + 1, 0).getUTCDate()
    const rows = Array.from({ length: Math.ceil((offset + length) / 7) }, (_, row) => ({
      weekStart: isoDate(calendarDate(year, month, 1 - offset + row * 7)),
      days: Array.from({ length: 7 }, (_, column) => {
        const day = row * 7 + column - offset + 1
        return day < 1 || day > length ? null : { date: isoDate(calendarDate(year, month, day)), number: day }
      }),
    }))
    return { name, rows }
  })
}

const dateFormat = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
})

export function historyDateLabel(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return dateFormat.format(calendarDate(year, month - 1, day))
}

export function historyDayDescription(day: HabitHistoryDay): string {
  const completion = day.completed ? 'Zapisane wykonanie.' : 'Brak zapisanego wykonania.'
  const status = day.status === 'FUTURE' ? 'Dzień przyszły.' : day.status === 'INACTIVE'
    ? 'Dzień nieaktywny: poza okresem nawyku, pauza lub status zaplanowany.' : 'Dzień aktywny.'
  return `${historyDateLabel(day.date)}. ${completion} ${status}`
}

export function historyWeekPresentation(week: HabitHistoryWeek | undefined) {
  if (!week) return { mark: '—', description: 'Brak danych tygodnia.' }
  const count = week.requiredDays === null
    ? `Zapisane wykonania: ${week.completedDays}. Brak wymaganego progu.`
    : `Wykonano ${week.completedDays} z ${week.requiredDays} wymaganych dni.`
  switch (week.status) {
    case 'MET': return { mark: '✓', description: `Cel osiągnięty. ${count}` }
    case 'MISSED': return { mark: '×', description: `Cel nieosiągnięty. Okres zamknięty. ${count}` }
    case 'IN_PROGRESS': return { mark: `${week.completedDays}/${week.requiredDays ?? '—'}`, description: `Tydzień w toku. ${count}` }
    case 'NEUTRAL': return { mark: '—', description: `Tydzień neutralny, nie podlega ocenie. ${count}` }
  }
}
