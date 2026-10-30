import { Clock3, Pause, Play } from 'lucide-react'
import type { Habit } from '../types/Habit'

export default function HabitWaitingRoom({ paused, planned, pendingIds, disabled, onResume }: {
  paused: Habit[]; planned: Habit[]; pendingIds: ReadonlySet<number>; disabled: boolean
  onResume: (habit: Habit) => void
}) {
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
      <span className="habit-waiting-title">{habit.name}</span>
      <div className="habit-waiting-actions">
        <span className="habit-waiting-status"><group.icon size={16} aria-hidden="true" />{group.status}</span>
        {habit.activityStatus === 'PAUSED' && <button type="button" className="habit-resume-action"
          disabled={disabled || pendingIds.has(habit.id)} aria-label={`Wznów nawyk: ${habit.name}`}
          onClick={() => onResume(habit)}><Play size={15} aria-hidden="true" />{pendingIds.has(habit.id) ? 'Wznawianie…' : 'Wznów'}</button>}
      </div>
    </li>)}</ul>
  </section>)}</>
}
