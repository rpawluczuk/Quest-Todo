import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { createGoal, deleteGoal, getGoals, updateGoal } from '../api/goalApi'
import TaskActionsMenu from '../components/TaskActionsMenu'
import type { Goal } from '../types/Goal'
import GoalTasks, { type GoalTasksProps } from '../components/GoalTasks'
import GoalHabits from '../components/GoalHabits'
import GoalMilestones from '../components/GoalMilestones'
import AutoResizeTextarea from '../components/AutoResizeTextarea'

function titleError(title: string): string {
  if (!title.trim()) return 'Podaj tytuł celu.'
  if (title.length > 120) return 'Tytuł celu może mieć maksymalnie 120 znaków.'
  return ''
}

function definitionError(currentState: string, desiredOutcome: string): string {
  if (currentState.length > 2000) return 'Stan obecny może mieć maksymalnie 2000 znaków.'
  if (desiredOutcome.length > 2000) return 'Zamierzony efekt może mieć maksymalnie 2000 znaków.'
  return ''
}

export default function GoalsPage({ onHabitGoalLinksChanged, ...taskProps }: GoalTasksProps & {
  onHabitGoalLinksChanged: () => void
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [currentState, setCurrentState] = useState('')
  const [desiredOutcome, setDesiredOutcome] = useState('')
  const [createDetailsOpen, setCreateDetailsOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCurrentState, setEditCurrentState] = useState('')
  const [editDesiredOutcome, setEditDesiredOutcome] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const createInput = useRef<HTMLInputElement>(null)
  const editInput = useRef<HTMLInputElement>(null)
  const sending = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    getGoals(controller.signal).then(setGoals).catch(failure => {
      if (!controller.signal.aborted) setLoadError(failure instanceof Error ? failure.message : 'Nie udało się pobrać celów.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  useEffect(() => { if (createOpen) createInput.current?.focus() }, [createOpen])
  useEffect(() => { if (editingId !== null) editInput.current?.focus() }, [editingId])

  async function add(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending.current) return
    const validation = titleError(title) || definitionError(currentState, desiredOutcome)
    if (validation) { setError(validation); return }
    sending.current = true
    setSaving(true)
    setError('')
    try {
      const goal = await createGoal(title.trim(), currentState, desiredOutcome)
      setGoals(current => [...current, goal])
      setTitle('')
      setCurrentState('')
      setDesiredOutcome('')
      setCreateDetailsOpen(false)
      setCreateOpen(false)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się dodać celu.')
    } finally { sending.current = false; setSaving(false) }
  }

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending.current || editingId === null) return
    const validation = titleError(editTitle) || definitionError(editCurrentState, editDesiredOutcome)
    if (validation) { setError(validation); return }
    sending.current = true
    setPendingId(editingId)
    setError('')
    try {
      const updated = await updateGoal(editingId, editTitle.trim(), editCurrentState, editDesiredOutcome)
      setGoals(current => current.map(goal => goal.id === updated.id ? updated : goal))
      taskProps.onGoalLinksChanged()
      onHabitGoalLinksChanged()
      setEditingId(null)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się zapisać celu.')
    } finally { sending.current = false; setPendingId(null) }
  }

  async function remove(id: number) {
    if (sending.current) return
    sending.current = true
    setPendingId(id)
    setError('')
    try {
      await deleteGoal(id)
      setGoals(current => current.filter(goal => goal.id !== id))
      taskProps.onGoalLinksChanged()
      onHabitGoalLinksChanged()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się usunąć celu.')
    } finally { sending.current = false; setPendingId(null) }
  }

  return <section className="tasks-section" aria-labelledby="goals-heading">
    <div className="section-header section-header-with-action">
      <h2 id="goals-heading">Cele</h2>
      <button type="button" className="add-task-header-button" aria-label="Dodaj cel" title="Dodaj cel"
        disabled={loading || !!loadError || saving}
        onClick={() => { setEditingId(null); setError(''); setCreateOpen(true) }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
    {loading && <p role="status">Ładowanie celów…</p>}
    {loadError && <p className="form-error" role="alert">{loadError}</p>}
    {!loading && !loadError && <>
      <div className={goals.length === 0 ? 'task-empty-state task-empty-state-prominent' : undefined}>
        {goals.length === 0 && <>
          <span className="task-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="8" />
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2M22 12h-2M12 22v-2M2 12h2" />
            </svg>
          </span>
          <p className="empty-state">Nie masz jeszcze celów. Dodaj pierwszy, aby zacząć!</p>
        </>}
        {createOpen && <form className="task-form goal-form" onSubmit={add}>
        <label className="form-field"><span>Tytuł celu</span>
          <input ref={createInput} value={title} maxLength={120} required disabled={saving}
            onChange={event => setTitle(event.target.value)} placeholder="Np. Przebiec 5 km" /></label>
        {!createDetailsOpen && <button type="button" className="goal-definition-toggle" disabled={saving}
          onClick={() => setCreateDetailsOpen(true)}>+ Doprecyzuj cel</button>}
        {createDetailsOpen && <>
          <label className="form-field goal-definition-field"><span>Stan obecny <span className="field-optional">(opcjonalnie)</span></span>
            <AutoResizeTextarea value={currentState} maxLength={2000} disabled={saving}
              placeholder="Opisz punkt wyjścia i obecną sytuację…"
              onChange={event => setCurrentState(event.target.value)} /></label>
          <label className="form-field goal-definition-field"><span>Zamierzony efekt <span className="field-optional">(opcjonalnie)</span></span>
            <AutoResizeTextarea value={desiredOutcome} maxLength={2000} disabled={saving}
              placeholder="Opisz rezultat, który chcesz osiągnąć…"
              onChange={event => setDesiredOutcome(event.target.value)} /></label>
        </>}
        <div className="task-actions">
          <button type="submit" disabled={saving}>{saving ? 'Zapisywanie…' : 'Dodaj cel'}</button>
          <button type="button" className="secondary-button" disabled={saving} onClick={() => {
            setCreateOpen(false); setTitle(''); setCurrentState(''); setDesiredOutcome('')
            setCreateDetailsOpen(false); setError('')
          }}>Anuluj</button>
        </div>
        </form>}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {goals.length > 0 && <ul className="task-list goal-list">{goals.map(goal => <li key={goal.id} className="task-card goal-card">
          {editingId === goal.id ? <form className="task-form goal-form goal-edit-form" onSubmit={save}>
            <label className="form-field"><span>Tytuł celu</span>
              <input ref={editInput} value={editTitle} maxLength={120} required disabled={pendingId !== null}
                onChange={event => setEditTitle(event.target.value)} /></label>
            <label className="form-field goal-definition-field"><span>Stan obecny <span className="field-optional">(opcjonalnie)</span></span>
              <AutoResizeTextarea value={editCurrentState} maxLength={2000} disabled={pendingId !== null}
                placeholder="Opisz punkt wyjścia i obecną sytuację…"
                onChange={event => setEditCurrentState(event.target.value)} /></label>
            <label className="form-field goal-definition-field"><span>Zamierzony efekt <span className="field-optional">(opcjonalnie)</span></span>
              <AutoResizeTextarea value={editDesiredOutcome} maxLength={2000} disabled={pendingId !== null}
                placeholder="Opisz rezultat, który chcesz osiągnąć…"
                onChange={event => setEditDesiredOutcome(event.target.value)} /></label>
            <div className="task-actions">
              <button type="submit" disabled={pendingId !== null}>{pendingId === goal.id ? 'Zapisywanie…' : 'Zapisz'}</button>
              <button type="button" className="secondary-button" disabled={pendingId !== null} onClick={() => {
                setEditingId(null); setError('')
              }}>Anuluj</button>
            </div>
          </form> : <>
            <button type="button" className="goal-title goal-details-toggle" aria-expanded={expandedId === goal.id}
              aria-controls={expandedId === goal.id ? `goal-tasks-${goal.id} goal-habits-${goal.id} goal-milestones-${goal.id}` : undefined}
              onClick={() => setExpandedId(current => current === goal.id ? null : goal.id)}>
              <span>{goal.title}</span>
              <svg className="goal-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <TaskActionsMenu itemTitle={goal.title} itemType="celu" disabled={pendingId !== null} actions={[
              { label: 'Edytuj', onSelect: () => {
                setCreateOpen(false); setEditingId(goal.id); setEditTitle(goal.title)
                setEditCurrentState(goal.currentState ?? ''); setEditDesiredOutcome(goal.desiredOutcome ?? ''); setError('')
              } },
              { label: 'Usuń', destructive: true, onSelect: () => void remove(goal.id) },
            ]} />
            {expandedId === goal.id && (goal.currentState || goal.desiredOutcome) &&
              <div className="goal-definition" id={`goal-definition-${goal.id}`}>
                {goal.currentState && <section><h3>Stan obecny</h3><p>{goal.currentState}</p></section>}
                {goal.desiredOutcome && <section><h3>Zamierzony efekt</h3><p>{goal.desiredOutcome}</p></section>}
              </div>}
            {expandedId === goal.id && <GoalMilestones key={`milestones-${goal.id}`} goalId={goal.id} />}
            {expandedId === goal.id && <GoalTasks key={goal.id} goalId={goal.id} goalTitle={goal.title} {...taskProps} />}
            {expandedId === goal.id && <GoalHabits key={`habits-${goal.id}`} goalId={goal.id} goalTitle={goal.title}
              onGoalLinksChanged={onHabitGoalLinksChanged} />}
          </>}
        </li>)}</ul>}
    </>}
  </section>
}
