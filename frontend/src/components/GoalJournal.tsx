import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, useSyncExternalStore } from 'react'
import { ChevronDown, ChevronUp, NotebookPen, Plus } from 'lucide-react'
import type { createGoalJournalStore } from '../goalJournal'
import { createGoalEntry, deleteGoalEntry, updateGoalEntry } from '../api/goalApi'
import GoalEntryItem from './GoalEntryItem'
import { useJournalEditor } from './useJournalEditor'

export type GoalJournalHandle = { beforeStatusChange: (action: () => void) => void }

const GoalJournal = forwardRef<GoalJournalHandle, {
  goalId: number; store: ReturnType<typeof createGoalJournalStore>; readOnly: boolean; onNotice: (message: string) => void
}>(function GoalJournal({ goalId, store, readOnly, onNotice }, ref) {
  const [open, setOpen] = useState(false)
  const addButton = useRef<HTMLButtonElement>(null)
  const contentId = useId()
  const headingId = useId()
  const { data, loading, error, busy, full, history, historyLoading, historyError } = useSyncExternalStore(store.subscribe, () => store.get(goalId))
  const visible = full && history ? history.entries : data?.entries ?? []
  const { editor, setEditor, dirty, mounted, setDiscardAction, startEditor: edit, startDelete, beforeLeave, form, dialogs } = useJournalEditor({
    id: goalId, store, readOnly, contentId, addButton, onNotice, onSaved: () => setOpen(true),
    api: { create: (type, content) => createGoalEntry(goalId, type, content),
      update: (entry, type, content) => updateGoalEntry(goalId, entry.id, type, content),
      remove: entry => deleteGoalEntry(goalId, entry.id) },
  })
  const creating = editor?.kind === 'create'
  useImperativeHandle(ref, () => ({ beforeStatusChange: beforeLeave }))
  useEffect(() => {
    if (open && creating && !readOnly) {
      document.getElementById(contentId)?.querySelector('textarea')?.focus({ preventScroll: true })
    }
  }, [open, creating, readOnly, contentId])
  function startEditor(next: Parameters<typeof edit>[0]) { setOpen(true); edit(next) }
  function startCreating() { startEditor({ kind: 'create' }) }
  function showLess() {
    const collapse = () => {
      if (editor?.kind === 'edit' && !data?.entries.some(entry => entry.id === editor.entry.id)) {
        dirty.current = false; setEditor(null)
      }
      store.showLess(goalId)
      requestAnimationFrame(() => {
        if (!mounted.current) return
        const heading = document.getElementById(headingId)
        heading?.focus({ preventScroll: true })
        const bounds = heading?.getBoundingClientRect()
        if (bounds && (bounds.top < 0 || bounds.bottom > innerHeight)) heading?.scrollIntoView({ block: 'nearest' })
      })
    }
    if (editor?.kind === 'edit' && dirty.current && !data?.entries.some(entry => entry.id === editor.entry.id)) {
      setDiscardAction({ run: collapse })
    } else collapse()
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
      aria-label="Dodaj wpis do dziennika" title="Dodaj wpis do dziennika" disabled={busy} onClick={startCreating}>
      <Plus size={16} aria-hidden="true" />
    </button>}
    </div>
    <div className="goal-journal-content" id={contentId} hidden={!open}>
      {editor?.kind === 'create' && !readOnly && form(editor)}
      {loading && <p role="status">Ładowanie wpisów…</p>}
      {error && <div><p className="form-error" role="alert">{error}</p>
        <button type="button" className="goal-picker-link" onClick={() => void store.load(goalId, true)}>Spróbuj ponownie</button>
      </div>}
      {data && (visible.length ? <>
        <ul className="goal-journal-list">{visible.map(entry => <GoalEntryItem key={entry.id} entry={entry}
          readOnly={readOnly} disabled={!!busy} onEdit={() => startEditor({ kind: 'edit', entry })}
          onDelete={() => startDelete(entry)}>
          {!readOnly && editor?.kind === 'edit' && editor.entry.id === entry.id ? form(editor) : undefined}
        </GoalEntryItem>)}</ul>
      </> : <div className="goal-journal-empty">
        <p>Brak wpisów w dzienniku</p>
        {!readOnly && <small>Zapisuj tutaj obserwacje, sukcesy i wnioski z realizacji celu.</small>}
        {!readOnly && !creating && <button type="button" className="goal-picker-link" onClick={startCreating}>
          + Dodaj pierwszy wpis
        </button>}
      </div>)}
      {full && historyLoading && <p role="status" className="goal-journal-total">Ładowanie historii…</p>}
      {full && historyError && <div><p className="form-error" role="alert">{historyError}</p>
        <button type="button" className="goal-picker-link" disabled={busy || historyLoading}
          onClick={() => { void store.more(goalId) }}>Spróbuj ponownie</button>
      </div>}
      {data && data.totalElements > 3 && <div className="goal-journal-history-actions">
        {!full ? <button type="button" className="goal-picker-link" disabled={busy || historyLoading}
          onClick={() => { void store.showHistory(goalId) }}>Pokaż wszystkie wpisy ({data.totalElements})</button>
          : <>
            {history?.hasMore && !historyError && <button type="button" className="goal-picker-link"
              disabled={busy || historyLoading} onClick={() => { void store.more(goalId) }}>
              {historyLoading ? 'Ładowanie…' : 'Pokaż więcej wpisów'}
            </button>}
            <button type="button" className="goal-picker-link" disabled={busy} onClick={showLess}>Pokaż mniej</button>
          </>}
      </div>}
    </div>
    {dialogs}
  </section>
})

export default GoalJournal
