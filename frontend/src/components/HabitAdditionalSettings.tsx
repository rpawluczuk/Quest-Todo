import AutoResizeTextarea from './AutoResizeTextarea'
import HabitScheduleFields from './HabitScheduleFields'
import type { HabitSchedule } from '../types/Habit'

export default function HabitAdditionalSettings({ description, schedule, disabled, onDescriptionChange, onScheduleChange }: {
  description: string
  schedule: HabitSchedule
  disabled: boolean
  onDescriptionChange: (description: string) => void
  onScheduleChange: (schedule: HabitSchedule) => void
}) {
  return <details className="habit-additional-settings">
    <summary>
      <span>Dodatkowe ustawienia</span>
      <small>Opis, okres trwania</small>
    </summary>
    <div className="habit-additional-content">
      <label className="form-field task-description-field">
        <span>Opis / notatki (opcjonalnie)</span>
        <AutoResizeTextarea value={description} disabled={disabled}
          onChange={event => onDescriptionChange(event.target.value)} />
      </label>
      <HabitScheduleFields value={schedule} onChange={onScheduleChange} disabled={disabled} />
    </div>
  </details>
}
