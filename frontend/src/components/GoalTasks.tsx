import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { getGoalTasks, setGoalTask } from '../api/goalApi'
import type { Task } from '../types/Task'

export type GoalTasksProps = {
  tasks: Task[]
  tasksLoading: boolean
  tasksError: string
  tasksDisabled: boolean
  onToggleTask: (id: number) => Promise<void>
}

export default function GoalTasks({ goalId, tasks, tasksLoading, tasksError, tasksDisabled, onToggleTask }: GoalTasksProps & { goalId: number }) {
  const [ids, setIds] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const select = useRef<HTMLSelectElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    getGoalTasks(goalId, controller.signal).then(loaded => {
      if (!controller.signal.aborted) setIds(loaded.map(task => task.id))
    }).catch(failure => {
      if (!controller.signal.aborted) setLoadError(failure instanceof Error ? failure.message : 'Nie udało się pobrać zadań celu.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [goalId])

  useEffect(() => { if (pickerOpen) select.current?.focus() }, [pickerOpen])

  const attached = tasks.filter(task => ids.includes(task.id))
  const available = tasks.filter(task => !ids.includes(task.id))
  const disabled = busy || tasksDisabled

  async function run(action: () => Promise<void>) {
    if (sending.current || tasksDisabled) return
    sending.current = true
    setBusy(true)
    setError('')
    try { await action() }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Nie udało się zapisać zmiany.') }
    finally { sending.current = false; setBusy(false) }
  }

  function closePicker() {
    setPickerOpen(false)
    setSelected('')
    setError('')
    trigger.current?.focus()
  }

  function attach(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const id = Number(selected)
    if (!available.some(task => task.id === id)) return
    void run(async () => {
      await setGoalTask(goalId, id, true)
      setIds(current => [...current, id])
      closePicker()
    })
  }

  return <div className="goal-tasks" id={`goal-tasks-${goalId}`}>
    <h3>Zadania</h3>
    {(loading || tasksLoading) ? <p role="status">Ładowanie zadań…</p> : loadError || tasksError ?
      <p className="form-error" role="alert">{loadError || tasksError}</p> : <>
      {attached.length === 0 && <p className="empty-state">Przypnij zadania, które pomogą Ci osiągnąć ten cel.</p>}
      {attached.length > 0 && <ul className="task-list goal-linked-tasks">
        {attached.map(task => <li key={task.id} className="goal-linked-task">
          <input type="checkbox" checked={task.completed} disabled={disabled}
            aria-label={`Wykonane: ${task.title}`} onChange={() => void run(() => onToggleTask(task.id))} />
          <span className={task.completed ? 'goal-task-completed' : undefined}>{task.title}</span>
          <span className="task-points">{task.points} pkt</span>
          <button type="button" className="secondary-button" disabled={disabled}
            aria-label={`Odepnij zadanie: ${task.title}`} onClick={() => void run(async () => {
              await setGoalTask(goalId, task.id, false)
              setIds(current => current.filter(id => id !== task.id))
            })}>Odepnij</button>
        </li>)}
      </ul>}
      <button ref={trigger} type="button" className="secondary-button add-task-toggle" disabled={disabled || pickerOpen}
        onClick={() => { setError(''); setPickerOpen(true) }}>Przypnij zadanie</button>
      {pickerOpen && <form className="task-form goal-task-picker" onSubmit={attach}>
        {available.length > 0 ? <label className="form-field">
          <span>Wybierz zadanie</span>
          <select ref={select} value={selected} required disabled={disabled} onChange={event => setSelected(event.target.value)}>
            <option value="">Wybierz z listy</option>
            {available.map(task => <option key={task.id} value={task.id}>{task.title}{task.completed ? ' (wykonane)' : ''}</option>)}
          </select>
        </label> : <p className="empty-state">{tasks.length === 0
          ? 'Nie masz jeszcze zadań. Utwórz zadanie w zakładce „Zadania”, a następnie przypnij je tutaj.'
          : 'Wszystkie Twoje zadania są już przypięte do tego celu.'}</p>}
        <div className="task-actions">
          {available.length > 0 && <button type="submit" disabled={disabled || !selected}>{busy ? 'Zapisywanie…' : 'Przypnij'}</button>}
          <button type="button" className="secondary-button" disabled={busy} onClick={closePicker}>Anuluj</button>
        </div>
      </form>}
      {busy && <p role="status">Zapisywanie…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </>}
  </div>
}
