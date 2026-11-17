import { useEffect, useRef, useState, type RefObject } from 'react'
import type { createGoalJournalStore } from '../goalJournal'
import type { GoalEntry, GoalEntryType } from '../types/GoalEntry'
import type { JournalDraft } from '../types/JournalDraft'
import JournalEntryForm from './JournalEntryForm'
import DiscardTaskChangesDialog from './DiscardTaskChangesDialog'

type Editor = { kind: 'create' } | { kind: 'edit'; entry: GoalEntry }
type Store = Pick<ReturnType<typeof createGoalJournalStore>, 'get' | 'load' | 'create' | 'update' | 'remove'>
  & { drafts?: Map<number, JournalDraft> }
export type JournalEditorHandle = { beforeLeave: (action: () => void) => void }

// Shared form lifecycle and confirmations; each container supplies its own API.
export function useJournalEditor({ id, store, readOnly, contentId, addButton, onNotice, onSaved, afterCreate, placeholder, api }: {
  id: number; store: Store; readOnly: boolean; contentId: string
  addButton: RefObject<HTMLButtonElement | null>; onNotice: (message: string) => void
  onSaved?: () => void; placeholder?: string
  afterCreate?: (entry: GoalEntry) => Promise<string>
  api: { create: (type: GoalEntryType, content: string) => Promise<GoalEntry>
    update: (entry: GoalEntry, type: GoalEntryType, content: string) => Promise<GoalEntry>
    remove: (entry: GoalEntry) => Promise<void> }
}) {
  const [editor, setEditor] = useState<Editor | null>(() => {
    const draft = store.drafts?.get(id)
    return draft ? draft.entry ? { kind: 'edit', entry: draft.entry } : { kind: 'create' } : null
  })
  const [discardAction, setDiscardAction] = useState<{ run: () => void } | null>(null)
  const [deleting, setDeleting] = useState<GoalEntry | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const initialDraft = store.drafts?.get(id)
  const dirty = useRef(!!initialDraft && (initialDraft.type !== (initialDraft.entry?.type ?? 'NOTE')
    || initialDraft.content.trim() !== (initialDraft.entry?.content ?? '')))
  const deletingNow = useRef(false)
  const mounted = useRef(false)
  const latestReadOnly = useRef(readOnly)
  latestReadOnly.current = readOnly
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  function beforeLeave(action: () => void) {
    if (store.get(id).busy) { onNotice('Poczekaj na zakończenie zapisu w dzienniku.'); return }
    const proceed = () => { dirty.current = false; store.drafts?.delete(id); setEditor(null); setDeleting(null); action() }
    if (dirty.current) setDiscardAction({ run: proceed })
    else proceed()
  }
  function transition(action: () => void) {
    if (readOnly || store.get(id).busy) return
    if (dirty.current) setDiscardAction({ run: action })
    else action()
  }
  function startEditor(next: Editor) {
    if (readOnly || store.get(id).busy) return
    void store.load(id)
    if (editor?.kind === next.kind && (next.kind === 'create'
      || (editor.kind === 'edit' && editor.entry.id === next.entry.id))) {
      document.getElementById(contentId)?.querySelector('textarea')?.focus({ preventScroll: true }); return
    }
    transition(() => {
      dirty.current = false
      const entry = next.kind === 'edit' ? next.entry : undefined
      store.drafts?.set(id, { entry, type: entry?.type ?? 'NOTE', content: entry?.content ?? '' })
      setEditor(next)
    })
  }
  function restoreFocus(entryId?: number) {
    requestAnimationFrame(() => {
      if (!mounted.current) return
      const menu = document.getElementById(contentId)?.querySelector<HTMLButtonElement>(`[data-entry-id="${entryId}"] .task-menu-trigger`)
      ;(menu ?? addButton.current)?.focus({ preventScroll: true })
    })
  }
  function closeForm() {
    const entryId = editor?.kind === 'edit' ? editor.entry.id : undefined
    dirty.current = false; store.drafts?.delete(id); setEditor(null); restoreFocus(entryId)
  }
  function showLess(preview: GoalEntry[], collapse: () => void, headingId: string) {
    const hidesEditor = editor?.kind === 'edit' && !preview.some(entry => entry.id === editor.entry.id)
    const proceed = () => {
      if (hidesEditor) { dirty.current = false; store.drafts?.delete(id); setEditor(null) }
      collapse()
      requestAnimationFrame(() => {
        if (!mounted.current) return
        const heading = document.getElementById(headingId)
        heading?.focus({ preventScroll: true })
        const bounds = heading?.getBoundingClientRect()
        if (bounds && (bounds.top < 0 || bounds.bottom > innerHeight)) heading?.scrollIntoView({ block: 'nearest' })
      })
    }
    if (hidesEditor && dirty.current) setDiscardAction({ run: proceed })
    else proceed()
  }
  function requireWritable() {
    if (!mounted.current) throw new Error('Stan nawyku lub widok zmienił się. Spróbuj ponownie.')
    if (latestReadOnly.current) throw new Error('Dziennik jest dostępny tylko do odczytu.')
  }
  function form(current: Editor) {
    const entry = current.kind === 'edit' ? current.entry : undefined
    return <JournalEntryForm key={entry?.id ?? 'create'} entry={entry} placeholder={placeholder} readOnly={readOnly} onCancel={closeForm}
      draft={store.drafts?.get(id)} onDraftChange={draft => store.drafts?.set(id, draft)}
      onDirtyChange={value => { dirty.current = value }} onSave={async (type, content) => {
        requireWritable()
        let created: GoalEntry | undefined
        if (entry) await store.update(id, () => { requireWritable(); return api.update(entry, type, content) })
        else await store.create(id, async () => { requireWritable(); created = await api.create(type, content); return created })
        if (!mounted.current) return
        closeForm(); onSaved?.()
        let notice = entry ? 'Wpis został zaktualizowany' : 'Wpis został dodany'
        // POST is already committed. A refresh failure must never offer to repeat it.
        if (created && afterCreate) {
          try { notice = await afterCreate(created) } catch { /* Keep the ordinary entry success notice. */ }
        }
        if (mounted.current) onNotice(notice)
      }} />
  }
  function startDelete(entry: GoalEntry) {
    transition(() => { dirty.current = false; store.drafts?.delete(id); setEditor(null); setDeleteError(''); setDeleting(entry) })
  }
  async function confirmDelete() {
    if (!deleting || deletingNow.current || readOnly || store.get(id).busy) return
    deletingNow.current = true; setDeleteError('')
    try {
      await store.remove(id, deleting.id, () => { requireWritable(); return api.remove(deleting) })
      if (!mounted.current) return
      setDeleting(null); onSaved?.(); restoreFocus(); onNotice('Wpis został usunięty')
    } catch (failure) {
      if (mounted.current) setDeleteError(failure instanceof Error ? failure.message : 'Nie udało się usunąć wpisu.')
    } finally { deletingNow.current = false }
  }
  const busy = !!store.get(id).busy
  const dialogs = <>
    {discardAction && <DiscardTaskChangesDialog onContinue={() => setDiscardAction(null)}
      onDiscard={() => { const action = discardAction.run; setDiscardAction(null); action() }} />}
    {deleting && !readOnly && <DiscardTaskChangesDialog title="Usunąć wpis z dziennika?"
      description={`Ten wpis zostanie trwale usunięty. Tej operacji nie można cofnąć.\n${deleting.content.slice(0, 100)}`}
      cancelLabel="Anuluj" confirmLabel={busy ? 'Usuwanie…' : 'Usuń'} busy={busy} error={deleteError}
      onContinue={() => { const entryId = deleting.id; setDeleting(null); restoreFocus(entryId) }}
      onDiscard={() => { void confirmDelete() }} />}
  </>
  return { editor, startEditor, startDelete, beforeLeave, form, dialogs, showLess }
}
