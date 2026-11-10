import { useEffect, useRef, useSyncExternalStore } from 'react'
import { NotebookPen, X } from 'lucide-react'
import type { HabitJournalStore } from '../habitJournal'
import JournalEntryItem from './JournalEntryItem'

export default function HabitJournal({ habitId, store, onClose }: {
  habitId: number; store: HabitJournalStore; onClose: () => void
}) {
  const { data, loading, error } = useSyncExternalStore(store.subscribe, () => store.get(habitId))
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    void store.load(habitId)
    close.current?.focus({ preventScroll: true })
  }, [habitId, store])
  return <section id={`habit-journal-${habitId}`} className="habit-journal goal-journal"
    aria-labelledby={`habit-journal-heading-${habitId}`} onClick={event => event.stopPropagation()}>
    <div className="habit-journal-header">
      <h4 id={`habit-journal-heading-${habitId}`}><NotebookPen size={18} aria-hidden="true" />
        <span>Dziennik nawyku{data ? ` (${data.totalElements})` : ''}</span></h4>
      <button ref={close} type="button" className="habit-journal-close" aria-label="Zamknij dziennik nawyku"
        onClick={onClose}><X size={18} aria-hidden="true" /></button>
    </div>
    <div className="goal-journal-content">
      {loading && <p role="status">Ładowanie wpisów…</p>}
      {error && <div><p className="form-error" role="alert">{error}</p>
        <button type="button" className="goal-picker-link" onClick={() => void store.load(habitId, true)}>Spróbuj ponownie</button>
      </div>}
      {data && !error && (data.entries.length ? <>
        <ul className="goal-journal-list">{data.entries.map(entry => <JournalEntryItem key={entry.id} entry={entry} />)}</ul>
        {data.totalElements > 3 && <p className="goal-journal-total">Łącznie {data.totalElements} wpisów</p>}
      </> : <div className="goal-journal-empty"><p>Brak wpisów w dzienniku</p>
        <small>Tutaj możesz zapisywać obserwacje, sukcesy i wnioski z realizacji nawyku.</small>
      </div>)}
    </div>
  </section>
}
