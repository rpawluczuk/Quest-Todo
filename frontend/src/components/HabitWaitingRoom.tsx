import { Clock3, Pause } from 'lucide-react'
import type { Habit } from '../types/Habit'

export default function HabitWaitingRoom({ paused, planned }: { paused: Habit[]; planned: Habit[] }) {
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
    <ul className="task-list">{group.items.map(habit => <li key={habit.id} className="habit-waiting-card">
      <span className="habit-waiting-title">{habit.name}</span>
      <span className="habit-waiting-status"><group.icon size={16} aria-hidden="true" />{group.status}</span>
    </li>)}</ul>
  </section>)}</>
}
