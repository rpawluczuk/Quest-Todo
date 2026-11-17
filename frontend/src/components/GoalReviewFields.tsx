import { useId } from 'react'
import type { GoalReviewFrequency } from '../types/Goal'
import { formatReviewDate, goalReviewLabels, isGoalReviewFrequency } from '../goalReviews'
import FormSelect, { FormSelectItem } from './FormSelect'

type Props = {
  value: GoalReviewFrequency | null
  onChange: (value: GoalReviewFrequency | null) => void
  disabled: boolean
  savedFrequency?: GoalReviewFrequency | null
  nextReviewDate?: string | null
}

export default function GoalReviewFields({ value, onChange, disabled, savedFrequency, nextReviewDate }: Props) {
  const id = useId()
  const enabled = value !== null
  const unchanged = savedFrequency === value

  return <fieldset className="goal-review-settings" disabled={disabled}>
    <legend>Okresowe przeglądy</legend>
    <label className="goal-review-toggle">
      <input type="checkbox" checked={enabled} aria-controls={`${id}-frequency`}
        onChange={event => onChange(event.target.checked ? 'MONTHLY' : null)} />
      <span>Włącz regularne przeglądy</span>
    </label>
    {enabled && <div id={`${id}-frequency`} className="goal-review-frequency">
      <div className="form-field">
        <label htmlFor={`${id}-select`}>Jak często chcesz przeglądać cel?</label>
        <FormSelect id={`${id}-select`} value={value} disabled={disabled} required
          ariaLabel="Jak często chcesz przeglądać cel?"
          triggerContent={isGoalReviewFrequency(value) ? goalReviewLabels[value] : 'Wybierz częstotliwość'}
          onValueChange={frequency => { if (isGoalReviewFrequency(frequency)) onChange(frequency) }}>
          {Object.entries(goalReviewLabels).map(([frequency, label]) =>
            <FormSelectItem key={frequency} value={frequency} className="goal-select-item">{label}</FormSelectItem>)}
        </FormSelect>
      </div>
      <p className="goal-definition-help">Po upływie wybranego okresu Cel będzie wymagał wpisu do Dziennika.</p>
      <p className="goal-review-date" aria-live="polite">
        {unchanged && nextReviewDate
          ? <>Następny przegląd: <time dateTime={nextReviewDate}>{formatReviewDate(nextReviewDate)}</time></>
          : 'Nowy termin zostanie wyznaczony po zapisaniu zmian.'}
      </p>
    </div>}
  </fieldset>
}
