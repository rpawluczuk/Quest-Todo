import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import AutoResizeTextarea from './AutoResizeTextarea'
import HabitScheduleFields from './HabitScheduleFields'
import type { HabitSchedule } from '../types/Habit'

export default function HabitAdditionalSettings({ description, schedule, disabled, scheduleDisabled = disabled,
  lockMessage, onDescriptionChange, onScheduleChange }: {
  description: string
  schedule: HabitSchedule
  disabled: boolean
  scheduleDisabled?: boolean
  lockMessage?: string | null
  onDescriptionChange: (description: string) => void
  onScheduleChange: (schedule: HabitSchedule) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return <details className="habit-additional-settings" open={expanded}
    onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary aria-expanded={expanded}>
      <ChevronRight className="habit-additional-chevron" aria-hidden="true" />
      <span className="habit-additional-labels">
        <span className="habit-additional-title">Dodatkowe ustawienia</span>
        {!expanded && <small>Opis, okres trwania, premia końcowa</small>}
      </span>
    </summary>
    <div className="habit-additional-content">
      <label className="form-field task-description-field">
        <span>Notatki</span>
        <AutoResizeTextarea value={description} disabled={disabled} rows={2} placeholder="Dodaj notatkę..."
          onChange={event => onDescriptionChange(event.target.value)} />
      </label>
      <HabitScheduleFields value={schedule} onChange={onScheduleChange} disabled={scheduleDisabled}
        lockMessage={lockMessage} />
    </div>
  </details>
}
