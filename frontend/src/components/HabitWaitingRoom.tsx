import { Clock3, Pause, Play } from 'lucide-react'
import TaskActionsMenu from './TaskActionsMenu'
import type { Habit } from '../types/Habit'
import type { ReactNode } from 'react'

export default function HabitWaitingRoom({ paused, planned, pendingIds, disabled, onResume, onStart, onEdit,
  journalId, onJournal, renderJournal }: {
  journalId: number | null; onJournal: (habit: Habit) => void; renderJournal: (habit: Habit) => ReactNode
  paused: Habit[]; planned: Habit[]; pendingIds: ReadonlySet<number>; disabled: boolean
  onResume: (habit: Habit) => void
  onStart: (habit: Habit) => void
  onEdit: (habit: Habit) => void
}) {
  function menu(habit: Habit) {
    return <TaskActionsMenu itemTitle={habit.name} itemType="nawyku"
          disabled={disabled || pendingIds.has(habit.id)}
          actions={[
            { label: 'Dziennik nawyku', icon: 'notebook-pen', expanded: journalId === habit.id,
              controls: journalId === habit.id ? `habit-journal-${habit.id}` : undefined, onSelect: () => onJournal(habit) },
            ...(habit.activityStatus === 'PLANNED' ? [{ label: 'Edytuj', icon: 'pencil' as const, onSelect: () => onEdit(habit) }] : []),
          ]} />
  }

  if (!paused.length && !planned.length) return <div className="habit-tab-empty">
    <p>Poczekalnia jest pusta</p>
    <small>Tutaj znajdziesz nawyki, które wstrzymasz lub zaplanujesz na później.</small>
  </div>

  return <>{[
    { title: 'Wstrzymane', status: 'Wstrzymany', icon: Pause, items: paused },
    { title: 'Zaplanowane', status: 'Zaplanowany', icon: Clock3, items: planned },
  ].filter(group => group.items.length).map(group => <section key={group.status} className="habit-waiting-group"
    aria-label={group.title}>
    <h3>{group.title}</h3>
    <ul className="task-list">{group.items.map(habit => <li key={habit.id} className="habit-waiting-card" aria-busy={pendingIds.has(habit.id)}>
      <div className="habit-waiting-heading"><span className="habit-waiting-title">{habit.name}</span>
        {habit.activityStatus === 'PLANNED' && menu(habit)}
      </div>
      <div className="habit-waiting-actions">
        <span className="habit-waiting-status"><group.icon size={16} aria-hidden="true" />{group.status}</span>
        {habit.activityStatus === 'PAUSED' && menu(habit)}
        {habit.activityStatus === 'PLANNED' && <button type="button" className="habit-resume-action"
          disabled={disabled || pendingIds.has(habit.id)} aria-label={`Rozpocznij nawyk: ${habit.name}`}
          onClick={() => onStart(habit)}><Play size={15} aria-hidden="true" />{pendingIds.has(habit.id) ? 'Rozpoczynanie…' : 'Rozpocznij'}</button>}
        {habit.activityStatus === 'PAUSED' && <button type="button" className="habit-resume-action"
          disabled={disabled || pendingIds.has(habit.id)} aria-label={`Wznów nawyk: ${habit.name}`}
          onClick={() => onResume(habit)}><Play size={15} aria-hidden="true" />{pendingIds.has(habit.id) ? 'Wznawianie…' : 'Wznów'}</button>}
      </div>
      {renderJournal(habit)}
    </li>)}</ul>
  </section>)}</>
}
