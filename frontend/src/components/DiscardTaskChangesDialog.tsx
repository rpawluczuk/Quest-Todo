import { useEffect, useId, useRef } from 'react'

export default function DiscardTaskChangesDialog({ onContinue, onDiscard,
  title = 'Odrzucić zmiany?', description = 'Masz niezapisane zmiany. Czy na pewno chcesz zamknąć formularz?',
  cancelLabel = 'Kontynuuj edycję', confirmLabel = 'Odrzuć zmiany', busy = false, error = '' }: {
  readonly onContinue: () => void
  readonly onDiscard: () => void
  readonly title?: string
  readonly description?: string
  readonly cancelLabel?: string
  readonly confirmLabel?: string
  readonly busy?: boolean
  readonly error?: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return <dialog ref={dialog} className="password-dialog discard-task-dialog"
    aria-labelledby={titleId} aria-describedby={descriptionId}
    aria-busy={busy} onCancel={event => { event.preventDefault(); if (!busy) onContinue() }}>
    <h2 id={titleId}>{title}</h2>
    <p id={descriptionId}>{description}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="discard-task-actions">
      <button type="button" className="secondary-button" disabled={busy} onClick={onContinue}>{cancelLabel}</button>
      <button type="button" className="discard-task-button" disabled={busy} onClick={onDiscard}>{confirmLabel}</button>
    </div>
  </dialog>
}
