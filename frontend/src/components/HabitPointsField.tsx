export default function HabitPointsField({ value, onChange, disabled }: {
  value: string; onChange: (value: string) => void; disabled: boolean
}) {
  return <label className="form-field">
    <span>Punkty za cel tygodniowy</span>
    <input type="number" min="0" max="2147483647" step="1" required value={value}
      disabled={disabled} onChange={event => onChange(event.target.value)} />
  </label>
}
