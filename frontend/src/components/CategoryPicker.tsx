import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import * as Select from '@radix-ui/react-select'
import { createCategory, getCategories } from '../api/categoryApi'
import { categoriesChangedEvent, notifyCategoriesChanged } from '../categoryEvents'
import type { Category, CategoryColor, CategoryIcon as CategoryIconName } from '../types/Category'
import CategoryAppearancePicker from './CategoryAppearancePicker'
import CategoryIcon from './CategoryIcon'

const noCategoryValue = 'none'
const createCategoryValue = 'create'

export default function CategoryPicker({ selectedId, onChange, disabled, integratedCreateAction = false,
  showOptionalLabel = true }: {
  readonly selectedId: number | null
  readonly onChange: (id: number | null) => void
  readonly disabled: boolean
  readonly integratedCreateAction?: boolean
  readonly showOptionalLabel?: boolean
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
  const dropdownTrigger = useRef<HTMLButtonElement>(null)
  const creatorDialog = useRef<HTMLDialogElement>(null)
  const focusCreatorAfterClose = useRef(false)
  const selectId = useId()
  const creatorTitleId = useId()

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
    if (!creating) return
    const element = creatorDialog.current
    element?.showModal()
    requestAnimationFrame(() => nameInput.current?.focus())
    return () => element?.close()
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
    requestAnimationFrame(() => dropdownTrigger.current?.focus())
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

  return <><fieldset className="category-form-picker" disabled={disabled}>
    <legend>Kategoria{showOptionalLabel && <> <span>(opcjonalnie)</span></>}</legend>
    {loading && <p className="category-form-status" role="status">Ładowanie kategorii…</p>}
    {!loading && loadError && <div className="category-form-error">
      <p className="form-error" role="alert">{loadError}</p>
      <button type="button" className="secondary-button" onClick={() => loadCategories()}>Spróbuj ponownie</button>
    </div>}
    {!loading && !loadError && <>
      <div className={`category-form-selection${integratedCreateAction ? ' category-form-selection-integrated' : ''}`}>
        {integratedCreateAction ? <Select.Root
          value={selectedId === null ? noCategoryValue : String(selectedId)}
          disabled={disabled || saving}
          onValueChange={value => {
            if (value === createCategoryValue) {
              focusCreatorAfterClose.current = true
              setCreating(true)
            }
            else onChange(value === noCategoryValue ? null : Number(value))
          }}
        >
          <Select.Trigger ref={dropdownTrigger} id={selectId} className="category-select-trigger"
            aria-label="Wybierz kategorię">
            <span className="category-select-trigger-value">
              {selected && <CategoryIcon icon={selected.icon} color={selected.color} />}
              <Select.Value>{selected?.name ?? 'Bez kategorii'}</Select.Value>
            </span>
            <Select.Icon className="category-select-chevron">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content className="category-select-content" position="popper" sideOffset={4} collisionPadding={12}
              onCloseAutoFocus={event => {
                if (!focusCreatorAfterClose.current) return
                event.preventDefault()
                focusCreatorAfterClose.current = false
                requestAnimationFrame(() => nameInput.current?.focus())
              }}>
              <Select.Viewport className="category-select-viewport">
                <Select.Item className="category-select-item" value={noCategoryValue}>
                  <span className="category-select-item-icon-placeholder" aria-hidden="true" />
                  <Select.ItemText>Bez kategorii</Select.ItemText>
                  <Select.ItemIndicator className="category-select-indicator" aria-hidden="true">
                    <svg viewBox="0 0 20 20"><path d="m4.5 10 3.5 3.5 7.5-8" /></svg>
                  </Select.ItemIndicator>
                </Select.Item>
                {categories.map(category => <Select.Item className="category-select-item" key={category.id}
                  value={String(category.id)}>
                  <CategoryIcon icon={category.icon} color={category.color} />
                  <Select.ItemText>{category.name}</Select.ItemText>
                  <Select.ItemIndicator className="category-select-indicator" aria-hidden="true">
                    <svg viewBox="0 0 20 20"><path d="m4.5 10 3.5 3.5 7.5-8" /></svg>
                  </Select.ItemIndicator>
                </Select.Item>)}
                <Select.Separator className="category-select-separator" />
                <Select.Item className="category-select-item category-select-create" value={createCategoryValue}>
                  <svg className="category-select-create-icon" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M10 4v12M4 10h12" />
                  </svg>
                  <Select.ItemText>Utwórz nową kategorię</Select.ItemText>
                </Select.Item>
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root> : <>
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
        </>}
      </div>
      {creating && !integratedCreateAction && <div className="category-creator">
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
  {creating && integratedCreateAction && <dialog ref={creatorDialog}
    className="password-dialog change-password-dialog category-create-dialog"
    aria-labelledby={creatorTitleId}
    onCancel={event => { event.preventDefault(); if (!saving) closeCreator() }}>
    <button type="button" className="password-dialog-close" aria-label="Zamknij" title="Zamknij"
      disabled={saving} onClick={closeCreator}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="m6 6 12 12M18 6 6 18" />
      </svg>
    </button>
    <h2 id={creatorTitleId}>Nowa kategoria</h2>
    <div className="task-form category-creator category-create-dialog-form">
      <label className="form-field category-name-field">
        <span>Nazwa kategorii</span>
        <input ref={nameInput} value={name} maxLength={60} disabled={saving}
          onChange={event => setName(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') { event.preventDefault(); void saveCategory() }
          }} placeholder="Np. Zdrowie" />
      </label>
      <CategoryAppearancePicker icon={icon} color={color} disabled={saving} popover
        onIconChange={setIcon} onColorChange={setColor} />
      <div className="category-creator-actions">
        <button type="button" onClick={() => void saveCategory()} disabled={saving}>
          {saving ? 'Tworzenie…' : 'Utwórz kategorię'}
        </button>
        <button type="button" className="secondary-button" onClick={closeCreator} disabled={saving}>Anuluj</button>
      </div>
      {createError && <p className="form-error" role="alert">{createError}</p>}
    </div>
  </dialog>}
  </>
}
