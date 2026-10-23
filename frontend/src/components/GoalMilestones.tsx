import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { createMilestone, getMilestones, type Milestone } from '../api/goalApi'

export default function GoalMilestones({ goalId }: { goalId: number }) {
  const [items, setItems] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const sending = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    getMilestones(goalId, controller.signal).then(setItems).catch(failure => {
      if (!controller.signal.aborted) setLoadError(failure instanceof Error ? failure.message : 'Nie udało się pobrać kamieni milowych.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [goalId])
  useEffect(() => { if (open) input.current?.focus() }, [open])
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending.current) return
    if (!title.trim()) { setError('Podaj nazwę kamienia milowego.'); return }
    sending.current = true
    setSaving(true)
    setError('')
    try {
      const item = await createMilestone(goalId, title.trim())
      setItems(current => [...current, item].sort((a, b) => a.position - b.position))
      setTitle('')
      setOpen(false)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się dodać kamienia milowego.')
    } finally { sending.current = false; setSaving(false) }
  }
  return <section className="goal-tasks goal-milestones" id={`goal-milestones-${goalId}`}
    aria-labelledby={`milestones-heading-${goalId}`}>
    <h3 id={`milestones-heading-${goalId}`}>Kamienie milowe</h3>
    {loading && <p role="status">Ładowanie kamieni milowych…</p>}
    {loadError && <p className="form-error" role="alert">{loadError}</p>}
    {!loading && !loadError && <>
      {items.length === 0 ? <p className="empty-state">Nie masz jeszcze kamieni milowych dla tego celu.</p>
        : <ol className="milestone-list">{items.map(item => <li key={item.id}>{item.title}</li>)}</ol>}
      {open ? <form className="milestone-form" onSubmit={submit}>
        <label className="form-field"><span>Nazwa kamienia milowego</span>
          <input ref={input} required maxLength={120} value={title} disabled={saving}
            placeholder="Np. Przebiegam 2 km bez przerwy" onChange={event => setTitle(event.target.value)} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="task-actions">
          <button type="submit" disabled={saving}>{saving ? 'Zapisywanie…' : 'Zapisz'}</button>
          <button type="button" className="secondary-button" disabled={saving}
            onClick={() => { setOpen(false); setTitle(''); setError('') }}>Anuluj</button>
        </div>
      </form> : <button type="button" className="secondary-button goal-attach-trigger"
        onClick={() => setOpen(true)}>Dodaj kamień milowy</button>}
    </>}
  </section>
}
