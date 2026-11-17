import JournalHistoryControls from './JournalHistoryControls'
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, useSyncExternalStore } from 'react'
import { ChevronDown, ChevronUp, NotebookPen, Plus } from 'lucide-react'
import type { createGoalJournalStore } from '../goalJournal'
import { createGoalEntry, deleteGoalEntry, updateGoalEntry } from '../api/goalApi'
import GoalEntryItem from './GoalEntryItem'
import { useJournalEditor } from './useJournalEditor'
import type { GoalEntry } from '../types/GoalEntry'

export type GoalJournalHandle = { beforeStatusChange: (action: () => void) => void; openCreate: () => void }

const GoalJournal = forwardRef<GoalJournalHandle, {
  goalId: number; store: ReturnType<typeof createGoalJournalStore>; readOnly: boolean; onNotice: (message: string) => void
  onEntryCreated?: (entry: GoalEntry) => Promise<string>
}>(function GoalJournal({ goalId, store, readOnly, onNotice, onEntryCreated }, ref) {
  const [open, setOpen] = useState(false)
  const addButton = useRef<HTMLButtonElement>(null)
  const contentId = useId()
  const headingId = useId()
  const [revealRequest, setRevealRequest] = useState(0)
  const { data, loading, error, busy, full, history } = useSyncExternalStore(store.subscribe, () => store.get(goalId))
  const visible = full && history ? history.entries : data?.entries ?? []
  const { editor, showLess: collapseHistory, startEditor: edit, startDelete, beforeLeave, form, dialogs } = useJournalEditor({
    id: goalId, store, readOnly, contentId, addButton, onNotice, onSaved: () => setOpen(true), afterCreate: onEntryCreated,
    api: { create: (type, content) => createGoalEntry(goalId, type, content),
      update: (entry, type, content) => updateGoalEntry(goalId, entry.id, type, content),
      remove: entry => deleteGoalEntry(goalId, entry.id) },
  })
  const creating = editor?.kind === 'create'
  useImperativeHandle(ref, () => ({ beforeStatusChange: beforeLeave, openCreate: () => {
    if (readOnly || busy) return
    setRevealRequest(current => current + 1)
    startCreating()
  } }))
  useEffect(() => {
    if (open && creating && !readOnly) {
      document.getElementById(contentId)?.querySelector('textarea')?.focus({ preventScroll: true })
    }
  }, [open, creating, readOnly, contentId])
  useEffect(() => {
    if (!revealRequest || !open || !creating || readOnly) return
    const frame = requestAnimationFrame(() => {
      const textarea = document.getElementById(contentId)?.querySelector('textarea')
      textarea?.focus({ preventScroll: true })
      textarea?.closest('form')?.scrollIntoView({ block: 'nearest',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    })
    return () => cancelAnimationFrame(frame)
  }, [revealRequest, open, creating, readOnly, contentId])
  function startEditor(next: Parameters<typeof edit>[0]) { setOpen(true); edit(next) }
  function startCreating() { startEditor({ kind: 'create' }) }
  function showLess() { collapseHistory(data?.entries ?? [], () => store.showLess(goalId), headingId) }
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
      <JournalHistoryControls id={goalId} store={store} onShowLess={showLess} />
    </div>
    {dialogs}
  </section>
})

export default GoalJournal
