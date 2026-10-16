import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createCategory, getCategories } from '../api/categoryApi'
import { categoriesChangedEvent, notifyCategoriesChanged } from '../categoryEvents'
import type { Category, CategoryColor, CategoryIcon as CategoryIconName } from '../types/Category'
import CategoryAppearancePicker from './CategoryAppearancePicker'
import CategoryIcon from './CategoryIcon'

export default function CategoryPicker({ selectedId, onChange, disabled }: {
  readonly selectedId: number | null
  readonly onChange: (id: number | null) => void
  readonly disabled: boolean
}) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<CategoryIconName>('OTHER')
  const [color, setColor] = useState<CategoryColor>('PURPLE')
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState('')
  const nameInput = useRef<HTMLInputElement>(null)
  const selectId = useId()

  const loadCategories = useCallback((signal?: AbortSignal) => {
    setLoading(true)
    setLoadError('')
    getCategories(signal).then(result => {
      if (!signal?.aborted) setCategories(result)
    }).catch(() => {
      if (!signal?.aborted) setLoadError('Nie udało się pobrać kategorii.')
    }).finally(() => {
      if (!signal?.aborted) setLoading(false)
    })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    // Loading is the external synchronization performed when the picker mounts.
    // oxlint-disable-next-line react/set-state-in-effect
    loadCategories(controller.signal)
    return () => controller.abort()
  }, [loadCategories])

  useEffect(() => {
    function refresh() { loadCategories() }
    window.addEventListener(categoriesChangedEvent, refresh)
    return () => window.removeEventListener(categoriesChangedEvent, refresh)
  }, [loadCategories])

  useEffect(() => {
    if (creating) nameInput.current?.focus()
  }, [creating])

  const selected = useMemo(
    () => categories.find(category => category.id === selectedId) ?? null,
    [categories, selectedId],
  )

  function closeCreator() {
    setCreating(false)
    setName('')
    setIcon('OTHER')
    setColor('PURPLE')
    setCreateError('')
  }

  async function saveCategory() {
    const cleanName = name.trim()
    if (!cleanName) {
      setCreateError('Podaj nazwę kategorii.')
      nameInput.current?.focus()
      return
    }
    setSaving(true)
    setCreateError('')
    try {
      const created = await createCategory(cleanName, icon, color)
      setCategories(current => [...current, created].sort((left, right) =>
        left.name.localeCompare(right.name, 'pl', { sensitivity: 'base' })))
      onChange(created.id)
      closeCreator()
      notifyCategoriesChanged()
    } catch (failure) {
      setCreateError(failure instanceof Error ? failure.message : 'Nie udało się utworzyć kategorii.')
    } finally {
      setSaving(false)
    }
  }

  return <fieldset className="category-form-picker" disabled={disabled}>
    <legend>Kategoria <span>(opcjonalnie)</span></legend>
    {loading && <p className="category-form-status" role="status">Ładowanie kategorii…</p>}
    {!loading && loadError && <div className="category-form-error">
      <p className="form-error" role="alert">{loadError}</p>
      <button type="button" className="secondary-button" onClick={() => loadCategories()}>Spróbuj ponownie</button>
    </div>}
    {!loading && !loadError && <>
      <div className="category-form-selection">
        {selected && <CategoryIcon icon={selected.icon} color={selected.color} />}
        <label className="form-field" htmlFor={selectId}>
          <span className="visually-hidden">Wybierz kategorię</span>
          <select id={selectId} value={selectedId ?? ''} disabled={disabled || saving}
            onChange={event => onChange(event.target.value ? Number(event.target.value) : null)}>
            <option value="">Bez kategorii</option>
            {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        {!creating && <button type="button" className="category-create-toggle secondary-button"
          onClick={() => setCreating(true)}>+ Nowa kategoria</button>}
      </div>
      {creating && <div className="category-creator">
        <label className="form-field category-name-field">
          <span>Nazwa kategorii</span>
          <input ref={nameInput} value={name} maxLength={60} disabled={saving}
            onChange={event => setName(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') { event.preventDefault(); void saveCategory() }
              if (event.key === 'Escape') { event.preventDefault(); closeCreator() }
            }} placeholder="Np. Zdrowie" />
        </label>
        <CategoryAppearancePicker icon={icon} color={color} disabled={saving}
          onIconChange={setIcon} onColorChange={setColor} />
        <div className="category-creator-actions">
          <button type="button" onClick={() => void saveCategory()} disabled={saving}>
            {saving ? 'Tworzenie…' : 'Utwórz kategorię'}
          </button>
          <button type="button" className="secondary-button" onClick={closeCreator} disabled={saving}>Anuluj</button>
        </div>
        {createError && <p className="form-error" role="alert">{createError}</p>}
      </div>}
    </>}
  </fieldset>
}
