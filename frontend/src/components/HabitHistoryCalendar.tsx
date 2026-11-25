import { useId } from 'react'
import type { HabitHistory } from '../types/HabitHistory'
import { historyDateLabel, historyDayDescription, historyMonths, historyWeekPresentation } from '../habitHistoryCalendar'
import './HabitHistoryCalendar.css'

export type HabitHistoryCalendarProps = { history: HabitHistory; showHeader?: boolean }

const weekdays = [['Pn', 'Poniedziałek'], ['Wt', 'Wtorek'], ['Śr', 'Środa'], ['Cz', 'Czwartek'],
  ['Pt', 'Piątek'], ['So', 'Sobota'], ['Nd', 'Niedziela']]

export default function HabitHistoryCalendar({ history, showHeader = true }: HabitHistoryCalendarProps) {
  const id = useId()
  const days = new Map(history.days.map(day => [day.date, day]))
  const weeks = new Map(history.weeks.map(week => [week.weekStart, week]))

  return <section className="habit-history-calendar" aria-labelledby={showHeader ? `${id}-title` : undefined}
    aria-label={showHeader ? undefined : 'Kalendarz historii nawyku'}>
    {showHeader && <header className="habit-history-header">
      <p className="habit-history-eyebrow">Historia nawyku · {history.year}</p>
      <h2 id={`${id}-title`}>{history.name}</h2>
      <p className="habit-history-context">Stan na {historyDateLabel(history.today)}. Wyniki dotyczą całych tygodni.</p>
    </header>}
    <ul className="habit-history-legend" aria-label="Legenda kalendarza">
      <li><span className="habit-history-sample is-completed" aria-hidden="true" />Wykonano</li>
      <li><span className="habit-history-sample" aria-hidden="true" />Brak wykonania</li>
      <li><span className="habit-history-sample is-muted" aria-hidden="true" />Nieaktywny / przyszły</li>
      <li><span aria-hidden="true">✓</span> Cel osiągnięty</li>
      <li><span aria-hidden="true">×</span> Cel nieosiągnięty</li>
      <li><span aria-hidden="true">2/3</span> Tydzień w toku</li>
      <li><span aria-hidden="true">—</span> Tydzień neutralny</li>
    </ul>
    <p className="habit-history-help">Wybierz wynik tygodnia, aby przeczytać jego opis.</p>
    <div className="habit-history-months">
      {historyMonths(history.year).map((month, index) => <section className="habit-history-month" key={month.name}
        aria-labelledby={`${id}-month-${index}`}>
        <h3 id={`${id}-month-${index}`}>{month.name}</h3>
        <table aria-labelledby={`${id}-month-${index}`}>
          <thead><tr>
            {weekdays.map(([short, full]) => <th scope="col" key={short}><abbr title={full}>{short}</abbr></th>)}
            <th scope="col" className="habit-history-result-heading">Wynik</th>
          </tr></thead>
          <tbody>{month.rows.map(row => {
            const week = weeks.get(row.weekStart)
            const result = historyWeekPresentation(week)
            const description = `Tydzień od ${historyDateLabel(row.weekStart)}. ${result.description}`
            return <tr key={row.weekStart} data-week-start={row.weekStart}>
              {row.days.map((cell, column) => {
                if (!cell) return <td key={column} />
                const day = days.get(cell.date)
                const label = day ? historyDayDescription(day) : `${historyDateLabel(cell.date)}. Brak danych dnia.`
                return <td key={column}>
                  <span className={`habit-history-day${day?.completed ? ' is-completed' : ''}${!day || day.status !== 'ACTIVE' ? ' is-muted' : ''}`}
                    role="img" aria-label={label} title={label} data-date={cell.date}>
                    <span aria-hidden="true">{cell.number}</span>
                  </span>
                </td>
              })}
              <td className="habit-history-result-cell">
                <details className={`habit-history-result status-${week?.status.toLowerCase() ?? 'unknown'}`}>
                  <summary aria-label={description} title={description}><span aria-hidden="true">{result.mark}</span></summary>
                  <p>{description}</p>
                </details>
              </td>
            </tr>
          })}</tbody>
        </table>
      </section>)}
    </div>
  </section>
}
