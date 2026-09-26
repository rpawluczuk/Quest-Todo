import { useRef, useState, type SubmitEvent } from 'react'

type CreateRewardFormProps = {
  readonly onAddReward: (title: string, cost: number) => Promise<void>
}

export default function CreateRewardForm({ onAddReward }: CreateRewardFormProps) {
  const [title, setTitle] = useState('')
  const [cost, setCost] = useState('20')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const saving = useRef(false)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving.current) return
    setError('')
    setSuccess('')
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
      await onAddReward(rewardTitle, rewardCost)
      setTitle('')
      setCost('20')
      setSuccess(`Dodano nagrodę: ${rewardTitle}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać nagrody. Spróbuj ponownie.')
    } finally {
      saving.current = false
      setIsSaving(false)
    }
  }

  return (
    <div>
      <form className="task-form" aria-label="Dodaj nagrodę" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Nazwa nagrody</span>
          <input
            type="text"
            value={title}
            onChange={(event) => { setTitle(event.target.value); setSuccess('') }}
            placeholder="Na co chcesz wymienić punkty?"
            disabled={isSaving}
            required
          />
        </label>
        <label className="form-field">
          <span>Koszt (pkt)</span>
          <input
            type="number"
            value={cost}
            onChange={(event) => { setCost(event.target.value); setSuccess('') }}
            min="1"
            max="2147483647"
            step="1"
            disabled={isSaving}
            required
          />
        </label>
        <button type="submit" disabled={isSaving}>{isSaving ? 'Zapisywanie…' : 'Dodaj nagrodę'}</button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
      {success && <p className="reward-status" role="status">{success}</p>}
    </div>
  )
}
