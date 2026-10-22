import { useId, useRef, useState } from 'react'
import { habitEndMode, regularityBonusExplanation, regularityValidationMessage, scheduleWithEndMode,
  type HabitEndMode } from '../habitScheduleForm'
import type { HabitSchedule } from '../types/Habit'
import FormSelect, { FormSelectItem } from './FormSelect'
import InfoTooltipButton from './InfoTooltipButton'

const modeLabels = {
  none: 'Bezterminowo',
  date: 'W określonym dniu',
  count: 'Po określonej liczbie wykonań',
} as const

export default function HabitScheduleFields({ value, onChange, disabled, lockMessage }: {
  value: HabitSchedule; onChange: (value: HabitSchedule) => void; disabled: boolean; lockMessage?: string | null
}) {
  const [mode, setMode] = useState(() => habitEndMode(value))
  const [endDateError, setEndDateError] = useState('')
  const [regularityError, setRegularityError] = useState('')
  const previousEndDate = useRef(value.endDate)
  const endDateErrorId = useId()
  const regularityInputId = useId()
  const regularityErrorId = useId()
  const displayedMode = lockMessage ? habitEndMode(value) : mode
  const hasValidRegularityBonus = value.completionBonusPoints !== null
    && Number.isInteger(value.completionBonusPoints)
    && value.completionBonusPoints >= 1
    && value.completionBonusPoints <= 2147483647
  return <fieldset className="habit-schedule-fields">
    <legend><span>Okres trwania</span></legend>
    {lockMessage && <p className="habit-ending-lock-message" role="note">{lockMessage}</p>}
    <div className="habit-schedule-inputs">
      <label className="form-field">
        <span>Data rozpoczęcia <span className="required-field-marker" aria-hidden="true">*</span></span>
        <input type="date" required value={value.startDate} disabled={disabled}
          onChange={event => onChange({ ...value, startDate: event.target.value })} />
      </label>
      <div className="form-field">
        <span>Sposób zakończenia <span className="required-field-marker" aria-hidden="true">*</span></span>
        <FormSelect value={displayedMode} disabled={disabled} required ariaLabel="Sposób zakończenia"
          triggerContent={<span>{modeLabels[displayedMode]}</span>} onValueChange={selectedMode => {
          const next = selectedMode as HabitEndMode
          setMode(next)
          setEndDateError('')
          onChange(scheduleWithEndMode(value, next, previousEndDate.current))
        }}>
          {(Object.keys(modeLabels) as Array<keyof typeof modeLabels>).map(option =>
            <FormSelectItem className="goal-select-item" key={option} value={option}>
              {modeLabels[option]}
            </FormSelectItem>)}
        </FormSelect>
      </div>
      {displayedMode === 'date' && <label className="form-field">
        <span>Data zakończenia <span className="required-field-marker" aria-hidden="true">*</span></span>
        <span className="habit-end-date-control">
          <input type="date" required min={value.startDate} value={value.endDate ?? ''} disabled={disabled}
            placeholder="Wybierz datę zakończenia" aria-invalid={endDateError ? 'true' : undefined}
            aria-describedby={endDateError ? endDateErrorId : undefined}
            onInvalid={event => {
              if (!event.currentTarget.validity.valueMissing) return
              event.currentTarget.setCustomValidity('Wybierz datę zakończenia')
              setEndDateError('Wybierz datę zakończenia')
            }}
            onChange={event => {
              const endDate = event.target.value || null
              event.target.setCustomValidity('')
              setEndDateError('')
              previousEndDate.current = endDate
              onChange({ ...value, endDate })
            }} />
          {!value.endDate && <span className="habit-end-date-placeholder" aria-hidden="true">
            Wybierz datę zakończenia
          </span>}
        </span>
        {endDateError && <small id={endDateErrorId} className="field-error" role="alert">{endDateError}</small>}
      </label>}
      {displayedMode === 'count' && <label className="form-field">
        <span>Docelowa liczba wykonań <span className="required-field-marker" aria-hidden="true">*</span></span>
        <input type="number" required min="1" max="2147483647" step="1" value={value.completionLimit ?? ''} disabled={disabled}
          onChange={event => onChange({ ...value, completionLimit: event.target.value ? Number(event.target.value) : null })} />
      </label>}
      {displayedMode === 'count' && <label className="form-field habit-completion-bonus-field habit-completion-bonus-start">
        <span>Premia za ukończenie</span>
        <span className="habit-number-unit-control">
          <input type="number" min="1" max="2147483647" step="1" value={value.completionBonusPoints ?? ''}
            aria-label="Premia za ukończenie w punktach" disabled={disabled}
            onChange={event => onChange({ ...value,
              completionBonusPoints: event.target.value === '' ? null : Number(event.target.value),
              requiredSuccessPercent: null })} />
          <span className="habit-number-unit" aria-hidden="true">pkt</span>
        </span>
      </label>}
      {displayedMode === 'date' && <div className={`habit-regularity-settings habit-completion-bonus-start${hasValidRegularityBonus ? ' is-configured' : ''}`}>
        <label className="form-field habit-completion-bonus-field">
          <span>Premia</span>
          <span className="habit-number-unit-control">
            <input type="number" min="1" max="2147483647" step="1" value={value.completionBonusPoints ?? ''}
              aria-label="Premia za regularność w punktach" disabled={disabled}
              onChange={event => onChange({ ...value,
                completionBonusPoints: event.target.value === '' ? null : Number(event.target.value),
                requiredSuccessPercent: event.target.value === '' ? null : value.requiredSuccessPercent })} />
            <span className="habit-number-unit" aria-hidden="true">pkt</span>
          </span>
        </label>
        {hasValidRegularityBonus && <div className="form-field habit-completion-bonus-field">
          <span className="habit-regularity-label">
            <label className="required-field-label" htmlFor={regularityInputId}>
              <span>Próg</span>
              <span className="required-field-marker" aria-hidden="true">*</span>
            </label>
            <InfoTooltipButton message={regularityBonusExplanation(value.requiredSuccessPercent)} />
          </span>
          <span className="habit-number-unit-control">
            <input id={regularityInputId} type="number" required min="1" max="100" step="1"
              value={value.requiredSuccessPercent ?? ''} placeholder="Np. 80"
              aria-label="Wymagana regularność w procentach" disabled={disabled}
              aria-invalid={regularityError ? 'true' : undefined}
              aria-describedby={regularityError ? regularityErrorId : undefined}
              onInvalid={event => {
                const enteredValue = event.currentTarget.value === '' ? null : Number(event.currentTarget.value)
                const message = regularityValidationMessage(enteredValue)
                event.currentTarget.setCustomValidity(message)
                setRegularityError(message)
              }}
              onChange={event => {
                const requiredSuccessPercent = event.target.value === '' ? null : Number(event.target.value)
                event.target.setCustomValidity('')
                setRegularityError('')
                onChange({ ...value, requiredSuccessPercent })
              }} />
            <span className="habit-number-unit" aria-hidden="true">%</span>
          </span>
          {regularityError && <small id={regularityErrorId} className="field-error" role="alert">
            {regularityError}
          </small>}
        </div>}
      </div>}
    </div>
  </fieldset>
}
