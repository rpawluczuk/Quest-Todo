import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import type { Goal } from '../types/Goal'

type GoalCompletionDialogProps = {
  goal: Goal
  onClose: () => void
  onConfirm: () => Promise<void>
}

export default function GoalCompletionDialog({ goal, onClose, onConfirm }: GoalCompletionDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const confirmButton = useRef<HTMLButtonElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    element.showModal()
    requestAnimationFrame(() => confirmButton.current?.focus())
    return () => { if (element.open) element.close() }
  }, [])

  async function confirm() {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await onConfirm()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się oznaczyć celu jako osiągniętego.')
      setSaving(false)
    }
  }

  return <dialog ref={dialog} className="goal-completion-dialog" aria-labelledby="goal-completion-title"
    onCancel={event => { event.preventDefault(); if (!saving) onClose() }}
    onClick={event => { if (event.target === dialog.current && !saving) onClose() }}>
    <div className="goal-completion-dialog-content">
      <div className="goal-completion-dialog-header">
        <div>
          <CheckCircle2 aria-hidden="true" />
          <h2 id="goal-completion-title">Cel osiągnięty?</h2>
        </div>
        <button type="button" className="goal-completion-dialog-close" aria-label="Zamknij" disabled={saving}
          onClick={onClose}><X aria-hidden="true" /></button>
      </div>
      <p>Czy udało Ci się osiągnąć cel „{goal.title}”?</p>
      {goal.desiredOutcome && <section className="goal-completion-criterion">
        <h3>Kiedy uznam cel za osiągnięty?</h3>
        <p>{goal.desiredOutcome}</p>
      </section>}
      <p className="goal-completion-note">Kamienie milowe, zadania i nawyki zachowają swoje dotychczasowe statusy.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="goal-completion-dialog-actions">
        <button type="button" className="secondary-button" disabled={saving} onClick={onClose}>Anuluj</button>
        <button ref={confirmButton} type="button" disabled={saving} onClick={() => void confirm()}>
          {saving ? 'Zapisywanie…' : 'Tak, cel osiągnięty'}
        </button>
      </div>
    </div>
  </dialog>
}
