import { AlertCircle, Lightbulb, MessageSquare, TrendingUp } from 'lucide-react'
import { formatGoalEntryDate, goalEntryLabels } from '../goalJournal'
import type { GoalEntry } from '../types/GoalEntry'
import GoalDefinitionText from './GoalDefinitionText'
import type { ReactNode } from 'react'

const icons = { NOTE: MessageSquare, SUCCESS: TrendingUp, DIFFICULTY: AlertCircle, INSIGHT: Lightbulb }

export default function JournalEntryItem({ entry, actions, children }: {
  entry: GoalEntry; actions?: ReactNode; children?: ReactNode
}) {
  const Icon = icons[entry.type]
  return <li className="goal-journal-entry" data-entry-id={entry.id}>
    <div className="goal-journal-entry-header">
      <span className="goal-journal-entry-type"><Icon size={16} strokeWidth={1.8} aria-hidden="true" />
        {goalEntryLabels[entry.type]}</span>
      <div className="goal-journal-entry-actions">
        <time dateTime={entry.createdAt}>{formatGoalEntryDate(entry.createdAt)}</time>
        {actions}
      </div>
    </div>
    {children ?? <GoalDefinitionText text={entry.content} />}
  </li>
}
