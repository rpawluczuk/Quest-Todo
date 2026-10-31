import { AlertCircle, Lightbulb, MessageSquare, TrendingUp } from 'lucide-react'
import { formatGoalEntryDate, goalEntryLabels } from '../goalJournal'
import type { GoalEntry } from '../types/GoalEntry'
import GoalDefinitionText from './GoalDefinitionText'
import TaskActionsMenu from './TaskActionsMenu'
import type { ReactNode } from 'react'

const icons = { NOTE: MessageSquare, SUCCESS: TrendingUp, DIFFICULTY: AlertCircle, INSIGHT: Lightbulb }

export default function GoalEntryItem({ entry, readOnly, disabled, onEdit, onDelete, children }: {
  entry: GoalEntry; readOnly: boolean; disabled: boolean; onEdit: () => void; onDelete: () => void; children?: ReactNode
}) {
  const Icon = icons[entry.type]
  return <li className="goal-journal-entry" data-entry-id={entry.id}>
    <div className="goal-journal-entry-header">
      <span className="goal-journal-entry-type"><Icon size={16} strokeWidth={1.8} aria-hidden="true" />
        {goalEntryLabels[entry.type]}</span>
      <div className="goal-journal-entry-actions">
        <time dateTime={entry.createdAt}>{formatGoalEntryDate(entry.createdAt)}</time>
        {!readOnly && <TaskActionsMenu itemType="wpisu" itemTitle={`${goalEntryLabels[entry.type]} — ${entry.content.slice(0, 60)}`}
          disabled={disabled} actions={[
            { label: 'Edytuj', icon: 'pencil', onSelect: onEdit },
            { label: 'Usuń', icon: 'trash-2', destructive: true, onSelect: onDelete },
          ]} />}
      </div>
    </div>
    {children ?? <GoalDefinitionText text={entry.content} />}
  </li>
}
