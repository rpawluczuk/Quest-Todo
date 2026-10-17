import { useId, useState, type ChangeEventHandler } from 'react'
import AutoResizeTextarea from './AutoResizeTextarea'

export default function TaskNoteField({ value, disabled, initiallyExpanded = false, onChange }: {
  readonly value: string
  readonly disabled: boolean
  readonly initiallyExpanded?: boolean
  readonly onChange: ChangeEventHandler<HTMLTextAreaElement>
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const textareaId = useId()
  const hasNote = Boolean(value.trim())

  function expand() {
    setExpanded(true)
    requestAnimationFrame(() => document.getElementById(textareaId)?.focus())
  }

  if (!expanded) return <button type="button" className="task-note-toggle" disabled={disabled}
    aria-expanded="false" aria-controls={textareaId} onClick={expand}>
    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>
    <span>{hasNote ? 'Edytuj notatkę' : 'Dodaj notatkę'}</span>
  </button>

  return <div className="task-note-field">
    <div className="task-note-heading">
      <label htmlFor={textareaId}>Notatki</label>
      <button type="button" className="task-note-toggle" disabled={disabled}
        aria-expanded="true" aria-controls={textareaId} onClick={() => setExpanded(false)}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 12.5 5-5 5 5" /></svg>
        <span>Zwiń</span>
      </button>
    </div>
    <div className="form-field">
      <AutoResizeTextarea id={textareaId} value={value} disabled={disabled} onChange={onChange} />
    </div>
  </div>
}
