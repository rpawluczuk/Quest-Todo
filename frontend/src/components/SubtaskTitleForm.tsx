import { useEffect, useId, useRef, useState } from 'react'
import { Check } from 'lucide-react'

export default function SubtaskTitleForm({ initialTitle = '', editing = false, busy, onSave, onCancel }: {
  initialTitle?: string; editing?: boolean; busy: boolean
  onSave: (title: string) => Promise<void>; onCancel: () => void
}) {
  const [title, setTitle] = useState(initialTitle)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const errorId = useId()
  useEffect(() => { input.current?.focus() }, [])
  async function submit() {
    if (pending.current || busy || !title.trim() || title.length > 120) return
    if (editing && title.trim() === initialTitle) { onCancel(); return }
    pending.current = true
    setError('')
    try { await onSave(title.trim()) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Nie udało się zapisać podzadania.') }
    finally { pending.current = false }
  }
  return <form className="milestone-create-form subtask-title-form" onSubmit={event => { event.preventDefault(); void submit() }}
    onKeyDown={event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation()
        if (!busy && !pending.current) onCancel()
      }
    }}>
    <label className="form-field"><span className="visually-hidden">Tytuł podzadania</span>
      <input ref={input} value={title} required maxLength={120} disabled={busy} placeholder="Tytuł podzadania…"
        aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}
        onChange={event => setTitle(event.target.value)} />
    </label>
    {error && <p id={errorId} className="form-error" role="alert">{error}</p>}
    <div className="task-actions milestone-inline-actions">
      <button type="button" className="milestone-inline-cancel" disabled={busy} onClick={onCancel}>Anuluj</button>
      <button type="submit" className="milestone-inline-submit" disabled={busy || !title.trim() || title.length > 120}>
        <Check size={16} aria-hidden="true" />{busy ? 'Zapisywanie…' : editing ? 'Zapisz' : 'Dodaj'}
      </button>
    </div>
  </form>
}
