import { AlertCircle, Lightbulb, MessageSquare, TrendingUp } from 'lucide-react'
import { formatGoalEntryDate, goalEntryLabels } from '../goalJournal'
import type { GoalEntry } from '../types/GoalEntry'
import GoalDefinitionText from './GoalDefinitionText'

const icons = { NOTE: MessageSquare, SUCCESS: TrendingUp, DIFFICULTY: AlertCircle, INSIGHT: Lightbulb }

export default function GoalEntryItem({ entry }: { entry: GoalEntry }) {
  const Icon = icons[entry.type]
  return <li className="goal-journal-entry">
    <div className="goal-journal-entry-header">
      <span className="goal-journal-entry-type"><Icon size={16} strokeWidth={1.8} aria-hidden="true" />
        {goalEntryLabels[entry.type]}</span>
      <time dateTime={entry.createdAt}>{formatGoalEntryDate(entry.createdAt)}</time>
    </div>
    <GoalDefinitionText text={entry.content} />
  </li>
}
