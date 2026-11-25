import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { getHabitHistory, HabitHistoryError } from '../api/habitApi'
import HabitHistoryCalendar from '../components/HabitHistoryCalendar'
import type { HabitHistory } from '../types/HabitHistory'
import { habitToday } from '../weekDates'
import { historyDateLabel } from '../habitHistoryCalendar'
import './HabitHistoryPage.css'

type LoadState = { id: number; year: number; attempt: number } & (
  { data: HabitHistory; error?: never; notFound?: never } | { data?: never; error: string; notFound: boolean }
)

export default function HabitHistoryPage({ habitId, year, onYearChange, onBack }: {
  habitId: number | null; year: number | null; onYearChange: (year: number) => void; onBack: () => void
}) {
  const [result, setResult] = useState<LoadState | null>(null)
  const [attempt, setAttempt] = useState(0)
  const title = useRef<HTMLHeadingElement>(null)
  const currentYear = Number(habitToday().slice(0, 4))
  const selected = result?.id === habitId && result.year === year && result.attempt === attempt ? result : null

  useEffect(() => { title.current?.focus({ preventScroll: true }) }, [])
  useEffect(() => {
    if (habitId === null || year === null) return
    const controller = new AbortController()
    getHabitHistory(habitId, year, controller.signal).then(data => {
      if (controller.signal.aborted) return
      if (data.id !== habitId || data.year !== year) throw new Error('Otrzymano historię dla innego nawyku lub roku.')
      setResult({ id: habitId, year, attempt, data })
    }).catch(failure => {
      if (!controller.signal.aborted) setResult({ id: habitId, year, attempt,
        error: failure instanceof HabitHistoryError ? failure.message : 'Nie udało się pobrać historii. Sprawdź połączenie i spróbuj ponownie.',
        notFound: failure instanceof HabitHistoryError && failure.status === 404 })
    })
    return () => controller.abort()
  }, [habitId, year, attempt])

  return <section className="habit-history-page" aria-labelledby="habit-history-page-title">
    <button type="button" className="secondary-button habit-history-back" onClick={onBack}>
      <ArrowLeft size={17} aria-hidden="true" />Wróć do nawyków
    </button>
    <header className="habit-history-page-header">
      <p className="habit-history-eyebrow">Historia nawyku</p>
      <h2 id="habit-history-page-title" ref={title} tabIndex={-1}>{selected?.data?.name ?? 'Roczna historia nawyku'}</h2>
      {year !== null && habitId !== null && <nav className="habit-history-years" aria-label="Wybór roku historii">
        <button type="button" className="secondary-button" aria-label="Poprzedni rok" disabled={year <= 1}
          onClick={() => onYearChange(year - 1)}><ChevronLeft size={20} aria-hidden="true" /></button>
        <span className="habit-history-selected-year" aria-live="polite" aria-atomic="true">{year}</span>
        <button type="button" className="secondary-button" aria-label="Następny rok" disabled={year >= Math.min(currentYear, 9999)}
          onClick={() => onYearChange(year + 1)}><ChevronRight size={20} aria-hidden="true" /></button>
        {year !== currentYear && <button type="button" className="secondary-button" onClick={() => onYearChange(currentYear)}>Bieżący rok</button>}
      </nav>}
    </header>
    {habitId === null ? <p className="form-error" role="alert">Nieprawidłowy identyfikator nawyku w adresie.</p>
      : year === null ? <div role="alert" className="habit-history-message">
        <p>Nieprawidłowy rok w adresie. Podaj jeden rok od 1 do 9999.</p>
        <button type="button" className="secondary-button" onClick={() => onYearChange(currentYear)}>Otwórz bieżący rok</button>
      </div>
      : !selected ? <p role="status" aria-live="polite">Ładowanie historii…</p>
      : selected.error ? <div className="habit-history-message">
        <p className="form-error" role="alert">{selected.error}</p>
        {!selected.notFound && <button type="button" className="secondary-button" onClick={() => setAttempt(value => value + 1)}>Spróbuj ponownie</button>}
      </div>
      : selected.data && <>
        <p className="habit-history-context">Stan na {historyDateLabel(selected.data.today)}. Wyniki dotyczą całych tygodni.</p>
        <HabitHistoryCalendar history={selected.data} showHeader={false} />
      </>}
  </section>
}
