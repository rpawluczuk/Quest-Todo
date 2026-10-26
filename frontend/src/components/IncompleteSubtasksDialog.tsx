import { useEffect, useId, useRef } from 'react'

export default function IncompleteSubtasksDialog({ completed, total, onCancel, onConfirm }: {
  completed: number; total: number; onCancel: () => void; onConfirm: () => void
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
    onClick={event => event.stopPropagation()}
    onCancel={event => { event.preventDefault(); onCancel() }}>
    <h2 id={titleId}>Nie wszystkie podzadania są ukończone</h2>
    <p id={descriptionId}>Ukończono {completed} z {total} podzadań. Czy mimo to chcesz zakończyć zadanie?</p>
    <div className="discard-task-actions">
      <button type="button" className="secondary-button" onClick={onCancel}>Anuluj</button>
      <button type="button" onClick={onConfirm}>Zakończ zadanie</button>
    </div>
  </dialog>
}
