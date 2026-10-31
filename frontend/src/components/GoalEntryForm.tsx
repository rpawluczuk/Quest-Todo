import { useId, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { goalEntryLabels } from '../goalJournal'
import type { GoalEntryType } from '../types/GoalEntry'
import AutoResizeTextarea from './AutoResizeTextarea'
import FormSelect, { FormSelectItem } from './FormSelect'

export default function GoalEntryForm({ onSave, onCancel }: {
  onSave: (type: GoalEntryType, content: string) => Promise<void>
  onCancel: () => void
}) {
  const id = useId()
  const [type, setType] = useState<GoalEntryType>('NOTE')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  return <form className="task-form goal-entry-create-form" aria-label="Dodawanie wpisu do dziennika"
    aria-busy={saving} onSubmit={async event => {
      event.preventDefault()
      if (pending.current) return
      if (!content.trim() || content.length > 5000) {
        setError('Wpisz treść od 1 do 5000 znaków.'); return
      }
      pending.current = true; setSaving(true); setError('')
      try { await onSave(type, content.trim()) }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'Nie udało się dodać wpisu.') }
      finally { pending.current = false; setSaving(false) }
    }} onKeyDown={event => {
      if (event.key === 'Escape' && !event.defaultPrevented && !pending.current
        && !event.currentTarget.querySelector('[role="combobox"][aria-expanded="true"]')) {
        event.preventDefault(); event.stopPropagation(); onCancel()
      }
    }}>
    <div className="form-field">
      <label htmlFor={`${id}-type`}>Rodzaj wpisu</label>
      <FormSelect id={`${id}-type`} value={type} onValueChange={value => setType(value as GoalEntryType)}
        disabled={saving} ariaLabel="Rodzaj wpisu" triggerContent={goalEntryLabels[type]}>
        {(Object.keys(goalEntryLabels) as GoalEntryType[]).map(value =>
          <FormSelectItem key={value} value={value}>{goalEntryLabels[value]}</FormSelectItem>)}
      </FormSelect>
    </div>
    <label className="form-field" htmlFor={`${id}-content`}>
      <span>Treść <span className="required-field-marker" aria-hidden="true">*</span></span>
      <AutoResizeTextarea id={`${id}-content`} autoFocus required maxLength={5000} value={content}
        placeholder="Co nowego w realizacji celu?" disabled={saving}
        aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
        onChange={event => setContent(event.target.value)} onKeyDown={event => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault(); event.currentTarget.form?.requestSubmit()
          }
        }} />
    </label>
    {error && <p className="form-error" id={`${id}-error`} role="alert">{error}</p>}
    <div className="task-actions milestone-inline-actions">
      <button type="button" className="milestone-inline-cancel" disabled={saving} onClick={onCancel}>Anuluj</button>
      <button type="submit" className="milestone-inline-submit" disabled={saving || !content.trim()}>
        <Check size={16} aria-hidden="true" />{saving ? 'Dodawanie…' : 'Dodaj'}
      </button>
    </div>
  </form>
}
