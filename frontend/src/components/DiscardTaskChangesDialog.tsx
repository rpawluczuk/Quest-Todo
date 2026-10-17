import { useEffect, useId, useRef } from 'react'

export default function DiscardTaskChangesDialog({ onContinue, onDiscard }: {
  readonly onContinue: () => void
  readonly onDiscard: () => void
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
    onCancel={event => { event.preventDefault(); onContinue() }}>
    <h2 id={titleId}>Odrzucić zmiany?</h2>
    <p id={descriptionId}>Masz niezapisane zmiany. Czy na pewno chcesz zamknąć formularz?</p>
    <div className="discard-task-actions">
      <button type="button" className="secondary-button" onClick={onContinue}>Kontynuuj edycję</button>
      <button type="button" className="discard-task-button" onClick={onDiscard}>Odrzuć zmiany</button>
    </div>
  </dialog>
}
