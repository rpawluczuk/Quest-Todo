import { targetLabel } from '../habitTarget'
import FormSelect, { FormSelectItem } from './FormSelect'

const targetOptions = [7, 1, 2, 3, 4, 5, 6].map(days => ({
  days,
  label: days === 7 ? 'Codziennie (7 dni)' : targetLabel(days),
}))

export default function HabitTargetField({ value, onChange, disabled }: {
  value: number
  onChange: (days: number) => void
  disabled: boolean
}) {
  const selectedLabel = targetOptions.find(option => option.days === value)?.label ?? targetLabel(value)

  return <div className="form-field habit-frequency-field">
    <span className="required-field-label">
      <span>Cel tygodniowy</span>
      <span className="required-field-marker" aria-hidden="true">*</span>
    </span>
    <FormSelect value={String(value)} onValueChange={selected => onChange(Number(selected))}
      disabled={disabled} required ariaLabel="Cel tygodniowy" triggerContent={<span>{selectedLabel}</span>}>
      {targetOptions.map(option => <FormSelectItem className="goal-select-item" key={option.days}
        value={String(option.days)}>
        {option.label}
      </FormSelectItem>)}
    </FormSelect>
  </div>
}
