import { useRef, useState, type SubmitEvent } from 'react'
import type { Reward } from '../types/Reward'

type EditRewardFormProps = {
  readonly reward: Reward
  readonly onSave: (id: number, title: string, cost: number) => Promise<void>
  readonly onCancel: () => void
}

export default function EditRewardForm({ reward, onSave, onCancel }: EditRewardFormProps) {
  const [title, setTitle] = useState(reward.title)
  const [cost, setCost] = useState(String(reward.cost))
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const saving = useRef(false)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving.current) return
    setError('')
    const rewardTitle = title.trim()
    const rewardCost = Number(cost)
    if (!rewardTitle) {
      setError('Wpisz nazwę nagrody — same spacje nie wystarczą.')
      return
    }
    if (!Number.isSafeInteger(rewardCost) || rewardCost < 1 || rewardCost > 2147483647) {
      setError('Koszt musi być liczbą całkowitą od 1 do 2147483647 punktów.')
      return
    }

    saving.current = true
    setIsSaving(true)
    try {
      await onSave(reward.id, rewardTitle, rewardCost)
      onCancel()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać zmian. Spróbuj ponownie.')
    } finally {
      saving.current = false
      setIsSaving(false)
    }
  }

  return (
    <form className="task-form edit-form" aria-label={`Edytuj nagrodę: ${reward.title}`} onSubmit={handleSubmit}>
      <label className="form-field">
        <span>Nazwa nagrody</span>
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={isSaving}
          required
        />
      </label>
      <label className="form-field">
        <span>Koszt (pkt)</span>
        <input
          type="number"
          value={cost}
          onChange={(event) => setCost(event.target.value)}
          min="1"
          max="2147483647"
          step="1"
          disabled={isSaving}
          required
        />
      </label>
      <div className="task-actions">
        <button type="submit" disabled={isSaving}>{isSaving ? 'Zapisywanie…' : 'Zapisz'}</button>
        <button type="button" className="secondary-button" onClick={onCancel} disabled={isSaving}>
          Anuluj
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  )
}
