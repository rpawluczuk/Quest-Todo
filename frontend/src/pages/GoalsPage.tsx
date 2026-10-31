import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type SubmitEvent } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Flag, History, Link2, Plus, PlusCircle, Target } from 'lucide-react'
import { createGoal, deleteGoal, getGoalEntries, getGoals, getMilestones, updateGoal, updateGoalCompletion, type Milestone } from '../api/goalApi'
import { createGoalJournalStore } from '../goalJournal'
import GoalJournal, { type GoalJournalHandle } from '../components/GoalJournal'
import TaskActionsMenu from '../components/TaskActionsMenu'
import type { Goal } from '../types/Goal'
import GoalTasks, { type GoalTasksProps } from '../components/GoalTasks'
import GoalHabits from '../components/GoalHabits'
import GoalMilestones from '../components/GoalMilestones'
import AutoResizeTextarea from '../components/AutoResizeTextarea'
import GoalDefinitionText from '../components/GoalDefinitionText'
import GoalCompletionDialog from '../components/GoalCompletionDialog'
import type { GoalSection, GoalSectionActionHandle } from '../components/GoalSectionAction'

function titleError(title: string): string {
  if (!title.trim()) return 'Podaj tytuł celu.'
  if (title.length > 120) return 'Tytuł celu może mieć maksymalnie 120 znaków.'
  return ''
}

function definitionError(currentState: string, desiredOutcome: string): string {
  if (currentState.length > 2000) return 'Stan początkowy może mieć maksymalnie 2000 znaków.'
  if (desiredOutcome.length > 2000) return 'Kryterium osiągnięcia celu może mieć maksymalnie 2000 znaków.'
  return ''
}

type GoalTab = GoalSection

export default function GoalsPage({ onHabitGoalLinksChanged, onCreateTask, onCreateHabit, habitRevision, onHabitPointsChanged,
  ...taskProps }: GoalTasksProps & {
  onHabitGoalLinksChanged: () => void
  onCreateTask: (goalId: number, trigger: HTMLButtonElement, onCreated: () => void) => void
  onCreateHabit: (goalId: number, trigger: HTMLButtonElement, onCreated: () => void) => void
  habitRevision: number
  onHabitPointsChanged: (balance: number) => void
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [journalStore] = useState(() => createGoalJournalStore(getGoalEntries))
  const journalRef = useRef<GoalJournalHandle>(null)
  const [initialStateOpenId, setInitialStateOpenId] = useState<number | null>(null)
  const [activeTabByGoal, setActiveTabByGoal] = useState<Record<number, GoalTab>>({})
  const [taskCountByGoal, setTaskCountByGoal] = useState<Record<number, number>>({})
  const [habitCountByGoal, setHabitCountByGoal] = useState<Record<number, number>>({})
  const [sectionActionDisabled, setSectionActionDisabled] = useState<Record<string, boolean>>({})
  const [actionMenu, setActionMenu] = useState<{ goalId: number; tab: 'tasks' | 'habits' } | null>(null)
  const [actionMenuPosition, setActionMenuPosition] = useState<CSSProperties | undefined>()
  const [creationNotice, setCreationNotice] = useState('')
  const [achievedOpen, setAchievedOpen] = useState(false)
  const [completionGoal, setCompletionGoal] = useState<Goal | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [milestonesByGoal, setMilestonesByGoal] = useState<Record<number, Milestone[]>>({})
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
  const createdGoalId = useRef<number | null>(null)
  const sectionActions = useRef(new Map<string, GoalSectionActionHandle>())
  const sectionActionTrigger = useRef<HTMLButtonElement>(null)
  const actionMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    getGoals(controller.signal).then(loadedGoals => {
      setGoals(loadedGoals)
      loadedGoals.forEach(goal => {
        getMilestones(goal.id, controller.signal).then(items => {
          setMilestonesByGoal(current => ({ ...current, [goal.id]: items }))
        }).catch(() => undefined)
      })
    }).catch(failure => {
      if (!controller.signal.aborted) setLoadError(failure instanceof Error ? failure.message : 'Nie udało się pobrać celów.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  useEffect(() => { if (createOpen) createInput.current?.focus() }, [createOpen])
  useEffect(() => { if (editingId !== null) editInput.current?.focus() }, [editingId])
  useLayoutEffect(() => {
    if (createdGoalId.current === null) return
    const card = document.getElementById(`goal-card-${createdGoalId.current}`)
    if (!card) return
    card.querySelector<HTMLButtonElement>('.goal-details-toggle')?.focus({ preventScroll: true })
    card.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
    createdGoalId.current = null
  }, [goals])
  useEffect(() => {
    if (!actionMenu) return
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node) || actionMenuRef.current?.contains(target)
        || sectionActionTrigger.current?.contains(target)) return
      setActionMenu(null)
    }
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setActionMenu(null)
      sectionActionTrigger.current?.focus()
    }
    document.addEventListener('pointerdown', closeOnPointerDown)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [actionMenu])
  useLayoutEffect(() => {
    if (!actionMenu) return
    const placeMenu = () => {
      const trigger = sectionActionTrigger.current
      const menu = actionMenuRef.current
      if (!trigger || !menu) return
      const triggerBox = trigger.getBoundingClientRect()
      const width = Math.min(300, window.innerWidth - 24)
      const height = menu.offsetHeight
      const opensBelow = window.innerHeight - triggerBox.bottom - 12 >= height || triggerBox.top < height + 12
      setActionMenuPosition({
        width,
        left: Math.max(12, Math.min(triggerBox.right - width, window.innerWidth - width - 12)),
        top: opensBelow ? triggerBox.bottom + 6 : triggerBox.top - height - 6,
        visibility: 'visible',
      })
    }
    placeMenu()
    window.addEventListener('resize', placeMenu)
    window.addEventListener('scroll', placeMenu, true)
    return () => {
      window.removeEventListener('resize', placeMenu)
      window.removeEventListener('scroll', placeMenu, true)
    }
  }, [actionMenu])
  useEffect(() => {
    if (!creationNotice) return
    const timer = window.setTimeout(() => setCreationNotice(''), 4000)
    return () => window.clearTimeout(timer)
  }, [creationNotice])

  const updateTaskCount = useCallback((goalId: number, count: number) => {
    setTaskCountByGoal(current => current[goalId] === count ? current : { ...current, [goalId]: count })
  }, [])

  const updateHabitCount = useCallback((goalId: number, count: number) => {
    setHabitCountByGoal(current => current[goalId] === count ? current : { ...current, [goalId]: count })
  }, [])

  const updateSectionActionDisabled = useCallback((goalId: number, section: GoalSection, disabled: boolean) => {
    const key = `${goalId}:${section}`
    setSectionActionDisabled(current => current[key] === disabled ? current : { ...current, [key]: disabled })
  }, [])

  function toggleGoal(goalId: number) {
    setActionMenu(null)
    setInitialStateOpenId(null)
    if (expandedId !== goalId) setActiveTabByGoal(current => ({ ...current, [goalId]: 'milestones' }))
    setExpandedId(current => current === goalId ? null : goalId)
  }

  function selectGoalTab(goalId: number, tab: GoalTab) {
    setActionMenu(null)
    if (tab !== 'milestones') sectionActions.current.get(`${goalId}:milestones`)?.resetView?.()
    setActiveTabByGoal(current => ({ ...current, [goalId]: tab }))
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, goalId: number) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const tabs = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])
    const currentIndex = tabs.indexOf(event.currentTarget)
    if (currentIndex < 0) return
    event.preventDefault()
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    const nextTab = ['milestones', 'tasks', 'habits'][nextIndex] as GoalTab
    selectGoalTab(goalId, nextTab)
    tabs[nextIndex]?.focus()
  }

  function handleActionMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
    if (!items.length) return
    event.preventDefault()
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowDown' ? (currentIndex + 1 + items.length) % items.length
        : (currentIndex - 1 + items.length) % items.length
    items[nextIndex]?.focus()
  }

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
      createdGoalId.current = goal.id
      setGoals(current => [...current, goal])
      setMilestonesByGoal(current => ({ ...current, [goal.id]: [] }))
      setActiveTabByGoal(current => ({ ...current, [goal.id]: 'milestones' }))
      setExpandedId(goal.id)
      setInitialStateOpenId(null)
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

  async function changeCompletion(goal: Goal, completed: boolean) {
    if (sending.current) return
    sending.current = true
    setPendingId(goal.id)
    setError('')
    try {
      const updated = await updateGoalCompletion(goal.id, completed)
      setGoals(current => current.map(item => item.id === updated.id ? updated : item))
      if (expandedId === goal.id) setExpandedId(null)
      if (editingId === goal.id) setEditingId(null)
      setCompletionGoal(null)
      setCreationNotice(completed ? 'Cel został osiągnięty.' : 'Cel został ponownie otwarty.')
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'Nie udało się zmienić statusu celu.'
      setError(message)
      throw failure instanceof Error ? failure : new Error(message)
    } finally {
      sending.current = false
      setPendingId(null)
    }
  }

  const activeGoals = goals.filter(goal => !goal.completed)
  const completedGoals = goals.filter(goal => goal.completed).sort((left, right) =>
    Date.parse(right.completedAt ?? '') - Date.parse(left.completedAt ?? ''))
  const displayedGoals = [...activeGoals, ...completedGoals]

  function completedDate(value: string | null) {
    if (!value) return ''
    return new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
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
        {createOpen && <form className="task-form goal-form goal-create-form" onSubmit={add}>
        <label className="form-field"><span>Tytuł celu <span className="required-field-marker" aria-hidden="true">*</span></span>
          <input ref={createInput} value={title} maxLength={120} required disabled={saving}
            onChange={event => setTitle(event.target.value)} placeholder="Np. Przebiec 5 km" /></label>
        <button type="button" className="goal-definition-toggle" disabled={saving}
          aria-expanded={createDetailsOpen} onClick={() => setCreateDetailsOpen(current => !current)}>
          {createDetailsOpen ? <ChevronUp size={17} strokeWidth={2} aria-hidden="true" />
            : <ChevronDown size={17} strokeWidth={2} aria-hidden="true" />}
          <span>{createDetailsOpen ? 'Ukryj szczegóły celu' : 'Dodaj szczegóły celu'}</span>
          {!createDetailsOpen && <span className="goal-definition-toggle-optional">(opcjonalnie)</span>}
        </button>
        {createDetailsOpen && <>
          <label className="form-field goal-definition-field"><span>Kiedy uznam cel za osiągnięty?</span>
            <AutoResizeTextarea value={desiredOutcome} maxLength={2000} disabled={saving}
              placeholder="Np. Przebiegnę 5 km bez zatrzymywania się"
              onChange={event => setDesiredOutcome(event.target.value)} /></label>
          <label className="form-field goal-definition-field"><span>Stan początkowy</span>
            <AutoResizeTextarea value={currentState} maxLength={2000} disabled={saving}
              placeholder="Np. Obecnie jestem w stanie przebiec 2 km"
              onChange={event => setCurrentState(event.target.value)} /></label>
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
      {goals.length > 0 && <ul className="task-list goal-list">{displayedGoals.map(goal => {
        const milestones = milestonesByGoal[goal.id]
        const completedMilestones = milestones?.filter(item => item.completed).length ?? 0
        const activeTab = activeTabByGoal[goal.id] ?? 'milestones'
        const activeActionKey = `${goal.id}:${activeTab}`
        const actionLabel = activeTab === 'milestones' ? 'Dodaj kamień milowy'
          : activeTab === 'tasks' ? 'Dodaj zadanie do celu' : 'Dodaj nawyk do celu'
        const isFirstCompleted = goal.completed && completedGoals[0]?.id === goal.id
        return <Fragment key={goal.id}>
          {isFirstCompleted && <li className="goal-achieved-section">
            <button type="button" className="goal-achieved-toggle" aria-expanded={achievedOpen}
              onClick={() => setAchievedOpen(current => !current)}>
              <span><CheckCircle2 aria-hidden="true" />Osiągnięte ({completedGoals.length})</span>
              <ChevronDown className={achievedOpen ? 'is-open' : undefined} aria-hidden="true" />
            </button>
          </li>}
          {(!goal.completed || achievedOpen) && <li id={`goal-card-${goal.id}`}
            className={`task-card goal-card${goal.completed ? ' goal-card-achieved' : ''}`}>
          {editingId === goal.id ? <form className="task-form goal-form goal-edit-form" onSubmit={save}>
            <label className="form-field"><span>Tytuł celu <span className="required-field-marker" aria-hidden="true">*</span></span>
              <input ref={editInput} value={editTitle} maxLength={120} required disabled={pendingId !== null}
                onChange={event => setEditTitle(event.target.value)} /></label>
            <label className="form-field goal-definition-field"><span>Stan początkowy</span>
              <AutoResizeTextarea value={editCurrentState} maxLength={2000} disabled={pendingId !== null}
                placeholder="Opisz sytuację w momencie rozpoczęcia realizacji celu…"
                onChange={event => setEditCurrentState(event.target.value)} /></label>
            <label className="form-field goal-definition-field"><span>Kiedy uznam cel za osiągnięty?</span>
              <small className="goal-definition-help">Opisz konkretny rezultat lub warunki, po których poznasz, że cel został osiągnięty.</small>
              <AutoResizeTextarea value={editDesiredOutcome} maxLength={2000} disabled={pendingId !== null}
                placeholder="Opisz warunki, po których rozpoznasz sukces…"
                onChange={event => setEditDesiredOutcome(event.target.value)} /></label>
            <div className="task-actions">
              <button type="submit" disabled={pendingId !== null}>{pendingId === goal.id ? 'Zapisywanie…' : 'Zapisz'}</button>
              <button type="button" className="secondary-button" disabled={pendingId !== null} onClick={() => {
                setEditingId(null); setError('')
              }}>Anuluj</button>
            </div>
          </form> : <>
            <button type="button" className="goal-title goal-details-toggle" aria-expanded={expandedId === goal.id}
              aria-label={goal.title}
              aria-describedby={!goal.completed && expandedId !== goal.id && milestones?.length
                ? `goal-milestone-summary-${goal.id}` : undefined}
              aria-controls={expandedId === goal.id ? `goal-tasks-${goal.id} goal-habits-${goal.id} goal-milestones-${goal.id}` : undefined}
              onClick={() => toggleGoal(goal.id)}>
              <span className="goal-title-text">{goal.title}</span>
              {goal.completed ? <span className="goal-completion-summary">
                <CheckCircle2 size={15} strokeWidth={2} aria-hidden="true" />
                <span>Osiągnięty{goal.completedAt ? ` ${completedDate(goal.completedAt)}` : ''}</span>
              </span> : expandedId !== goal.id && !!milestones?.length && <span className="goal-milestone-summary"
                id={`goal-milestone-summary-${goal.id}`} aria-live="polite">
                <Flag size={15} strokeWidth={2} aria-hidden="true" />
                <span>{completedMilestones}/{milestones.length} kamieni milowych</span>
              </span>}
            </button>
            <div className="goal-header-actions">
              <button type="button" className="goal-chevron-button" aria-expanded={expandedId === goal.id}
                aria-label={`${expandedId === goal.id ? 'Zwiń' : 'Rozwiń'} cel „${goal.title}”`}
                aria-controls={expandedId === goal.id ? `goal-tasks-${goal.id} goal-habits-${goal.id} goal-milestones-${goal.id}` : undefined}
                onClick={() => toggleGoal(goal.id)}>
                <svg className="goal-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              <TaskActionsMenu itemTitle={goal.title} itemType="celu" disabled={pendingId !== null} actions={[
                ...(goal.completed ? [{ label: 'Wznów cel', icon: 'rotate-ccw' as const,
                  onSelect: () => { void changeCompletion(goal, false).catch(() => undefined) } }]
                  : [{ label: 'Oznacz jako osiągnięty', icon: 'check-circle-2' as const,
                    onSelect: () => {
                      if (expandedId === goal.id && journalRef.current) journalRef.current.beforeStatusChange(() => setCompletionGoal(goal))
                      else setCompletionGoal(goal)
                    } },
                  { label: 'Edytuj', icon: 'pencil' as const, onSelect: () => {
                  setCreateOpen(false); setEditingId(goal.id); setEditTitle(goal.title)
                  setEditCurrentState(goal.currentState ?? ''); setEditDesiredOutcome(goal.desiredOutcome ?? ''); setError('')
                } }]),
                { label: 'Usuń', destructive: true, onSelect: () => void remove(goal.id) },
              ]} />
            </div>
            {expandedId === goal.id && <>
              {goal.desiredOutcome ? <section className="goal-success-criterion" aria-labelledby={`goal-success-heading-${goal.id}`}>
                <h3 id={`goal-success-heading-${goal.id}`}>
                  <Target size={17} strokeWidth={2} aria-hidden="true" />
                  <span>Kiedy uznam cel za osiągnięty?</span>
                </h3>
                <GoalDefinitionText text={goal.desiredOutcome} maxLines={2} />
              </section> : <p className="goal-success-empty">Nie określono kryterium osiągnięcia celu</p>}
              <div className="goal-tabs-row">
              <div className="goal-tabs" role="tablist" aria-label={`Elementy celu „${goal.title}”`}>
                <button type="button" role="tab" id={`goal-tab-milestones-${goal.id}`}
                  aria-selected={activeTab === 'milestones'} aria-controls={`goal-panel-milestones-${goal.id}`}
                  tabIndex={activeTab === 'milestones' ? 0 : -1} onKeyDown={event => handleTabKey(event, goal.id)}
                  onClick={() => selectGoalTab(goal.id, 'milestones')}>
                  <span>Kamienie</span><span className="goal-tab-count">{milestones?.length ?? 0}</span>
                </button>
                <button type="button" role="tab" id={`goal-tab-tasks-${goal.id}`}
                  aria-selected={activeTab === 'tasks'} aria-controls={`goal-panel-tasks-${goal.id}`}
                  tabIndex={activeTab === 'tasks' ? 0 : -1} onKeyDown={event => handleTabKey(event, goal.id)}
                  onClick={() => selectGoalTab(goal.id, 'tasks')}>
                  <span>Zadania</span><span className="goal-tab-count">{taskCountByGoal[goal.id] ?? 0}</span>
                </button>
                <button type="button" role="tab" id={`goal-tab-habits-${goal.id}`}
                  aria-selected={activeTab === 'habits'} aria-controls={`goal-panel-habits-${goal.id}`}
                  tabIndex={activeTab === 'habits' ? 0 : -1} onKeyDown={event => handleTabKey(event, goal.id)}
                  onClick={() => selectGoalTab(goal.id, 'habits')}>
                  <span>Nawyki</span><span className="goal-tab-count">{habitCountByGoal[goal.id] ?? 0}</span>
                </button>
              </div>
              {!goal.completed && <button ref={sectionActionTrigger} type="button"
                className="add-task-header-button goal-subsection-add goal-tabs-add"
                aria-label={actionLabel} title={actionLabel}
                aria-haspopup={activeTab === 'milestones' ? undefined : 'menu'}
                aria-expanded={activeTab === 'milestones' ? undefined : actionMenu?.goalId === goal.id
                  && actionMenu.tab === activeTab}
                aria-controls={activeTab === 'milestones' ? `goal-panel-${activeTab}-${goal.id}`
                  : `goal-add-menu-${goal.id}`}
                disabled={sectionActionDisabled[activeActionKey] ?? true}
                onKeyDown={event => {
                  if (activeTab === 'milestones' || event.key !== 'ArrowDown') return
                  event.preventDefault()
                  setActionMenu({ goalId: goal.id, tab: activeTab })
                  requestAnimationFrame(() => actionMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus())
                }}
                onClick={() => {
                  if (activeTab === 'milestones') {
                    sectionActions.current.get(activeActionKey)?.activate()
                    return
                  }
                  setActionMenu(current => current?.goalId === goal.id && current.tab === activeTab
                    ? null : { goalId: goal.id, tab: activeTab })
                }}>
                <Plus aria-hidden="true" />
              </button>}
              {!goal.completed && actionMenu?.goalId === goal.id && actionMenu.tab === activeTab && <div ref={actionMenuRef}
                className="goal-add-menu" id={`goal-add-menu-${goal.id}`} role="menu"
                style={actionMenuPosition}
                onKeyDown={handleActionMenuKey}
                aria-label={activeTab === 'tasks' ? 'Dodaj zadanie do celu' : 'Dodaj nawyk do celu'}>
                <button type="button" role="menuitem" onClick={() => {
                  setActionMenu(null)
                  const trigger = sectionActionTrigger.current
                  if (!trigger) return
                  if (activeTab === 'tasks') onCreateTask(goal.id, trigger,
                    () => setCreationNotice('Utworzono nowe zadanie.'))
                  else onCreateHabit(goal.id, trigger, () => setCreationNotice('Utworzono nowy nawyk.'))
                }}>
                  <PlusCircle aria-hidden="true" />
                  <span><strong>{activeTab === 'tasks' ? 'Utwórz nowe zadanie' : 'Utwórz nowy nawyk'}</strong>
                    <small>{activeTab === 'tasks' ? 'Nowe zadanie przypisane do tego celu'
                      : 'Nowy nawyk przypisany do tego celu'}</small></span>
                </button>
                <button type="button" role="menuitem" onClick={() => {
                  setActionMenu(null)
                  sectionActions.current.get(activeActionKey)?.activate()
                }}>
                  <Link2 aria-hidden="true" />
                  <span><strong>Przypnij istniejące</strong>
                    <small>{activeTab === 'tasks' ? 'Wybierz zadanie ze swojej listy'
                      : 'Wybierz nawyk ze swojej listy'}</small></span>
                </button>
              </div>}
              </div>
              <div className="goal-tab-panel" role="tabpanel" id={`goal-panel-milestones-${goal.id}`}
                aria-labelledby={`goal-tab-milestones-${goal.id}`} hidden={activeTab !== 'milestones'}>
                <GoalMilestones key={`milestones-${goal.id}`} goalId={goal.id} readOnly={goal.completed}
                  actionTriggerRef={sectionActionTrigger}
                  ref={action => {
                    if (action) sectionActions.current.set(`${goal.id}:milestones`, action)
                    else sectionActions.current.delete(`${goal.id}:milestones`)
                  }}
                  onActionDisabledChange={updateSectionActionDisabled}
                  onItemsChange={items => setMilestonesByGoal(current => ({ ...current, [goal.id]: items }))} />
              </div>
              <div className="goal-tab-panel" role="tabpanel" id={`goal-panel-tasks-${goal.id}`}
                aria-labelledby={`goal-tab-tasks-${goal.id}`} hidden={activeTab !== 'tasks'}>
                <GoalTasks key={goal.id} goalId={goal.id} goalTitle={goal.title} readOnly={goal.completed} {...taskProps}
                  actionTriggerRef={sectionActionTrigger}
                  ref={action => {
                    if (action) sectionActions.current.set(`${goal.id}:tasks`, action)
                    else sectionActions.current.delete(`${goal.id}:tasks`)
                  }}
                  onActionDisabledChange={updateSectionActionDisabled}
                  onCountChange={updateTaskCount} />
              </div>
              <div className="goal-tab-panel" role="tabpanel" id={`goal-panel-habits-${goal.id}`}
                aria-labelledby={`goal-tab-habits-${goal.id}`} hidden={activeTab !== 'habits'}>
                <GoalHabits key={`habits-${goal.id}`} goalId={goal.id} goalTitle={goal.title} readOnly={goal.completed}
                  onPointsChanged={onHabitPointsChanged}
                  revision={habitRevision}
                  actionTriggerRef={sectionActionTrigger}
                  ref={action => {
                    if (action) sectionActions.current.set(`${goal.id}:habits`, action)
                    else sectionActions.current.delete(`${goal.id}:habits`)
                  }}
                  onActionDisabledChange={updateSectionActionDisabled}
                  onGoalLinksChanged={onHabitGoalLinksChanged}
                  onCountChange={updateHabitCount} />
              </div>
              <GoalJournal ref={journalRef} key={`journal-${goal.id}`} goalId={goal.id} store={journalStore}
                readOnly={goal.completed} onNotice={setCreationNotice} />
              {goal.currentState && <>
                <button type="button" className="goal-initial-state-toggle"
                  aria-expanded={initialStateOpenId === goal.id} aria-controls={`goal-initial-state-${goal.id}`}
                  onClick={() => setInitialStateOpenId(current => current === goal.id ? null : goal.id)}>
                  <span className="goal-initial-state-label">
                    <History size={18} strokeWidth={1.8} aria-hidden="true" />
                    <span>Stan początkowy</span>
                  </span>
                  {initialStateOpenId === goal.id
                    ? <ChevronDown size={18} strokeWidth={2} aria-hidden="true" />
                    : <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />}
                </button>
                <div className="goal-initial-state" id={`goal-initial-state-${goal.id}`}
                  hidden={initialStateOpenId !== goal.id}>
                  <GoalDefinitionText text={goal.currentState} />
                </div>
              </>}
            </>}
          </>}
        </li>}
        </Fragment>})}</ul>}
      {creationNotice && <div className="habit-toast-region">
        <div className="habit-toast milestone-success-toast">
          <CheckCircle2 aria-hidden="true" /><span role="status">{creationNotice}</span>
        </div>
      </div>}
      {completionGoal && <GoalCompletionDialog goal={completionGoal} onClose={() => setCompletionGoal(null)}
        onConfirm={() => changeCompletion(completionGoal, true)} />}
    </>}
  </section>
}
