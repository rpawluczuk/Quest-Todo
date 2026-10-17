import { useEffect, useRef, useState } from 'react'
import { createCategory } from '../api/categoryApi'
import { notifyCategoriesChanged } from '../categoryEvents'
import type { Category, CategoryColor, CategoryIcon as CategoryIconName } from '../types/Category'
import CategoryAppearancePicker from './CategoryAppearancePicker'

export default function CategoryCreateForm({ onCreated, onCancel, onBusyChange, popoverAppearance = false,
  className = '' }: {
  readonly onCreated: (category: Category) => void
  readonly onCancel: () => void
  readonly onBusyChange?: (busy: boolean) => void
  readonly popoverAppearance?: boolean
  readonly className?: string
}) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<CategoryIconName>('OTHER')
  const [color, setColor] = useState<CategoryColor>('PURPLE')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const nameInput = useRef<HTMLInputElement>(null)

  useEffect(() => { nameInput.current?.focus() }, [])

  async function save() {
    const cleanName = name.trim()
    if (!cleanName) {
      setError('Podaj nazwę kategorii.')
      nameInput.current?.focus()
      return
    }
    setSaving(true)
    onBusyChange?.(true)
    setError('')
    try {
      const created = await createCategory(cleanName, icon, color)
      notifyCategoriesChanged()
      onCreated(created)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się utworzyć kategorii.')
    } finally {
      setSaving(false)
      onBusyChange?.(false)
    }
  }

  return <div className={`task-form category-creator${className ? ` ${className}` : ''}`}>
    <label className="form-field category-name-field">
      <span>Nazwa kategorii</span>
      <input ref={nameInput} value={name} maxLength={60} disabled={saving}
        onChange={event => setName(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') { event.preventDefault(); void save() }
          if (event.key === 'Escape') { event.preventDefault(); onCancel() }
        }} placeholder="Np. Zdrowie" />
    </label>
    <CategoryAppearancePicker icon={icon} color={color} disabled={saving} popover={popoverAppearance}
      onIconChange={setIcon} onColorChange={setColor} />
    <div className="category-creator-actions">
      <button type="button" onClick={() => void save()} disabled={saving}>
        {saving ? 'Tworzenie…' : 'Utwórz kategorię'}
      </button>
      <button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>Anuluj</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>
}
