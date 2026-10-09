import { useEffect, useRef, useState, type SubmitEvent } from 'react'

export default function CreateHabitForm({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const wasExpanded = useRef(false)

  useEffect(() => {
    if (expanded) input.current?.focus()
    else if (wasExpanded.current) trigger.current?.focus()
    wasExpanded.current = expanded
  }, [expanded])

  function cancel() {
    setName('')
    setError('')
    setExpanded(false)
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const trimmedName = name.trim()
    if (!trimmedName) { setError('Wpisz nazwę nawyku.'); return }
    if (trimmedName.length > 120) { setError('Nazwa nawyku może mieć maksymalnie 120 znaków.'); return }
    setSaving(true)
    setError('')
    try {
      await onAdd(trimmedName)
      setName('')
      setExpanded(false)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się dodać nawyku.')
    } finally {
      setSaving(false)
    }
  }

  return expanded ? <form className="task-form habit-form" onSubmit={submit}>
    <label className="form-field">
      <span>Nazwa nawyku</span>
      <input ref={input} value={name} maxLength={120} disabled={saving}
        onChange={event => setName(event.target.value)} placeholder="Np. Przeczytać 10 stron" required />
    </label>
    <div className="task-actions">
      <button type="submit" disabled={saving}>{saving ? 'Zapisywanie…' : 'Dodaj nawyk'}</button>
      <button type="button" className="secondary-button" disabled={saving} onClick={cancel}>Anuluj</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </form> : <button ref={trigger} type="button" className="secondary-button add-task-toggle"
    onClick={() => setExpanded(true)}>+ Dodaj nawyk</button>
}
