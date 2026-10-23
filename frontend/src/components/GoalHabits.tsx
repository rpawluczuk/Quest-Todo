import { useEffect, useId, useRef, useState } from 'react'
import { getAvailableGoalHabits, getGoalHabits, setGoalHabit, type GoalHabit } from '../api/goalApi'
import TaskActionsMenu from './TaskActionsMenu'
import { Plus } from 'lucide-react'

export default function GoalHabits({ goalId, goalTitle, onGoalLinksChanged }: {
  goalId: number; goalTitle: string; onGoalLinksChanged: () => void
}) {
  const [attached, setAttached] = useState<GoalHabit[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [available, setAvailable] = useState<GoalHabit[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)
  const sending = useRef(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  useEffect(() => {
    const controller = new AbortController()
    getGoalHabits(goalId, controller.signal).then(result => {
      if (!controller.signal.aborted) { setAttached(result); setLoadError('') }
    }).catch(failure => {
      if (!controller.signal.aborted) setLoadError(failure instanceof Error ? failure.message : 'Nie udało się pobrać nawyków.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [goalId, retry])

  useEffect(() => {
    if (!pickerOpen || queryInput.trim() === query) return
    const timer = window.setTimeout(() => { setPickerLoading(true); setQuery(queryInput.trim()) }, 250)
    return () => window.clearTimeout(timer)
  }, [pickerOpen, queryInput, query])

  useEffect(() => {
    if (!pickerOpen) return
    const controller = new AbortController()
    getAvailableGoalHabits(goalId, query, 0, controller.signal).then(result => {
      if (controller.signal.aborted) return
      setAvailable(result.habits)
      setHasMore(result.hasMore)
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Nie udało się pobrać nawyków.')
    }).finally(() => { if (!controller.signal.aborted) setPickerLoading(false) })
    return () => controller.abort()
  }, [goalId, pickerOpen, query, retry])

  useEffect(() => {
    if (!pickerOpen) return
    const element = dialog.current
    element?.showModal()
    search.current?.focus()
    return () => element?.close()
  }, [pickerOpen])

  const disabled = busy || pickerLoading || queryInput.trim() !== query

  async function run(action: () => Promise<void>) {
    if (sending.current) return
    sending.current = true
    setBusy(true)
    setError('')
    try { await action() }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Nie udało się zapisać zmiany.') }
    finally { sending.current = false; setBusy(false) }
  }

  function closePicker() {
    if (sending.current) return
    setPickerOpen(false)
    setQueryInput('')
    setQuery('')
    setAvailable([])
    setHasMore(false)
    setError('')
    setNotice('')
    requestAnimationFrame(() => trigger.current?.focus())
  }

  function attach(habit: GoalHabit) {
    void run(async () => {
      await setGoalHabit(goalId, habit.id, true)
      setAttached(current => current.some(item => item.id === habit.id) ? current : [...current, habit])
      onGoalLinksChanged()
      setNotice(`Przypięto: ${habit.name}`)
    })
  }

  function loadMore() {
    void run(async () => {
      // The server excludes attached habits, so account for removed candidates when paging.
      const remaining = available.filter(habit => !attached.some(item => item.id === habit.id))
      const page = Math.floor(remaining.length / 20)
      let result = await getAvailableGoalHabits(goalId, query, page)
      if (result.hasMore && result.habits.every(habit => available.some(item => item.id === habit.id))) {
        result = await getAvailableGoalHabits(goalId, query, page + 1)
      }
      setAvailable(current => [...current, ...result.habits.filter(habit => !current.some(item => item.id === habit.id))])
      setHasMore(result.hasMore)
    })
  }

  return <div className="goal-tasks" id={`goal-habits-${goalId}`}>
    <div className="goal-subsection-header">
      <h3>Nawyki{!loading && !loadError && <> · {attached.length}</>}</h3>
      <button ref={trigger} type="button" className="add-task-header-button goal-subsection-add"
        aria-label="Przypnij nawyk" title="Przypnij nawyk"
        disabled={loading || !!loadError || busy || pickerOpen}
        onClick={() => { setError(''); setPickerLoading(true); setPickerOpen(true) }}>
        <Plus aria-hidden="true" />
      </button>
    </div>
    {loading ? <p role="status">Ładowanie nawyków…</p> : loadError ? <>
      <p className="form-error" role="alert">{loadError}</p>
      <button type="button" className="goal-picker-link" onClick={() => {
        setLoading(true); setRetry(value => value + 1)
      }}>Spróbuj ponownie</button>
    </> : <>
      {attached.length === 0 && <p className="empty-state">Przypnij nawyki, które pomogą Ci osiągnąć ten cel.</p>}
      {attached.length > 0 && <ul className="task-list goal-linked-tasks">
        {attached.map(habit => <li key={habit.id} className="goal-linked-task goal-linked-habit">
          <div className="goal-linked-task-body"><span>{habit.name}</span></div>
          <TaskActionsMenu itemTitle={habit.name} itemType="nawyku" disabled={busy} actions={[{
            label: 'Odepnij od celu', onSelect: () => void run(async () => {
              await setGoalHabit(goalId, habit.id, false)
              setAttached(current => current.filter(item => item.id !== habit.id))
              onGoalLinksChanged()
            }),
          }]} />
        </li>)}
      </ul>}
      {!pickerOpen && busy && <p role="status">Zapisywanie…</p>}
      {!pickerOpen && error && <p className="form-error" role="alert">{error}</p>}
    </>}
    {pickerOpen && <dialog ref={dialog} className="password-dialog goal-picker-dialog" aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); closePicker() }}>
      <div className="goal-picker-header">
        <button type="button" className="password-dialog-close" aria-label="Zamknij" disabled={busy} onClick={closePicker}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
        <h2 id={titleId}>Przypnij nawyki</h2>
        <p className="goal-picker-context">Do celu: {goalTitle}</p>
        <label className="form-field"><span>Wyszukaj nawyk</span>
          <input ref={search} type="search" value={queryInput} disabled={busy} placeholder="Wpisz nazwę nawyku"
            onChange={event => { setError(''); setQueryInput(event.target.value) }} />
        </label>
      </div>
      <div className="goal-picker-results" aria-busy={pickerLoading}>
        {pickerLoading ? <p role="status">Ładowanie nawyków…</p> : <>
          {available.length > 0 ? <ul className="goal-available-list">
            {available.map(habit => <li key={habit.id} className="goal-available-task">
              <span className="goal-available-task-title">{habit.name}</span>
              {attached.some(item => item.id === habit.id) ? <span className="goal-picker-attached">✓ Przypięto</span> :
                <button type="button" className="goal-picker-link" disabled={disabled}
                  aria-label={`Przypnij nawyk: ${habit.name}`} onClick={() => attach(habit)}>Przypnij</button>}
            </li>)}
          </ul> : !error && <p className="empty-state">{query ? 'Nie znaleziono nawyków.' : 'Brak nawyków do przypięcia.'}</p>}
          {hasMore && <button type="button" className="goal-picker-link" disabled={disabled} onClick={loadMore}>Pokaż więcej</button>}
        </>}
      </div>
      <div className="goal-picker-footer">
        <p className="goal-picker-notice" role="status">{busy ? 'Zapisywanie…' : notice}</p>
        {error && <div><p className="form-error" role="alert">{error}</p>
          <button type="button" className="goal-picker-link" disabled={disabled} onClick={() => {
            setError(''); setPickerLoading(true); setRetry(value => value + 1)
          }}>Odśwież listę</button></div>}
        <button type="button" className="goal-picker-close" disabled={busy} onClick={closePicker}>Gotowe</button>
      </div>
    </dialog>}
  </div>
}
