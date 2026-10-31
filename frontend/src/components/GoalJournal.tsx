import { useId, useState, useSyncExternalStore } from 'react'
import { ChevronDown, ChevronUp, NotebookPen } from 'lucide-react'
import type { createGoalJournalStore } from '../goalJournal'
import GoalEntryItem from './GoalEntryItem'

export default function GoalJournal({ goalId, store }: {
  goalId: number; store: ReturnType<typeof createGoalJournalStore>
}) {
  const [open, setOpen] = useState(false)
  const contentId = useId()
  const headingId = useId()
  const { data, loading, error } = useSyncExternalStore(store.subscribe, () => store.get(goalId))

  return <section className="goal-journal" aria-labelledby={headingId}>
    <button type="button" id={headingId} className="goal-initial-state-toggle goal-journal-toggle"
      aria-expanded={open} aria-controls={contentId} onClick={() => {
        setOpen(current => !current)
        if (!open) void store.load(goalId)
      }}>
      <span className="goal-initial-state-label"><NotebookPen size={18} strokeWidth={1.8} aria-hidden="true" />
        <span>Dziennik celu{data ? ` (${data.totalElements})` : ''}</span></span>
      {open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
    </button>
    <div className="goal-journal-content" id={contentId} hidden={!open}>
      {loading && <p role="status">Ładowanie wpisów…</p>}
      {error && <div><p className="form-error" role="alert">{error}</p>
        <button type="button" className="goal-picker-link" onClick={() => void store.load(goalId, true)}>Spróbuj ponownie</button>
      </div>}
      {data && (data.entries.length ? <>
        <ul className="goal-journal-list">{data.entries.map(entry => <GoalEntryItem key={entry.id} entry={entry} />)}</ul>
        {data.totalElements > 3 && <p className="goal-journal-total">Łącznie {data.totalElements} wpisów</p>}
      </> : <div className="goal-journal-empty">
        <p>Brak wpisów w dzienniku</p>
        <small>Tutaj możesz zapisywać obserwacje, sukcesy i wnioski z realizacji celu.</small>
      </div>)}
    </div>
  </section>
}
