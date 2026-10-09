import { useEffect, useRef, useState } from 'react'
import { createHabit, deleteHabit, getHabits, setHabitCompletion, updateHabit } from '../api/habitApi'
import CreateHabitForm from '../components/CreateHabitForm'
import EditHabitForm from '../components/EditHabitForm'
import TaskActionsMenu from '../components/TaskActionsMenu'
import WeekBar from '../components/WeekBar'
import { targetLabel } from '../habitTarget'
import { claimWeeklyAchievement, hasReachedWeeklyTarget } from '../habitProgress'
import type { Habit } from '../types/Habit'
import { dateFromKey, dateKey, habitToday, startOfWeek } from '../weekDates'

const displayDate = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long' })

export default function HabitsPage() {
  const [today, setToday] = useState(() => habitToday())
  const [selectedDay, setSelectedDay] = useState(today)
  const [busy, setBusy] = useState(false)
  const announced = useRef(new Set<string>())
  const [toast, setToast] = useState<{ name: string } | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  function progressChanged(before: Habit, after: Habit, week: string) {
    if (claimWeeklyAchievement(before, after, week, announced.current)) setToast({ name: after.name })
  }

  function progressLoaded(habits: Habit[], week: string) {
    for (const habit of habits) {
      if (hasReachedWeeklyTarget(habit)) announced.current.add(`${habit.id}:${week}`)
    }
  }

  useEffect(() => {
    const refreshToday = () => setToday(habitToday())
    const timer = window.setInterval(refreshToday, 60_000)
    window.addEventListener('focus', refreshToday)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshToday)
    }
  }, [])

  return <section className="tasks-section" aria-labelledby="habits-heading">
    <WeekBar selectedDay={selectedDay} today={today} onSelect={setSelectedDay} disabled={busy} />
    <div className="section-header">
      <h2 id="habits-heading">Nawyki</h2>
      <p>Regularne czynności, które chcesz rozwijać.</p>
      <p>Dzień: <time dateTime={selectedDay}>{displayDate.format(dateFromKey(selectedDay))}</time></p>
    </div>
    <HabitDayList key={selectedDay} date={selectedDay} busy={busy} onBusy={setBusy}
      onProgressChanged={progressChanged} onProgressLoaded={progressLoaded} />
    <div className="habit-toast-region" role="status" aria-live="polite" aria-atomic="true">
      {toast && <div className="habit-toast"><HabitSuccessIcon /><span>{toast.name}: Cel tygodniowy osiągnięty!</span></div>}
    </div>
  </section>
}

// A separate instance per day keeps delayed requests from changing another day's list.
function HabitDayList({ date, busy, onBusy, onProgressChanged, onProgressLoaded }: {
  date: string; busy: boolean; onBusy: (busy: boolean) => void
  onProgressChanged: (before: Habit, after: Habit, week: string) => void
  onProgressLoaded: (habits: Habit[], week: string) => void
}) {
  const week = dateKey(startOfWeek(dateFromKey(date)))
  const progressLoaded = useRef(onProgressLoaded)
  const savingCompletion = useRef(false)
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [savingCompletionId, setSavingCompletionId] = useState<number | null>(null)
  const [completionError, setCompletionError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    getHabits(date, controller.signal).then(loaded => {
      if (!controller.signal.aborted) {
        setHabits(loaded)
        progressLoaded.current(loaded, week)
      }
    }).catch(() => {
      if (!controller.signal.aborted) setLoadError('Nie udało się pobrać nawyków. Odśwież stronę i spróbuj ponownie.')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [date, week])

  async function add(name: string, targetDays: number) {
    if (busy) throw new Error('Poczekaj na zakończenie zapisu.')
    onBusy(true)
    try {
      const habit = await createHabit(name, targetDays)
      setHabits(current => [...current, { ...habit,
        target: habit.target && habit.target.effectiveFrom <= date ? habit.target : null }])
    } finally {
      onBusy(false)
    }
  }

  async function save(id: number, name: string, targetDays: number) {
    if (busy) throw new Error('Poczekaj na zakończenie zapisu.')
    onBusy(true)
    try {
      const updated = await updateHabit(id, name, targetDays)
      const before = habits.find(habit => habit.id === id)
      if (before) {
        const viewed = {
          ...updated, completed: before.completed, weeklyCompletedDays: before.weeklyCompletedDays,
          target: updated.target && updated.target.effectiveFrom <= date ? updated.target : before.target,
        }
        setHabits(current => current.map(habit => habit.id === id ? viewed : habit))
        onProgressChanged(before, viewed, week)
      }
      setEditingId(null)
    } finally {
      onBusy(false)
    }
  }

  async function toggleCompletion(habit: Habit) {
    if (busy || savingCompletion.current) return
    savingCompletion.current = true
    onBusy(true)
    setSavingCompletionId(habit.id)
    setCompletionError('')
    try {
      await setHabitCompletion(habit.id, date, !habit.completed)
      const loaded = await getHabits(date).catch(() => {
        throw new Error('Wykonanie zostało zapisane, ale nie udało się odświeżyć postępu. Wybierz dzień ponownie.')
      })
      setHabits(loaded)
      const updated = loaded.find(item => item.id === habit.id)
      if (updated) onProgressChanged(habit, updated, week)
    } catch (failure) {
      setCompletionError(failure instanceof Error ? failure.message : 'Nie udało się zapisać wykonania nawyku.')
    } finally {
      savingCompletion.current = false
      setSavingCompletionId(null)
      onBusy(false)
    }
  }

  async function remove(id: number) {
    if (busy) return
    onBusy(true)
    setDeletingId(id)
    setDeleteError('')
    try {
      await deleteHabit(id)
      setHabits(current => current.filter(habit => habit.id !== id))
      setEditingId(current => current === id ? null : current)
    } catch (failure) {
      setDeleteError(failure instanceof Error ? failure.message : 'Nie udało się usunąć nawyku.')
    } finally {
      setDeletingId(null)
      onBusy(false)
    }
  }

  return (
    <>
      {loading && <p role="status">Ładowanie nawyków…</p>}
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {!loading && !loadError && <>
        <CreateHabitForm onAdd={add} />
        {habits.length === 0 && <p className="empty-state">Brak nawyków na ten dzień.</p>}
        <ul className="task-list">
          {habits.map(habit => <li className={`task habit-card${editingId === habit.id ? ' habit-card-editing' : ''}`} key={habit.id}>
            {editingId === habit.id ? <EditHabitForm habit={habit}
              onSave={(name, targetDays) => save(habit.id, name, targetDays)} onCancel={() => setEditingId(null)} /> : <>
              <label className="task-card-check">
                <input type="checkbox" checked={habit.completed}
                  disabled={busy || editingId !== null}
                  aria-label={`${habit.name} — ${displayDate.format(dateFromKey(date))}`}
                  onChange={() => void toggleCompletion(habit)} />
              </label>
              <div className="habit-name">
                <span className="task-title">{habit.name}</span>
                <small className="habit-target-hint">{habit.target ? targetLabel(habit.target.targetDays) : 'Brak ustalonego celu na ten dzień'}</small>
              </div>
              <span className={`habit-progress${hasReachedWeeklyTarget(habit) ? ' habit-progress-achieved' : ''}`}
                aria-label={habit.target
                  ? `Wykonane dni w tygodniu: ${habit.weeklyCompletedDays}, cel: ${habit.target.targetDays}${hasReachedWeeklyTarget(habit) ? ', cel osiągnięty' : ''}`
                  : `Wykonane dni w tygodniu: ${habit.weeklyCompletedDays}, brak ustalonego celu`}>
                {habit.weeklyCompletedDays}/{habit.target?.targetDays ?? '—'}
                {hasReachedWeeklyTarget(habit) && <HabitSuccessIcon />}
              </span>
              <TaskActionsMenu itemTitle={habit.name} itemType="nawyku"
                disabled={busy || editingId !== null}
                actions={[
                  { label: 'Edytuj', onSelect: () => setEditingId(habit.id) },
                  { label: 'Usuń', destructive: true, onSelect: () => void remove(habit.id) },
                ]} />
            </>}
          </li>)}
        </ul>
        {deletingId !== null && <p className="reward-status" role="status">Usuwanie nawyku…</p>}
        {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
        {savingCompletionId !== null && <p role="status">Zapisywanie wykonania…</p>}
        {completionError && <p className="form-error" role="alert">{completionError}</p>}
      </>}
    </>
  )
}

function HabitSuccessIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" />
  </svg>
}
