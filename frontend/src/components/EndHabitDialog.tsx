import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { Habit, HabitEndReason } from '../types/Habit'

const reasons: ReadonlyArray<{ value: HabitEndReason; label: string }> = [
  { value: 'ACHIEVED', label: 'Osiągnąłem zamierzony efekt' },
  { value: 'ESTABLISHED', label: 'Nawyk jest już utrwalony' },
  { value: 'STOPPED', label: 'Nie chcę go dalej realizować' },
]

export default function EndHabitDialog({ habit, onClose, onConfirm }: {
  habit: Habit
  onClose: () => void
  onConfirm: (reason: HabitEndReason) => Promise<void>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const [reason, setReason] = useState<HabitEndReason | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || reason === null) return
    setBusy(true)
    setError('')
    try { await onConfirm(reason) }
    catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się zakończyć nawyku.')
      setBusy(false)
    }
  }

  function close() {
    if (!busy) onClose()
  }

  return <dialog ref={dialog} className="password-dialog end-habit-dialog" aria-labelledby={titleId}
    aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); close() }}>
    <button type="button" className="password-dialog-close" aria-label="Zamknij" disabled={busy} onClick={close}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="m6 6 12 12M18 6 6 18" />
      </svg>
    </button>
    <h2 id={titleId}>Zakończ nawyk</h2>
    <p id={descriptionId}>„{habit.name}” zniknie z bieżącej listy. Historia wykonań i zdobyte punkty pozostaną bez zmian.</p>
    <form className="login-form end-habit-form" onSubmit={submit} aria-busy={busy}>
      <fieldset>
        <legend>Dlaczego kończysz ten nawyk?</legend>
        <div className="end-habit-reasons">
          {reasons.map(option => <label key={option.value}>
            <input type="radio" name="end-reason" value={option.value} checked={reason === option.value}
              disabled={busy} onChange={() => setReason(option.value)} />
            <span>{option.label}</span>
          </label>)}
        </div>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy || reason === null}>{busy ? 'Kończenie…' : 'Zakończ nawyk'}</button>
      <button type="button" className="password-dialog-cancel" disabled={busy} onClick={close}>Anuluj</button>
    </form>
  </dialog>
}
