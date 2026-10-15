import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import type { RewardPurchaseType } from '../types/Reward'
import RewardPurchaseTypeField from './RewardPurchaseTypeField'

type CreateRewardFormProps = {
  readonly onAddReward: (title: string, cost: number, purchaseType: RewardPurchaseType) => Promise<void>
  readonly emptyStateButtonLabel?: string
}

export default function CreateRewardForm({ onAddReward, emptyStateButtonLabel }: CreateRewardFormProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [title, setTitle] = useState('')
  const [cost, setCost] = useState('20')
  const [purchaseType, setPurchaseType] = useState<RewardPurchaseType>('REPEATABLE')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const saving = useRef(false)
  const addButton = useRef<HTMLButtonElement>(null)
  const titleInput = useRef<HTMLInputElement>(null)
  const wasExpanded = useRef(false)

  useEffect(() => {
    if (isExpanded) titleInput.current?.focus()
    else if (wasExpanded.current) addButton.current?.focus()
    wasExpanded.current = isExpanded
  }, [isExpanded])

  function cancel() {
    setPurchaseType('REPEATABLE')
    setTitle('')
    setCost('20')
    setError('')
    setIsExpanded(false)
  }

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
      await onAddReward(rewardTitle, rewardCost, purchaseType)
      setPurchaseType('REPEATABLE')
      setTitle('')
      setCost('20')
      setSuccess(`Dodano nagrodę: ${rewardTitle}.`)
      setIsExpanded(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać nagrody. Spróbuj ponownie.')
    } finally {
      saving.current = false
      setIsSaving(false)
    }
  }

  return (
    <div className="create-reward-form">
      {isExpanded ? <form className="task-form" aria-label="Dodaj nagrodę" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Nazwa nagrody</span>
          <input
            ref={titleInput}
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
        <RewardPurchaseTypeField value={purchaseType} onChange={setPurchaseType} disabled={isSaving} />
        <div className="task-actions">
          <button type="submit" disabled={isSaving}>{isSaving ? 'Zapisywanie…' : 'Dodaj nagrodę'}</button>
          <button type="button" className="secondary-button" disabled={isSaving} onClick={cancel}>Anuluj</button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form> : <button ref={addButton} type="button"
        className={`${emptyStateButtonLabel ? 'empty-state-primary-button' : 'secondary-button'} add-reward-toggle`}
        onClick={() => { setSuccess(''); setIsExpanded(true) }}>
        {emptyStateButtonLabel ?? '+ Dodaj nagrodę'}
      </button>}
      {success && <p className="reward-status" role="status">{success}</p>}
    </div>
  )
}
