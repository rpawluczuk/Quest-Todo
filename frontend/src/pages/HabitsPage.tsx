import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { createHabit, deleteHabit, getHabits, setHabitCompletion, undoHabitAward, updateHabit } from '../api/habitApi'
import CreateHabitForm from '../components/CreateHabitForm'
import EditHabitForm from '../components/EditHabitForm'
import TaskActionsMenu from '../components/TaskActionsMenu'
import WeekBar from '../components/WeekBar'
import { targetLabel } from '../habitTarget'
import { hasReachedWeeklyTarget, sortHabitsForDay } from '../habitProgress'
import { canToggleHabit } from '../habitSchedule'
import type { Habit, HabitAward, HabitCompletionResult, HabitSchedule } from '../types/Habit'
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
    </div>
    <HabitDayList key={`${selectedDay}:${today}:${refresh}`} date={selectedDay} today={today} busy={busy} onBusy={setBusy}
      onCompletionSaved={completionSaved} />
    <div className="habit-toast-region">
      {notices.map(notice => <HabitAwardToast key={notice.id} notice={notice} disabled={busy}
        onUndo={() => undo(notice)} onDismiss={() => setNotices(current => current.filter(item => item.id !== notice.id))} />)}
    </div>
  </section>
}

// A separate instance per day keeps delayed requests from changing another day's list.
function HabitDayList({ date, today, busy, onBusy, onCompletionSaved }: {
  date: string; today: string; busy: boolean; onBusy: (busy: boolean) => void
  onCompletionSaved: (result: HabitCompletionResult) => void
}) {
  const savingCompletion = useRef(false)
  const [habits, setHabits] = useState<Habit[]>([])
  const [allHabitIds, setAllHabitIds] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [savingCompletionId, setSavingCompletionId] = useState<number | null>(null)
  const [completionError, setCompletionError] = useState('')
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(() => new Set())
  const groups = [
    { status: 'ACTIVE', title: '' },
    { status: 'UPCOMING', title: 'Zaplanowane' },
    { status: 'FINISHED', title: 'Zakończone' },
  ] as const

  function toggleDescription(id: number) {
    setExpandedDescriptions(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleCardClick(event: MouseEvent<HTMLLIElement>, habit: Habit) {
    if (!habit.description || busy || editingId !== null ||
      !(event.target instanceof Element) ||
      event.target.closest('button, input, label, textarea, select, a, form, [role="button"]')) return
    toggleDescription(habit.id)
  }

  useEffect(() => {
    const controller = new AbortController()
    getHabits(date, controller.signal).then(loaded => {
      if (!controller.signal.aborted) {
        setHabits(loaded)
        setAllHabitIds(loaded.map(habit => habit.id))
      }
    }).catch(() => {
      if (!controller.signal.aborted) setLoadError('Nie udało się pobrać nawyków. Odśwież stronę i spróbuj ponownie.')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [date, today])

  async function add(name: string, targetDays: number, rewardPoints: number, description: string, schedule: HabitSchedule) {
    if (busy) throw new Error('Poczekaj na zakończenie zapisu.')
    onBusy(true)
    try {
      const habit = await createHabit(name, targetDays, rewardPoints, description, schedule)
      setAllHabitIds(current => [...current, habit.id])
      setHabits(await getHabits(date))
    } finally {
      onBusy(false)
    }
  }

  async function save(id: number, name: string, targetDays: number, rewardPoints: number, description: string, schedule: HabitSchedule) {
    if (busy) throw new Error('Poczekaj na zakończenie zapisu.')
    onBusy(true)
    try {
      const result = await updateHabit(id, name, targetDays, rewardPoints, description, schedule)
      const loaded = await getHabits(date)
      setHabits(loaded)
      onCompletionSaved(result)
      setEditingId(null)
      setExpandedDescriptions(current => { const next = new Set(current); next.delete(id); return next })
    } finally {
      onBusy(false)
    }
  }

  async function toggleCompletion(habit: Habit) {
    if (busy || savingCompletion.current || !canToggleHabit(habit)) return
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
      setAllHabitIds(current => current.filter(habitId => habitId !== id))
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
        <div className={allHabitIds.length === 0 ? 'task-empty-state task-empty-state-prominent' : undefined}>
          {allHabitIds.length === 0 && <>
            <span className="task-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3" />
              </svg>
            </span>
            <p className="empty-state">Nie masz jeszcze nawyków. Dodaj pierwszy i zacznij budować regularność!</p>
          </>}
          <CreateHabitForm onAdd={add} isFirstHabit={allHabitIds.length === 0} />
        </div>
        {habits.length === 0 && allHabitIds.length > 0 && <p className="empty-state">Brak zaplanowanych nawyków na ten dzień.</p>}
        {groups.map(group => {
          const items = sortHabitsForDay(habits.filter(habit => habit.status === group.status))
          if (!items.length) return null
          return <div key={group.status}>
          {group.title && <h3>{group.title}</h3>}
          <ul className="task-list">
          {items.map(habit => <li className={`task habit-card${editingId === habit.id ? ' habit-card-editing' : ''}${habit.description && editingId === null && !busy ? ' task-card-has-note' : ''}`}
            key={habit.id} onClick={event => handleCardClick(event, habit)}>
            {editingId === habit.id ? <EditHabitForm habit={habit}
              onSave={(name, targetDays, points, description, schedule) => save(habit.id, name, targetDays, points, description, schedule)} onCancel={() => setEditingId(null)} /> : <>
              <label className="task-card-check">
                <input type="checkbox" checked={habit.completed}
                  disabled={busy || editingId !== null || !canToggleHabit(habit)}
                  aria-label={`${habit.name} — ${displayDate.format(dateFromKey(date))}`}
                  onChange={() => void toggleCompletion(habit)} />
              </label>
              <div className="habit-name">
                {habit.description ? <button type="button" className="habit-note-toggle" disabled={busy}
                  aria-expanded={expandedDescriptions.has(habit.id)} aria-controls={`habit-note-${habit.id}`}
                  aria-label={`${expandedDescriptions.has(habit.id) ? 'Ukryj' : 'Pokaż'} notatkę: ${habit.name}`}
                  onClick={() => toggleDescription(habit.id)}>
                  <span className="task-title">{habit.name}</span>
                  <svg className="task-note-icon" viewBox="0 0 20 20" fill="none"
                    stroke="currentColor" strokeWidth="1.5" aria-label="Zawiera notatkę" role="img">
                    <path d="M5 2.5h7l3 3V17H5zM12 2.5v3h3M7.5 9h5M7.5 12h5" />
                  </svg>
                </button> : <span className="task-title">{habit.name}</span>}
                <small className="habit-target-hint">{habit.target ? targetLabel(habit.target.targetDays) : 'Brak ustalonego celu na ten dzień'}</small>
                {habit.status === 'UPCOMING' && <small className="habit-target-hint">Od {displayDate.format(dateFromKey(habit.startDate))}</small>}
                {habit.endDate && <small className="habit-target-hint">Do {displayDate.format(dateFromKey(habit.endDate))} włącznie</small>}
                {habit.completionLimit !== null && <small className="habit-target-hint">Łącznie: {habit.totalCompletions}/{habit.completionLimit} wykonań</small>}
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
              {habit.description && <p id={`habit-note-${habit.id}`} className="task-card-description habit-description"
                hidden={!expandedDescriptions.has(habit.id)}>{habit.description}</p>}
            </>}
          </li>)}
        </ul></div>})}
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
