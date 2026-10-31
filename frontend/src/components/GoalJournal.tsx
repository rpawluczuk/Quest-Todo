import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { ChevronDown, ChevronUp, NotebookPen, Plus } from 'lucide-react'
import type { createGoalJournalStore } from '../goalJournal'
import { createGoalEntry, deleteGoalEntry, updateGoalEntry } from '../api/goalApi'
import type { GoalEntry } from '../types/GoalEntry'
import GoalEntryItem from './GoalEntryItem'
import GoalEntryForm from './GoalEntryForm'
import DiscardTaskChangesDialog from './DiscardTaskChangesDialog'

type Editor = { kind: 'create' } | { kind: 'edit'; entry: GoalEntry }

export default function GoalJournal({ goalId, store, readOnly, onNotice }: {
  goalId: number; store: ReturnType<typeof createGoalJournalStore>; readOnly: boolean; onNotice: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [discardAction, setDiscardAction] = useState<{ run: () => void } | null>(null)
  const [deleting, setDeleting] = useState<GoalEntry | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const dirty = useRef(false)
  const deletingNow = useRef(false)
  const mounted = useRef(false)
  const addButton = useRef<HTMLButtonElement>(null)
  const contentId = useId()
  const headingId = useId()
  const { data, loading, error, busy } = useSyncExternalStore(store.subscribe, () => store.get(goalId))
  const creating = editor?.kind === 'create'
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (open && creating && !readOnly) {
      document.getElementById(contentId)?.querySelector('textarea')?.focus({ preventScroll: true })
    }
  }, [open, creating, readOnly, contentId])
  function transition(action: () => void) {
    if (readOnly || store.get(goalId).busy) return
    if (dirty.current) setDiscardAction({ run: action })
    else action()
  }
  function startEditor(next: Editor) {
    setOpen(true); void store.load(goalId)
    if (editor?.kind === next.kind && (next.kind === 'create'
      || (editor.kind === 'edit' && editor.entry.id === next.entry.id))) {
      document.getElementById(contentId)?.querySelector('textarea')?.focus({ preventScroll: true }); return
    }
    transition(() => { dirty.current = false; setEditor(next) })
  }
  function startCreating() { startEditor({ kind: 'create' }) }
  function restoreFocus(entryId?: number) {
    requestAnimationFrame(() => {
      if (!mounted.current) return
      const menu = document.getElementById(contentId)?.querySelector<HTMLButtonElement>(`[data-entry-id="${entryId}"] .task-menu-trigger`)
      ;(menu ?? addButton.current)?.focus({ preventScroll: true })
    })
  }
  function closeForm() {
    const entryId = editor?.kind === 'edit' ? editor.entry.id : undefined
    dirty.current = false; setEditor(null); restoreFocus(entryId)
  }
  function form(current: Editor) {
    const entry = current.kind === 'edit' ? current.entry : undefined
    return <GoalEntryForm key={entry?.id ?? 'create'} entry={entry} onCancel={closeForm}
      onDirtyChange={value => { dirty.current = value }} onSave={async (type, content) => {
        if (entry) await store.update(goalId, () => updateGoalEntry(goalId, entry.id, type, content))
        else await store.create(goalId, () => createGoalEntry(goalId, type, content))
        if (!mounted.current) return
        closeForm(); setOpen(true); onNotice(entry ? 'Wpis został zaktualizowany' : 'Wpis został dodany')
      }} />
  }
  async function confirmDelete() {
    if (!deleting || deletingNow.current || readOnly || store.get(goalId).busy) return
    deletingNow.current = true; setDeleteError('')
    try {
      await store.remove(goalId, deleting.id, () => deleteGoalEntry(goalId, deleting.id))
      if (!mounted.current) return
      setDeleting(null); setOpen(true); restoreFocus(); onNotice('Wpis został usunięty')
    } catch (failure) {
      if (mounted.current) setDeleteError(failure instanceof Error ? failure.message : 'Nie udało się usunąć wpisu.')
    } finally { deletingNow.current = false }
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
      {data && (data.entries.length ? <>
        <ul className="goal-journal-list">{data.entries.map(entry => <GoalEntryItem key={entry.id} entry={entry}
          readOnly={readOnly} disabled={!!busy} onEdit={() => startEditor({ kind: 'edit', entry })}
          onDelete={() => transition(() => {
            dirty.current = false; setEditor(null); setDeleteError(''); setDeleting(entry)
          })}>
          {!readOnly && editor?.kind === 'edit' && editor.entry.id === entry.id ? form(editor) : undefined}
        </GoalEntryItem>)}</ul>
        {data.totalElements > 3 && <p className="goal-journal-total">Łącznie {data.totalElements} wpisów</p>}
      </> : <div className="goal-journal-empty">
        <p>Brak wpisów w dzienniku</p>
        <small>Tutaj możesz zapisywać obserwacje, sukcesy i wnioski z realizacji celu.</small>
        {!readOnly && !creating && <button type="button" className="goal-picker-link" onClick={startCreating}>
          + Dodaj pierwszy wpis
        </button>}
      </div>)}
    </div>
    {discardAction && !readOnly && <DiscardTaskChangesDialog onContinue={() => setDiscardAction(null)}
      onDiscard={() => { const action = discardAction.run; setDiscardAction(null); action() }} />}
    {deleting && !readOnly && <DiscardTaskChangesDialog title="Usunąć wpis z dziennika?"
      description={`Ten wpis zostanie trwale usunięty. Tej operacji nie można cofnąć.\n${deleting.content.slice(0, 100)}`}
      cancelLabel="Anuluj" confirmLabel={busy ? 'Usuwanie…' : 'Usuń'} busy={!!busy} error={deleteError}
      onContinue={() => { const id = deleting.id; setDeleting(null); restoreFocus(id) }}
      onDiscard={() => { void confirmDelete() }} />}
  </section>
}
