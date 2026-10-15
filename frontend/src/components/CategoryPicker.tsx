import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createCategory, getCategories } from '../api/categoryApi'
import type { Category, CategoryColor, CategoryIcon as CategoryIconName } from '../types/Category'
import CategoryIcon from './CategoryIcon'

const iconOptions: readonly [CategoryIconName, string][] = [
  ['HEART', 'Serce'], ['BRIEFCASE', 'Praca'], ['HOME', 'Dom'], ['BOOK', 'Książka'],
  ['DUMBBELL', 'Aktywność'], ['RUNNING', 'Bieganie'], ['UTENSILS', 'Jedzenie'],
  ['WALLET', 'Finanse'], ['PEOPLE', 'Relacje'], ['STAR', 'Gwiazda'], ['LEAF', 'Natura'],
  ['PLANE', 'Podróże'], ['MUSIC', 'Muzyka'], ['PALETTE', 'Twórczość'],
  ['CODE', 'Programowanie'], ['MOON', 'Sen'], ['SUN', 'Słońce'], ['CAR', 'Samochód'],
  ['SHOPPING_CART', 'Zakupy'], ['OTHER', 'Inne'],
]

const colorOptions: readonly [CategoryColor, string][] = [
  ['RED', 'Czerwony'], ['ORANGE', 'Pomarańczowy'], ['AMBER', 'Bursztynowy'],
  ['YELLOW', 'Żółty'], ['LIME', 'Limonkowy'], ['GREEN', 'Zielony'],
  ['EMERALD', 'Szmaragdowy'], ['TEAL', 'Morski'], ['CYAN', 'Cyjan'], ['SKY', 'Błękitny'],
  ['BLUE', 'Niebieski'], ['INDIGO', 'Indygo'], ['PURPLE', 'Fioletowy'],
  ['VIOLET', 'Purpurowy'], ['FUCHSIA', 'Fuksja'], ['PINK', 'Różowy'], ['ROSE', 'Różany'],
  ['BROWN', 'Brązowy'], ['SLATE', 'Grafitowy'], ['GRAY', 'Szary'],
]

export default function CategoryPicker({ selectedId, onChange, disabled }: {
  readonly selectedId: number | null
  readonly onChange: (id: number | null) => void
  readonly disabled: boolean
}) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<CategoryIconName>('OTHER')
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [color, setColor] = useState<CategoryColor>('PURPLE')
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState('')
  const nameInput = useRef<HTMLInputElement>(null)
  const appearancePickers = useRef<HTMLDivElement>(null)
  const iconTrigger = useRef<HTMLButtonElement>(null)
  const colorTrigger = useRef<HTMLButtonElement>(null)
  const selectId = useId()
  const iconGridId = useId()
  const colorGridId = useId()

  useEffect(() => {
    const controller = new AbortController()
    getCategories(controller.signal).then(result => {
      if (!controller.signal.aborted) setCategories(result)
    }).catch(() => {
      if (!controller.signal.aborted) setLoadError('Nie udało się pobrać kategorii.')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [retry])

  useEffect(() => {
    if (creating) nameInput.current?.focus()
  }, [creating])

  useEffect(() => {
    if (!iconPickerOpen && !colorPickerOpen) return
    function closeOnOutsideClick(event: PointerEvent) {
      if (!appearancePickers.current?.contains(event.target as Node)) {
        setIconPickerOpen(false)
        setColorPickerOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [iconPickerOpen, colorPickerOpen])

  const selected = useMemo(
    () => categories.find(category => category.id === selectedId) ?? null,
    [categories, selectedId],
  )

  function closeCreator() {
    setCreating(false)
    setIconPickerOpen(false)
    setColorPickerOpen(false)
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
      <button type="button" className="secondary-button" onClick={() => {
        setLoading(true)
        setLoadError('')
        setRetry(value => value + 1)
      }}>Spróbuj ponownie</button>
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
        <div className="category-creator-options" ref={appearancePickers}>
          <div className="form-field category-icon-field">
            <span>Symbol</span>
            <button ref={iconTrigger} type="button" className="category-icon-trigger"
              disabled={saving} aria-expanded={iconPickerOpen} aria-controls={iconGridId}
              aria-label={`Wybierz symbol. Wybrano: ${iconOptions.find(([value]) => value === icon)?.[1] ?? 'Inne'}`}
              onClick={() => {
                setColorPickerOpen(false)
                setIconPickerOpen(open => !open)
              }}
              onKeyDown={event => {
                if (event.key === 'Escape' && iconPickerOpen) {
                  event.preventDefault()
                  setIconPickerOpen(false)
                }
              }}>
              <CategoryIcon icon={icon} color={color} />
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
            </button>
          </div>
          <div className="form-field category-color-field">
            <span>Kolor</span>
            <button ref={colorTrigger} type="button" className="category-color-trigger"
              disabled={saving} aria-expanded={colorPickerOpen} aria-controls={colorGridId}
              aria-label={`Wybierz kolor. Wybrano: ${colorOptions.find(([value]) => value === color)?.[1] ?? 'Fioletowy'}`}
              onClick={() => {
                setIconPickerOpen(false)
                setColorPickerOpen(open => !open)
              }}
              onKeyDown={event => {
                if (event.key === 'Escape' && colorPickerOpen) {
                  event.preventDefault()
                  setColorPickerOpen(false)
                }
              }}>
              <span className={`category-color-swatch category-color-swatch-${color.toLowerCase()}`} aria-hidden="true" />
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
            </button>
          </div>
          {iconPickerOpen && <div id={iconGridId} className="category-icon-grid"
            role="group" aria-label="Dostępne symbole"
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault()
                setIconPickerOpen(false)
                iconTrigger.current?.focus()
              }
            }}>
            {iconOptions.map(([value, label]) => <button key={value} type="button"
              className={`category-icon-option${icon === value ? ' selected' : ''}`}
              aria-label={label} aria-pressed={icon === value} title={label}
              onClick={() => {
                setIcon(value)
                setIconPickerOpen(false)
                iconTrigger.current?.focus()
              }}>
              <CategoryIcon icon={value} color={color} />
            </button>)}
          </div>}
          {colorPickerOpen && <div id={colorGridId} className="category-color-grid"
              role="group" aria-label="Dostępne kolory"
              onKeyDown={event => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setColorPickerOpen(false)
                  colorTrigger.current?.focus()
                }
              }}>
              {colorOptions.map(([value, label]) => <button key={value} type="button"
                className={`category-color-option${color === value ? ' selected' : ''}`}
                aria-label={label} aria-pressed={color === value} title={label}
                onClick={() => {
                  setColor(value)
                  setColorPickerOpen(false)
                  colorTrigger.current?.focus()
                }}>
                <span className={`category-color-swatch category-color-swatch-${value.toLowerCase()}`} aria-hidden="true" />
              </button>)}
            </div>}
        </div>
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
