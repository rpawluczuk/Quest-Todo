import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createCategory, deleteCategory, getCategories, updateCategory } from '../api/categoryApi'
import { notifyCategoriesChanged, type CategoryMutation } from '../categoryEvents'
import type { Category, CategoryColor, CategoryIcon as CategoryIconName } from '../types/Category'
import CategoryAppearancePicker from './CategoryAppearancePicker'
import CategoryIcon from './CategoryIcon'

function sortCategories(categories: Category[]) {
  return [...categories].sort((left, right) => left.name.localeCompare(right.name, 'pl', { sensitivity: 'base' }))
}

export default function CategoryManagementDialog({ onClose, onChanged }: {
  readonly onClose: () => void
  readonly onChanged: (change: CategoryMutation) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<CategoryIconName>('OTHER')
  const [color, setColor] = useState<CategoryColor>('PURPLE')
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function load(signal?: AbortSignal) {
    setLoading(true)
    setLoadError('')
    getCategories(signal).then(result => {
      if (!signal?.aborted) setCategories(sortCategories(result))
    }).catch(() => {
      if (!signal?.aborted) setLoadError('Nie udało się pobrać kategorii.')
    }).finally(() => {
      if (!signal?.aborted) setLoading(false)
    })
  }

  useEffect(() => {
    const element = dialog.current
    const controller = new AbortController()
    element?.showModal()
    // Loading is the external synchronization performed when the modal opens.
    // oxlint-disable-next-line react/set-state-in-effect
    load(controller.signal)
    return () => { controller.abort(); element?.close() }
  }, [])

  useEffect(() => {
    if (editorOpen) nameInput.current?.focus()
  }, [editorOpen, editingId])

  function closeEditor() {
    setEditorOpen(false)
    setEditingId(null)
    setName('')
    setIcon('OTHER')
    setColor('PURPLE')
    setError('')
  }

  function startCreate() {
    setEditingId(null)
    setName('')
    setIcon('OTHER')
    setColor('PURPLE')
    setError('')
    setEditorOpen(true)
  }

  function startEdit(category: Category) {
    setEditingId(category.id)
    setName(category.name)
    setIcon(category.icon)
    setColor(category.color)
    setError('')
    setEditorOpen(true)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) {
      setError('Podaj nazwę kategorii.')
      nameInput.current?.focus()
      return
    }
    setBusy(true)
    setError('')
    try {
      const saved = editingId === null
        ? await createCategory(cleanName, icon, color)
        : await updateCategory(editingId, cleanName, icon, color)
      setCategories(current => sortCategories([...current.filter(category => category.id !== saved.id), saved]))
      onChanged({ type: 'upsert', category: saved })
      notifyCategoriesChanged()
      closeEditor()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się zapisać kategorii.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!pendingDelete) return
    setBusy(true)
    setError('')
    try {
      await deleteCategory(pendingDelete.id)
      setCategories(current => current.filter(category => category.id !== pendingDelete.id))
      onChanged({ type: 'delete', id: pendingDelete.id })
      notifyCategoriesChanged()
      if (editingId === pendingDelete.id) closeEditor()
      setPendingDelete(null)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się usunąć kategorii.')
    } finally {
      setBusy(false)
    }
  }

  function close() {
    if (!busy) onClose()
  }

  return <dialog ref={dialog} className="password-dialog change-password-dialog category-management-dialog"
    aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close() }}>
    <button type="button" className="password-dialog-close" aria-label="Zamknij" disabled={busy} onClick={close}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="m6 6 12 12M18 6 6 18" />
      </svg>
    </button>
    <h2 id={titleId}>Kategorie</h2>
    <p className="category-management-intro">Twórz oznaczenia, które pomagają szybko rozpoznawać zadania i nawyki.</p>

    {!editorOpen && <button type="button" className="category-management-add" disabled={busy || loading}
      onClick={startCreate}>+ Dodaj kategorię</button>}

    {editorOpen && <form className="task-form category-management-form" onSubmit={event => void save(event)}>
      <label className="form-field category-name-field">
        <span>Nazwa kategorii</span>
        <input ref={nameInput} value={name} maxLength={60} disabled={busy}
          onChange={event => setName(event.target.value)} placeholder="Np. Zdrowie" />
      </label>
      <CategoryAppearancePicker icon={icon} color={color} disabled={busy}
        onIconChange={setIcon} onColorChange={setColor} />
      <div className="category-creator-actions">
        <button type="submit" disabled={busy}>{busy ? 'Zapisywanie…' : editingId === null ? 'Utwórz kategorię' : 'Zapisz zmiany'}</button>
        <button type="button" className="secondary-button" disabled={busy} onClick={closeEditor}>Anuluj</button>
      </div>
      {error && !pendingDelete && <p className="form-error" role="alert">{error}</p>}
    </form>}

    {loading && <p role="status">Ładowanie kategorii…</p>}
    {!loading && loadError && <div className="category-management-load-error">
      <p className="form-error" role="alert">{loadError}</p>
      <button type="button" className="secondary-button" onClick={() => load()}>Spróbuj ponownie</button>
    </div>}
    {!loading && !loadError && categories.length === 0 && !editorOpen &&
      <p className="category-management-empty">Nie masz jeszcze kategorii. Dodaj pierwszą, aby uporządkować zadania i nawyki.</p>}
    {!loading && !loadError && categories.length > 0 && <ul className="category-management-list">
      {categories.map(category => <li key={category.id} className="category-management-item">
        <CategoryIcon icon={category.icon} color={category.color} />
        <span className="category-management-name">{category.name}</span>
        <button type="button" className="category-management-item-action" disabled={busy}
          aria-label={`Edytuj kategorię ${category.name}`} onClick={() => startEdit(category)}>Edytuj</button>
        <button type="button" className="category-management-item-action category-management-delete" disabled={busy}
          aria-label={`Usuń kategorię ${category.name}`} onClick={() => { setError(''); setPendingDelete(category) }}>Usuń</button>
      </li>)}
    </ul>}

    {pendingDelete && <div className="category-delete-confirmation" role="alertdialog" aria-modal="true"
      aria-labelledby="category-delete-title" aria-describedby="category-delete-description">
      <h3 id="category-delete-title">Usunąć kategorię „{pendingDelete.name}”?</h3>
      <p id="category-delete-description">Zadania i nawyki pozostaną, ale stracą przypisanie do tej kategorii.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="category-delete-actions">
        <button type="button" className="secondary-button" disabled={busy} onClick={() => { setPendingDelete(null); setError('') }}>Anuluj</button>
        <button type="button" className="category-delete-button" disabled={busy} onClick={() => void remove()}>
          {busy ? 'Usuwanie…' : 'Usuń kategorię'}
        </button>
      </div>
    </div>}
  </dialog>
}
