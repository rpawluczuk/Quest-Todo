import JournalHistoryControls from './JournalHistoryControls'
import { forwardRef, useEffect, useImperativeHandle, useRef, useSyncExternalStore } from 'react'
import { NotebookPen, Plus, X } from 'lucide-react'
import type { HabitJournalStore } from '../habitJournal'
import EditableJournalEntryItem from './EditableJournalEntryItem'
import { createHabitEntry, updateHabitEntry, deleteHabitEntry } from '../api/habitApi'
import { useJournalEditor, type JournalEditorHandle } from './useJournalEditor'

const HabitJournal = forwardRef<JournalEditorHandle, {
  habitId: number; store: HabitJournalStore; onClose: () => void
  readOnly: boolean; onNotice: (message: string) => void
}>(function HabitJournal({ habitId, store, onClose, readOnly, onNotice }, ref) {
  const { data, loading, error, busy, full, history } = useSyncExternalStore(store.subscribe, () => store.get(habitId))
  const visible = full && history ? history.entries : data?.entries ?? []
  const close = useRef<HTMLButtonElement>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const contentId = `habit-journal-content-${habitId}`
  const { editor, startEditor, startDelete, beforeLeave, form, dialogs, showLess } = useJournalEditor({
    id: habitId, store, readOnly, contentId, addButton, onNotice,
    placeholder: 'Co nowego w realizacji nawyku?',
    api: { create: (type, content) => createHabitEntry(habitId, type, content),
      update: (entry, type, content) => updateHabitEntry(habitId, entry.id, type, content),
      remove: entry => deleteHabitEntry(habitId, entry.id) },
  })
  useImperativeHandle(ref, () => ({ beforeLeave }))
  useEffect(() => {
    void store.load(habitId)
    close.current?.focus({ preventScroll: true })
  }, [habitId, store])
  return <section id={`habit-journal-${habitId}`} className="habit-journal goal-journal"
    aria-labelledby={`habit-journal-heading-${habitId}`} onClick={event => event.stopPropagation()}>
    <div className="habit-journal-header">
      <h4 tabIndex={-1} id={`habit-journal-heading-${habitId}`}><NotebookPen size={18} aria-hidden="true" />
        <span>Dziennik nawyku{data ? ` (${data.totalElements})` : ''}</span></h4>
      {!readOnly && <button ref={addButton} type="button" className="add-task-header-button habit-journal-add"
        aria-label="Dodaj wpis do dziennika" title="Dodaj wpis do dziennika" disabled={busy}
        onClick={() => startEditor({ kind: 'create' })}><Plus size={16} aria-hidden="true" /></button>}
      <button ref={close} type="button" className="habit-journal-close" aria-label="Zamknij dziennik nawyku"
        disabled={busy} onClick={() => beforeLeave(onClose)}><X size={18} aria-hidden="true" /></button>
    </div>
    <div className="goal-journal-content" id={contentId}>
      {editor?.kind === 'create' && form(editor)}
      {loading && <p role="status">Ładowanie wpisów…</p>}
      {error && <div><p className="form-error" role="alert">{error}</p>
        <button type="button" className="goal-picker-link" onClick={() => void store.load(habitId, true)}>Spróbuj ponownie</button>
      </div>}
      {data && (visible.length ? <>
        <ul className="goal-journal-list">{visible.map(entry => <EditableJournalEntryItem key={entry.id} entry={entry}
          readOnly={readOnly} disabled={!!busy} onEdit={() => startEditor({ kind: 'edit', entry })} onDelete={() => startDelete(entry)}>
          {editor?.kind === 'edit' && editor.entry.id === entry.id ? form(editor) : undefined}
        </EditableJournalEntryItem>)}</ul>
        {data.totalElements > 3 && <p className="goal-journal-total">Łącznie {data.totalElements} wpisów</p>}
      </> : <div className="goal-journal-empty"><p>Brak wpisów w dzienniku</p>
        <small>Tutaj możesz zapisywać obserwacje, sukcesy i wnioski z realizacji nawyku.</small>
        {!readOnly && editor?.kind !== 'create' && <button type="button" className="goal-picker-link" disabled={busy}
          onClick={() => startEditor({ kind: 'create' })}>+ Dodaj pierwszy wpis</button>}
      </div>)}
      <JournalHistoryControls id={habitId} store={store}
        onShowLess={() => showLess(data?.entries ?? [], () => store.showLess(habitId), `habit-journal-heading-${habitId}`)} />
    </div>
    {dialogs}
  </section>
})

export default HabitJournal
