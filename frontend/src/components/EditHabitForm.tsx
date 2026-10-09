import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import type { Habit } from '../types/Habit'

export default function EditHabitForm({ habit, onSave, onCancel }: {
  habit: Habit
  onSave: (name: string) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(habit.name)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { input.current?.focus() }, [])

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const trimmedName = name.trim()
    if (!trimmedName) { setError('Wpisz nazwę nawyku.'); return }
    if (trimmedName.length > 120) { setError('Nazwa nawyku może mieć maksymalnie 120 znaków.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave(trimmedName)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się zapisać nawyku.')
    } finally {
      setSaving(false)
    }
  }

  return <form className="task-form habit-form edit-form" onSubmit={submit}>
    <label className="form-field">
      <span>Nazwa nawyku</span>
      <input ref={input} value={name} maxLength={120} disabled={saving}
        onChange={event => setName(event.target.value)} required />
    </label>
    <div className="task-actions">
      <button type="submit" disabled={saving}>{saving ? 'Zapisywanie…' : 'Zapisz'}</button>
      <button type="button" className="secondary-button" disabled={saving} onClick={onCancel}>Anuluj</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </form>
}
