import { useEffect, useRef, useState } from 'react'
import { createHabit, deleteHabit, getHabits, setHabitCompletion, undoHabitAward, updateHabit } from '../api/habitApi'
import CreateHabitForm from '../components/CreateHabitForm'
import EditHabitForm from '../components/EditHabitForm'
import TaskActionsMenu from '../components/TaskActionsMenu'
import WeekBar from '../components/WeekBar'
import { targetLabel } from '../habitTarget'
import { hasReachedWeeklyTarget } from '../habitProgress'
import type { Habit, HabitAward, HabitCompletionResult } from '../types/Habit'
import { dateFromKey, habitToday } from '../weekDates'

const displayDate = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long' })

type AwardNotice = HabitAward & { habitId: number; name: string }

export default function HabitsPage({ onPointsChanged }: { onPointsChanged: (balance: number) => void }) {
  const [today, setToday] = useState(() => habitToday())
  const [selectedDay, setSelectedDay] = useState(today)
  const [busy, setBusy] = useState(false)
  const [notices, setNotices] = useState<AwardNotice[]>([])
  const [refresh, setRefresh] = useState(0)
  const undoing = useRef(false)

  function completionSaved(result: HabitCompletionResult) {
    if (result.balance !== null) onPointsChanged(result.balance)
    if (result.award) {
      const notice = { ...result.award, habitId: result.habit.id, name: result.habit.name }
      setNotices(current => [...current.filter(item => item.id !== notice.id), notice])
    }
  }

  async function undo(notice: AwardNotice) {
    if (busy || undoing.current) throw new Error('Poczekaj na zakończenie zapisu.')
    undoing.current = true
    setBusy(true)
    try {
      const result = await undoHabitAward(notice.habitId, notice.id)
      if (result.balance !== null) onPointsChanged(result.balance)
      setRefresh(current => current + 1)
      setNotices(current => current.filter(item => item.id !== notice.id))
    } finally {
      undoing.current = false
      setBusy(false)
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
    <HabitDayList key={`${selectedDay}:${refresh}`} date={selectedDay} busy={busy} onBusy={setBusy}
      onCompletionSaved={completionSaved} />
    <div className="habit-toast-region">
      {notices.map(notice => <HabitAwardToast key={notice.id} notice={notice} disabled={busy}
        onUndo={() => undo(notice)} onDismiss={() => setNotices(current => current.filter(item => item.id !== notice.id))} />)}
    </div>
  </section>
}

// A separate instance per day keeps delayed requests from changing another day's list.
function HabitDayList({ date, busy, onBusy, onCompletionSaved }: {
  date: string; busy: boolean; onBusy: (busy: boolean) => void
  onCompletionSaved: (result: HabitCompletionResult) => void
}) {
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
      }
    }).catch(() => {
      if (!controller.signal.aborted) setLoadError('Nie udało się pobrać nawyków. Odśwież stronę i spróbuj ponownie.')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [date])

  async function add(name: string, targetDays: number, rewardPoints: number) {
    if (busy) throw new Error('Poczekaj na zakończenie zapisu.')
    onBusy(true)
    try {
      const habit = await createHabit(name, targetDays, rewardPoints)
      setHabits(current => [...current, { ...habit,
        target: habit.target && habit.target.effectiveFrom <= date ? habit.target : null }])
    } finally {
      onBusy(false)
    }
  }

  async function save(id: number, name: string, targetDays: number, rewardPoints: number) {
    if (busy) throw new Error('Poczekaj na zakończenie zapisu.')
    onBusy(true)
    try {
      const result = await updateHabit(id, name, targetDays, rewardPoints)
      const loaded = await getHabits(date)
      setHabits(loaded)
      onCompletionSaved(result)
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
      const result = await setHabitCompletion(habit.id, date, !habit.completed)
      setHabits(current => current.map(item => item.id === habit.id ? result.habit : item))
      onCompletionSaved(result)
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
              onSave={(name, targetDays, points) => save(habit.id, name, targetDays, points)} onCancel={() => setEditingId(null)} /> : <>
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
                {!hasReachedWeeklyTarget(habit) && habit.weeklyRewardGranted && <HabitAwardStatus />}
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

function HabitAwardStatus() {
  const message = 'Nagroda za ten tydzień została już przyznana'
  return <button type="button" className="habit-award-status" aria-label={message}
    data-tooltip={message} onClick={event => event.currentTarget.focus()}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5v1a4 4 0 0 0 4 4M16 6h3v1a4 4 0 0 1-4 4M12 12v4M8 20h8M9 16h6v4H9z" />
    </svg>
  </button>
}

function HabitAwardToast({ notice, disabled, onUndo, onDismiss }: {
  notice: AwardNotice; disabled: boolean; onUndo: () => Promise<void>; onDismiss: () => void
}) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const sending = useRef(false)
  const dismiss = useRef(onDismiss)
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss.current(), Math.max(0, Math.min(8000, Date.parse(notice.undoUntil) - Date.now())))
    return () => window.clearTimeout(timer)
  }, [notice.undoUntil])

  async function undo() {
    if (sending.current) return
    sending.current = true
    setSaving(true)
    setError('')
    try { await onUndo() }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Nie udało się cofnąć nagrody.') }
    finally { sending.current = false; setSaving(false) }
  }

  return <div className="habit-toast">
    <HabitSuccessIcon />
    <div className="habit-toast-message">
      <span role="status">Cel tygodniowy osiągnięty! {notice.name} · +{notice.points} pkt</span>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
    <button type="button" className="secondary-button" disabled={disabled || saving}
      onClick={() => void undo()}>{saving ? 'Cofanie…' : 'Cofnij'}</button>
  </div>
}
