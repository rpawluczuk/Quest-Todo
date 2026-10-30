import { createHabitStatusUpdates } from '../habitStatusUpdates'
import { useHabitStore } from '../components/HabitProvider'
import { habitStatusAction } from '../habitStore'
import HabitWaitingRoom from '../components/HabitWaitingRoom'
import { partitionHabits } from '../habitLists'
import { useCallback, useEffect, useRef, useState, type MouseEvent, type RefObject, type Dispatch, type SetStateAction } from 'react'
import HabitCompletionBonus from '../components/HabitCompletionBonus'
import { createHabit, deleteHabit, endHabit, HabitUpdateConflictError, setHabitCompletion, undoHabitAward, updateHabit } from '../api/habitApi'
import CreateHabitForm, { type CreateHabitFormHandle } from '../components/CreateHabitForm'
import EndHabitDialog from '../components/EndHabitDialog'
import EditHabitForm from '../components/EditHabitForm'
import TaskActionsMenu from '../components/TaskActionsMenu'
import CategoryMarker, { CategoryCardDetail } from '../components/CategoryMarker'
import WeekBar from '../components/WeekBar'
import { formatHabitProgress } from '../habitTarget'
import { earnedCompletionBonus, habitDayGroup, hasReachedWeeklyTarget, sortHabitsForDay, withOptimisticCompletion, type HabitDayGroup } from '../habitProgress'
import { canToggleHabit, habitEndDateLabel, habitEndReasonLabel } from '../habitSchedule'
import type { Habit, HabitAward, HabitCompletionResult, HabitEndReason, HabitSchedule } from '../types/Habit'
import { dateFromKey, habitToday } from '../weekDates'

const displayDate = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long' })

type AwardNotice = HabitAward & { habitId: number; name: string }
type CompletionBonusNotice = { id: number; habitId: number; name: string; points: number }

export default function HabitsPage({ onPointsChanged, goalLinksRevision, categoryRevision, syncRevision,
  createHabitForm, onHabitCreated }: {
  onPointsChanged: (balance: number) => void; goalLinksRevision: number; categoryRevision: number; syncRevision: number
  createHabitForm: RefObject<CreateHabitFormHandle | null>; onHabitCreated: () => void
}) {
  const store = useHabitStore()
  const statusUpdates = store.statusUpdates
  const pendingStatusIds = statusUpdates.pendingIds()
  const [statusNotice, setStatusNotice] = useState<{ message: string; error: boolean } | null>(null)
  const [tab, setTab] = useState<'active' | 'waiting'>('active')
  const [today, setToday] = useState(() => habitToday())
  const [selectedDay, setSelectedDay] = useState(today)
  const habits = store.get(selectedDay) ?? []
  const setHabits = useCallback<Dispatch<SetStateAction<Habit[]>>>(value => store.set(selectedDay, value), [store, selectedDay])
  const [busy, setBusy] = useState(false)
  const [notices, setNotices] = useState<AwardNotice[]>([])
  const [bonusNotices, setBonusNotices] = useState<CompletionBonusNotice[]>([])
  const nextBonusNoticeId = useRef(0)
  const [refresh, setRefresh] = useState(0)
  const undoing = useRef(false)

  useEffect(() => {
    if (!statusNotice) return
    const timer = window.setTimeout(() => setStatusNotice(null), 5000)
    return () => window.clearTimeout(timer)
  }, [statusNotice])

  async function changeStatus(habit: Habit, next: 'ACTIVE' | 'PAUSED') {
    if (busy) return
    try {
      const saved = await store.changeStatus(habit, next)
      if (!saved) return
      setStatusNotice({ message: habitStatusAction(habit).message, error: false })
      requestAnimationFrame(() => {
        if (document.activeElement === document.body)
          document.querySelector<HTMLButtonElement>('.habit-tabs [aria-selected="true"]')?.focus()
      })
    } catch (failure) {
      setStatusNotice({ message: failure instanceof Error ? failure.message : 'Nie udało się zmienić statusu nawyku. Spróbuj ponownie.', error: true })
    }
  }

  function completionSaved(result: HabitCompletionResult, previous?: Habit) {
    if (result.balance !== null) onPointsChanged(result.balance)
    const bonus = previous && result.balance !== null ? earnedCompletionBonus(previous, result.habit) : null
    if (bonus !== null && bonus !== undefined) {
      setBonusNotices(current => [...current, { id: ++nextBonusNoticeId.current, habitId: result.habit.id,
        name: result.habit.name, points: bonus }])
    } else if (previous?.completionLimit !== null && previous?.completionLimit !== undefined
      && result.habit.totalCompletions < previous.completionLimit) {
      setBonusNotices(current => current.filter(notice => notice.habitId !== result.habit.id))
    }
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
      if (result.habit.completionLimit !== null && result.habit.totalCompletions < result.habit.completionLimit)
        setBonusNotices(current => current.filter(item => item.habitId !== notice.habitId))
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
    <div hidden={tab !== 'active'}><WeekBar selectedDay={selectedDay} today={today} onSelect={setSelectedDay} disabled={busy} /></div>
    <div className="section-header section-header-with-action">
      <h2 id="habits-heading">Nawyki</h2>
      <button type="button" className="add-task-header-button" aria-label="Dodaj nawyk" title="Dodaj nawyk"
        onClick={event => createHabitForm.current?.open(event.currentTarget, null, undefined, tab === 'waiting' ? 'PLANNED' : 'ACTIVE')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
    <HabitDayList habits={habits} setHabits={setHabits} statusUpdates={statusUpdates}
      onCreatedNotice={message => setStatusNotice({ message, error: false })}
      pendingStatusIds={pendingStatusIds} onStatusChange={changeStatus} tab={tab} onTabChange={setTab} key={`${selectedDay}:${today}:${refresh}`} date={selectedDay} today={today} busy={busy} onBusy={setBusy}
      syncRevision={syncRevision + goalLinksRevision + categoryRevision}
      onCompletionSaved={completionSaved} createHabitForm={createHabitForm} onHabitCreated={onHabitCreated} />
    <div className="habit-toast-region">
      {statusNotice && <div className="habit-toast" role={statusNotice.error ? 'alert' : 'status'}>{statusNotice.message}</div>}
      {notices.map(notice => <HabitAwardToast key={notice.id} notice={notice} disabled={busy}
        onUndo={() => undo(notice)} onDismiss={() => setNotices(current => current.filter(item => item.id !== notice.id))} />)}
      {bonusNotices.map(notice => <HabitBonusToast key={notice.id} notice={notice}
        onDismiss={() => setBonusNotices(current => current.filter(item => item.id !== notice.id))} />)}
    </div>
  </section>
}

// A separate instance per day keeps delayed requests from changing another day's list.
function HabitDayList({ habits, setHabits, statusUpdates, pendingStatusIds, onStatusChange, tab, onTabChange, date, today, busy, onBusy, onCompletionSaved, createHabitForm, syncRevision,
  onHabitCreated, onCreatedNotice }: {
  habits: Habit[]; setHabits: Dispatch<SetStateAction<Habit[]>>
  statusUpdates: ReturnType<typeof createHabitStatusUpdates>
  pendingStatusIds: ReadonlySet<number>
  onStatusChange: (habit: Habit, next: 'ACTIVE' | 'PAUSED') => Promise<void>
  tab: 'active' | 'waiting'; onTabChange: (tab: 'active' | 'waiting') => void
  date: string; today: string; busy: boolean; onBusy: (busy: boolean) => void
  onCompletionSaved: (result: HabitCompletionResult, previous?: Habit) => void
  createHabitForm: RefObject<CreateHabitFormHandle | null>
  onHabitCreated: () => void
  syncRevision: number
  onCreatedNotice: (message: string) => void
}) {
  const store = useHabitStore()
  const savingCompletion = useRef(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [savingCompletionId, setSavingCompletionId] = useState<number | null>(null)
  const [completionError, setCompletionError] = useState('')
  const [endingHabit, setEndingHabit] = useState<Habit | null>(null)
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(() => new Set())
  const groups: Array<{
    key: string; title: string; status: Habit['status']; dayGroup?: HabitDayGroup; collapsible?: boolean
  }> = [
    { key: 'pending', status: 'ACTIVE', dayGroup: 'PENDING', title: '' },
    { key: 'completed-today', status: 'ACTIVE', dayGroup: 'COMPLETED_TODAY',
      title: date === today ? 'Wykonane dzisiaj' : 'Wykonane tego dnia' },
    { key: 'target-reached', status: 'ACTIVE', dayGroup: 'TARGET_REACHED', title: 'Cel tygodniowy osiągnięty' },
    { key: 'upcoming', status: 'UPCOMING', title: 'Zaplanowane' },
    { key: 'finished', status: 'FINISHED', title: 'Zakończone', collapsible: true },
  ]

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

  const load = useCallback(() => store.load(date, true), [store, date])

  useEffect(() => {
    const controller = new AbortController()
    load().then(() => {
      if (!controller.signal.aborted) {
        setLoadError('')
      }
    }).catch(() => {
      if (!controller.signal.aborted) setLoadError('Nie udało się pobrać nawyków. Odśwież stronę i spróbuj ponownie.')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [load, today, syncRevision])

  async function add(name: string, targetDays: number, rewardPoints: number, description: string, schedule: HabitSchedule,
    categoryId: number | null, goalIds: number[], activityStatus: 'ACTIVE' | 'PLANNED') {
    if (busy) throw new Error('Poczekaj na zakończenie zapisu.')
    onBusy(true)
    try {
      const created = await createHabit(name, targetDays, rewardPoints, description, schedule, categoryId, goalIds, activityStatus)
      statusUpdates.created(created)
      store.set(today, current => [...current.filter(item => item.id !== created.id), created])
      if (date !== today) setHabits(current => [...current.filter(item => item.id !== created.id), created])
      onCreatedNotice(activityStatus === 'PLANNED' ? 'Nawyk został dodany do Poczekalni' : 'Nawyk został utworzony')
    } finally {
      onBusy(false)
    }
  }

  async function save(id: number, name: string, targetDays: number, rewardPoints: number, description: string,
    schedule: HabitSchedule, categoryId: number | null, goalIds: number[]) {
    if (busy) throw new Error('Poczekaj na zakończenie zapisu.')
    onBusy(true)
    try {
      const result = await updateHabit(id, name, targetDays, rewardPoints, description, schedule, categoryId, goalIds)
      store.update(result.habit, date)
      await load()
      onCompletionSaved(result)
      setEditingId(null)
      setExpandedDescriptions(current => { const next = new Set(current); next.delete(id); return next })
    } catch (failure) {
      if (failure instanceof HabitUpdateConflictError) {
        await load().catch(() => null)
      }
      throw failure
    } finally {
      onBusy(false)
    }
  }

  async function toggleCompletion(habit: Habit) {
    if (busy || statusUpdates.pending(habit.id) || savingCompletion.current || !canToggleHabit(habit)) return
    const completed = !habit.completed
    savingCompletion.current = true
    onBusy(true)
    setSavingCompletionId(habit.id)
    setCompletionError('')
    setHabits(current => current.map(item => item.id === habit.id ? withOptimisticCompletion(item, completed) : item))
    try {
      const result = await setHabitCompletion(habit.id, date, completed)
      setHabits(current => current.map(item => item.id === habit.id ? result.habit : item))
      onCompletionSaved(result, habit)
    } catch (failure) {
      setHabits(current => current.map(item => item.id === habit.id ? habit : item))
      setCompletionError(failure instanceof Error ? failure.message : 'Nie udało się zapisać wykonania nawyku.')
    } finally {
      savingCompletion.current = false
      setSavingCompletionId(null)
      onBusy(false)
    }
  }

  async function remove(id: number) {
    if (busy || statusUpdates.pending(id)) return
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

  async function finish(habit: Habit, reason: HabitEndReason) {
    if (busy) throw new Error('Poczekaj na zakończenie zapisu.')
    onBusy(true)
    try {
      await endHabit(habit.id, reason)
      await load()
      setEndingHabit(null)
    } finally {
      onBusy(false)
    }
  }

  const lists = partitionHabits(habits)
  const editingHabit = editingId === null ? null : habits.find(habit => habit.id === editingId) ?? null

  return (
    <>
      <div className="goal-tabs habit-tabs" role="tablist" aria-label="Status nawyków">
        {(['active', 'waiting'] as const).map(key => <button type="button" key={key} role="tab"
          id={`habit-tab-${key}`} aria-selected={tab === key} aria-controls={`habit-panel-${key}`}
          tabIndex={tab === key ? 0 : -1} onClick={() => onTabChange(key)}
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const next = event.key === 'Home' ? 'active' : event.key === 'End' ? 'waiting' : key === 'active' ? 'waiting' : 'active'
            onTabChange(next)
            document.getElementById(`habit-tab-${next}`)?.focus()
          }}>
          <HabitTabLabel tab={key} /><span>{key === 'active' ? lists.active.length : lists.paused.length + lists.planned.length}</span>
        </button>)}
      </div>
      {loading && <p role="status">Ładowanie nawyków…</p>}
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {!loading && (!loadError || habits.length > 0) && <>
        {tab === 'active' && habits.length === 0 && <div className="habit-create-container task-empty-state task-empty-state-prominent">
          <span className="task-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3" />
            </svg>
          </span>
          <p className="empty-state">Nie masz jeszcze nawyków. Dodaj pierwszy i zacznij budować regularność!</p>
        </div>}
        <CreateHabitForm ref={createHabitForm} onAdd={add} onCreated={onHabitCreated} />
        <div role="tabpanel" id="habit-panel-active" aria-labelledby="habit-tab-active" hidden={tab !== 'active'}>
          {lists.active.length === 0 && habits.length > 0 && <HabitActiveEmpty />}
        {groups.map(group => {
          const items = sortHabitsForDay(lists.active.filter(habit => habit.status === group.status
            && (group.dayGroup === undefined || habitDayGroup(habit) === group.dayGroup)))
          if (!items.length) return null
          const list = <ul className="task-list habit-group-list">
          {items.map(habit => <li className={`task habit-card${hasReachedWeeklyTarget(habit) ? ' habit-card-achieved' : ''}${habit.description && editingId === null && !busy ? ' task-card-has-note' : ''}`}
            key={habit.id} onClick={event => handleCardClick(event, habit)}>
            <label className="task-card-check">
                <input type="checkbox" checked={habit.completed}
                  disabled={busy || pendingStatusIds.has(habit.id) || editingId !== null || !canToggleHabit(habit)}
                  aria-label={`${habit.name} — ${displayDate.format(dateFromKey(date))}`}
                  onChange={() => void toggleCompletion(habit)} />
              </label>
              <div className="habit-card-content">
                <div className="habit-heading-row">
                  <div className="habit-name">
                    {habit.description ? <button type="button" className="habit-note-toggle" disabled={busy}
                      aria-expanded={expandedDescriptions.has(habit.id)} aria-controls={`habit-note-${habit.id}`}
                      aria-label={`${expandedDescriptions.has(habit.id) ? 'Ukryj' : 'Pokaż'} notatkę: ${habit.name}${habit.category ? `. Kategoria: ${habit.category.name}` : ''}`}
                      onClick={() => toggleDescription(habit.id)}>
                      <span className="task-title">{habit.name}</span>
                      <svg className="task-note-icon" viewBox="0 0 20 20" fill="none"
                        stroke="currentColor" strokeWidth="1.5" aria-label="Zawiera notatkę" role="img">
                        <path d="M5 2.5h7l3 3V17H5zM12 2.5v3h3M7.5 9h5M7.5 12h5" />
                      </svg>
                    </button> : <span className="task-title">{habit.name}</span>}
                  </div>
                  <TaskActionsMenu itemTitle={habit.name} itemType="nawyku"
                    disabled={busy || pendingStatusIds.has(habit.id) || editingId !== null}
                    actions={[
                      { ...habitStatusAction(habit), onSelect: () => void onStatusChange(habit, 'PAUSED') },
                      ...(!habit.endedOn ? [{ label: 'Edytuj', onSelect: () => setEditingId(habit.id) }] : []),
                      ...(!habit.endedOn && habit.status !== 'FINISHED'
                        ? [{ label: 'Zakończ nawyk', onSelect: () => setEndingHabit(habit) }] : []),
                      { label: 'Usuń', destructive: true, onSelect: () => void remove(habit.id) },
                    ]} />
                </div>
                {pendingStatusIds.has(habit.id) && <span className="habit-status-saving" role="status">Wstrzymywanie…</span>}
                {(habit.category || (habit.goalTitles?.length ?? 0) > 0) && <div className="habit-card-associations">
                  {habit.category && <CategoryMarker category={habit.category} className="habit-category-marker" />}
                  {(habit.goalTitles?.length ?? 0) > 0 && <p className="task-card-goals">
                    <svg className="task-card-goal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="8" />
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 2v2M22 12h-2M12 22v-2M2 12h2" />
                    </svg>
                    <span>{habit.goalTitles.join(' · ')}</span>
                  </p>}
                </div>}
                <div className="habit-meta">
                <div className="habit-primary-meta">
                  <HabitProgressPresentation habit={habit} />
                  <span className="task-points task-card-points">{habit.rewardPoints} pkt</span>
                </div>
                <HabitCompletionBonus habit={habit} today={today} />
                {((habit.completionLimit !== null && habit.completionBonusPoints === null)
                  || habit.status === 'UPCOMING' || (habit.endDate !== null && habit.completionBonusPoints === null)
                  || (habit.status === 'FINISHED' && habit.endedOn && habit.endReason)) && <div className="habit-extra-meta">
                  {habit.completionLimit !== null && habit.completionBonusPoints === null && <small className="habit-total-progress">
                    <span className="habit-total-progress-count">{habit.totalCompletions}/{habit.completionLimit}</span>
                    {' '}
                    <span>wykonań</span>
                  </small>}
                  {habit.status === 'UPCOMING' && <small className="habit-schedule-meta">
                    <HabitCalendarIcon />Od {displayDate.format(dateFromKey(habit.startDate))}
                  </small>}
                  {habit.endDate && habit.completionBonusPoints === null && !(habit.status === 'FINISHED' && habit.endedOn) && <small className="habit-schedule-meta">
                    <HabitCalendarIcon />Do {habitEndDateLabel(habit.endDate, today)}
                  </small>}
                  {habit.status === 'FINISHED' && habit.endedOn && habit.endReason && <small className="habit-schedule-meta habit-manual-ending">
                    <HabitCalendarIcon /><span>Zakończono {habitEndDateLabel(habit.endedOn, today)} · {habitEndReasonLabel(habit.endReason)}</span>
                  </small>}
                </div>}
                </div>
              </div>
            {habit.description && <>
              {expandedDescriptions.has(habit.id) && habit.category && <CategoryCardDetail category={habit.category} />}
              <p id={`habit-note-${habit.id}`} className="task-card-description habit-description"
                hidden={!expandedDescriptions.has(habit.id)}>{habit.description}</p>
            </>}
          </li>)}
          </ul>
          if (group.collapsible) return <details className="habit-finished-section" key={group.key}>
            <summary><span>{group.title}</span><span className="task-section-count"
              aria-label={`Liczba zakończonych nawyków: ${items.length}`}>{items.length}</span></summary>
            {list}
          </details>
          return <section className={`habit-list-group${group.title ? ' habit-list-group-separated' : ''}${group.dayGroup === 'TARGET_REACHED' ? ' habit-list-group-achieved' : ''}`} key={group.key}
            aria-label={group.title || undefined}>
            {group.title && <h3>{group.title}</h3>}
            {list}
          </section>
        })}
        </div>
        <div role="tabpanel" id="habit-panel-waiting" aria-labelledby="habit-tab-waiting" hidden={tab !== 'waiting'}>
          <HabitWaitingRoom paused={lists.paused} planned={lists.planned}
            pendingIds={pendingStatusIds} disabled={busy || editingId !== null}
            onResume={habit => void onStatusChange(habit, 'ACTIVE')}
            onStart={habit => void onStatusChange(habit, 'ACTIVE')} onEdit={habit => setEditingId(habit.id)} />
        </div>
        {editingHabit && <EditHabitForm habit={editingHabit}
          onSave={(name, targetDays, points, description, schedule, categoryId, goalIds) =>
            save(editingHabit.id, name, targetDays, points, description, schedule, categoryId, goalIds)}
          onCancel={() => setEditingId(null)} />}
        {deletingId !== null && <p className="reward-status" role="status">Usuwanie nawyku…</p>}
        {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
        {savingCompletionId !== null && <p role="status">Zapisywanie wykonania…</p>}
        {completionError && <p className="form-error" role="alert">{completionError}</p>}
        {endingHabit && <EndHabitDialog habit={endingHabit} onClose={() => setEndingHabit(null)}
          onConfirm={reason => finish(endingHabit, reason)} />}
      </>}
    </>
  )
}

function HabitProgressPresentation({ habit }: { readonly habit: Habit }) {
  const target = habit.target?.targetDays ?? null
  const progress = formatHabitProgress(habit.weeklyCompletedDays, target)
  const achieved = hasReachedWeeklyTarget(habit)

  return <span className="habit-progress-summary"
    aria-label={target === null
      ? `Wykonane dni w tygodniu: ${habit.weeklyCompletedDays}, brak ustalonego celu`
      : `Wykonane dni w tygodniu: ${habit.weeklyCompletedDays}, cel: ${target}${achieved ? ', cel osiągnięty' : ''}`}>
    {target === null
      ? <span className="habit-progress-unset">Brak ustalonego celu na ten dzień</span>
      : <>
        <span className={`habit-progress${achieved ? ' habit-progress-achieved' : ''}`}>{progress.count}</span>
        <span className="habit-progress-period">{progress.period}</span>
      </>}
    {achieved && <HabitSuccessIcon />}
    {!achieved && habit.weeklyRewardGranted && <HabitAwardStatus />}
  </span>
}

function HabitTabLabel({ tab }: { tab: 'active' | 'waiting' }) {
  return <span>{tab === 'active' ? 'Aktywne' : 'Poczekalnia'}</span>
}

function HabitActiveEmpty() {
  return <div className="habit-tab-empty">
    <p>Nie masz aktywnych nawyków</p>
    <small>Utwórz nowy nawyk lub wróć do tych z Poczekalni.</small>
  </div>
}

function HabitSuccessIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" />
  </svg>
}

function HabitCalendarIcon() {
  return <svg className="habit-calendar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </svg>
}

function HabitTrophyIcon() {
  return <svg className="habit-completion-bonus-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
    <path d="M8 6H5v2a4 4 0 0 0 4 4m7-6h3v2a4 4 0 0 1-4 4M12 13v5m-4 2h8m-7-2h6" />
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

function HabitBonusToast({ notice, onDismiss }: { notice: CompletionBonusNotice; onDismiss: () => void }) {
  const dismiss = useRef(onDismiss)
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss.current(), 5000)
    return () => window.clearTimeout(timer)
  }, [])

  return <div className="habit-toast">
    <HabitTrophyIcon />
    <div className="habit-toast-message">
      <span role="status">Premia za ukończenie! {notice.name} · +{notice.points} pkt</span>
    </div>
  </div>
}
