import type { ReactNode } from 'react'
import type { GoalEntry } from '../types/GoalEntry'
import { goalEntryLabels } from '../goalJournal'
import JournalEntryItem from './JournalEntryItem'
import TaskActionsMenu from './TaskActionsMenu'

export default function GoalEntryItem({ entry, readOnly, disabled, onEdit, onDelete, children }: {
  entry: GoalEntry; readOnly: boolean; disabled: boolean; onEdit: () => void; onDelete: () => void; children?: ReactNode
}) {
  return <JournalEntryItem entry={entry} actions={!readOnly && <TaskActionsMenu itemType="wpisu" itemTitle={`${goalEntryLabels[entry.type]} — ${entry.content.slice(0, 60)}`}
          disabled={disabled} actions={[
            { label: 'Edytuj', icon: 'pencil', onSelect: onEdit },
            { label: 'Usuń', icon: 'trash-2', destructive: true, onSelect: onDelete },
          ]} />}>{children}</JournalEntryItem>
}
