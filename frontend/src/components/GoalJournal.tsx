import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { ChevronDown, ChevronUp, NotebookPen, Plus } from 'lucide-react'
import type { createGoalJournalStore } from '../goalJournal'
import { createGoalEntry } from '../api/goalApi'
import GoalEntryItem from './GoalEntryItem'
import GoalEntryForm from './GoalEntryForm'

export default function GoalJournal({ goalId, store, readOnly, onAdded }: {
  goalId: number; store: ReturnType<typeof createGoalJournalStore>; readOnly: boolean; onAdded: () => void
}) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const addButton = useRef<HTMLButtonElement>(null)
  const contentId = useId()
  const headingId = useId()
  const { data, loading, error } = useSyncExternalStore(store.subscribe, () => store.get(goalId))
  useEffect(() => {
    if (open && creating && !readOnly) {
      document.getElementById(contentId)?.querySelector('textarea')?.focus({ preventScroll: true })
    }
  }, [open, creating, readOnly, contentId])
  function startCreating() {
    setOpen(true); setCreating(true); void store.load(goalId)
    document.getElementById(contentId)?.querySelector('textarea')?.focus({ preventScroll: true })
  }
  function closeForm() {
    setCreating(false)
    addButton.current?.focus({ preventScroll: true })
  }

  return <section className="goal-journal" aria-labelledby={headingId}>
    <div className="goal-journal-header">
    <button type="button" id={headingId} className="goal-initial-state-toggle goal-journal-toggle"
      aria-expanded={open} aria-controls={contentId} onClick={() => {
        setOpen(current => !current)
        if (!open) void store.load(goalId)
      }}>
      <span className="goal-initial-state-label"><NotebookPen size={18} strokeWidth={1.8} aria-hidden="true" />
        <span>Dziennik celu{data ? ` (${data.totalElements})` : ''}</span></span>
      {open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
    </button>
    {!readOnly && <button ref={addButton} type="button" className="add-task-header-button goal-subsection-add"
      aria-label="Dodaj wpis do dziennika" title="Dodaj wpis do dziennika" onClick={startCreating}>
      <Plus size={16} aria-hidden="true" />
    </button>}
    </div>
    <div className="goal-journal-content" id={contentId} hidden={!open}>
      {creating && !readOnly && <GoalEntryForm onCancel={closeForm} onSave={async (type, content) => {
        await store.create(goalId, () => createGoalEntry(goalId, type, content))
        closeForm(); setOpen(true); onAdded()
      }} />}
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
        {!readOnly && !creating && <button type="button" className="goal-picker-link" onClick={startCreating}>
          + Dodaj pierwszy wpis
        </button>}
      </div>)}
    </div>
  </section>
}
