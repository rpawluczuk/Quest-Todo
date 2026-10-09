import { useEffect, useState } from 'react'
import { createHabit, deleteHabit, getHabits, setHabitCompletion, updateHabit } from '../api/habitApi'
import CreateHabitForm from '../components/CreateHabitForm'
import EditHabitForm from '../components/EditHabitForm'
import TaskActionsMenu from '../components/TaskActionsMenu'
import WeekBar from '../components/WeekBar'
import type { Habit } from '../types/Habit'
import { dateFromKey, habitToday } from '../weekDates'

const displayDate = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long' })

export default function HabitsPage() {
  const [today, setToday] = useState(() => habitToday())
  const [selectedDay, setSelectedDay] = useState(today)
  const [busy, setBusy] = useState(false)

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
    <HabitDayList key={selectedDay} date={selectedDay} busy={busy} onBusy={setBusy} />
  </section>
}

// A separate instance per day keeps delayed requests from changing another day's list.
function HabitDayList({ date, busy, onBusy }: { date: string; busy: boolean; onBusy: (busy: boolean) => void }) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [savingCompletionId, setSavingCompletionId] = useState<number | null>(null)
  const [completionError, setCompletionError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    getHabits(date, controller.signal).then(loaded => {
      if (!controller.signal.aborted) setHabits(loaded)
    }).catch(() => {
      if (!controller.signal.aborted) setLoadError('Nie udało się pobrać nawyków. Odśwież stronę i spróbuj ponownie.')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [date])

  async function add(name: string) {
    if (busy) throw new Error('Poczekaj na zakończenie zapisu.')
    onBusy(true)
    try {
      const habit = await createHabit(name)
      if (habit.createdOn <= date) setHabits(current => [...current, habit])
      else setNotice(`Nawyk został dodany. Będzie widoczny od ${displayDate.format(dateFromKey(habit.createdOn))}.`)
    } finally {
      onBusy(false)
    }
  }

  async function save(id: number, name: string) {
    if (busy) throw new Error('Poczekaj na zakończenie zapisu.')
    onBusy(true)
    try {
      const updated = await updateHabit(id, name)
      setHabits(current => current.map(habit => habit.id === id ? { ...updated, completed: habit.completed } : habit))
      setEditingId(null)
    } finally {
      onBusy(false)
    }
  }

  async function toggleCompletion(habit: Habit) {
    if (busy) return
    onBusy(true)
    setSavingCompletionId(habit.id)
    setCompletionError('')
    try {
      await setHabitCompletion(habit.id, date, !habit.completed)
      setHabits(current => current.map(item => item.id === habit.id ? { ...item, completed: !habit.completed } : item))
    } catch (failure) {
      setCompletionError(failure instanceof Error ? failure.message : 'Nie udało się zapisać wykonania nawyku.')
    } finally {
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
        {notice && <p role="status">{notice}</p>}
        {habits.length === 0 && <p className="empty-state">Brak nawyków na ten dzień.</p>}
        <ul className="task-list">
          {habits.map(habit => <li className={`task habit-card${editingId === habit.id ? ' habit-card-editing' : ''}`} key={habit.id}>
            {editingId === habit.id ? <EditHabitForm habit={habit}
              onSave={name => save(habit.id, name)} onCancel={() => setEditingId(null)} /> : <>
              <label className="task-card-check">
                <input type="checkbox" checked={habit.completed}
                  disabled={busy || editingId !== null}
                  aria-label={`${habit.name} — ${displayDate.format(dateFromKey(date))}`}
                  onChange={() => void toggleCompletion(habit)} />
              </label>
              <span className={`task-title habit-name${habit.completed ? ' habit-name-completed' : ''}`}>{habit.name}</span>
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
