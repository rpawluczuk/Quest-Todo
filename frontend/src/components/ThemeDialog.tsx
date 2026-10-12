import { useEffect, useId, useRef, useState } from 'react'
import type { Theme } from '../theme'

export default function ThemeDialog({ theme, onChange, onClose }: {
  theme: Theme
  onChange: (theme: Theme) => Promise<void>
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const saving = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const titleId = useId()

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  async function selectTheme(selected: Theme) {
    if (saving.current || selected === theme) return
    saving.current = true
    setBusy(true)
    setError('')
    try { await onChange(selected) }
    catch { setError('Nie udało się zapisać koloru. Przywrócono poprzedni. Spróbuj ponownie.') }
    finally { saving.current = false; setBusy(false) }
  }

  return <dialog ref={dialog} className="password-dialog change-password-dialog theme-dialog"
    aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!saving.current) onClose() }}>
    <button type="button" className="password-dialog-close" aria-label="Zamknij" disabled={busy} onClick={onClose}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="m6 6 12 12M18 6 6 18" />
      </svg>
    </button>
    <h2 id={titleId}>Kolor aplikacji</h2>
    <p>Wybierz kolor akcentów aplikacji.</p>
    <div className="theme-choices" role="group" aria-label="Wybierz kolor" aria-busy={busy}>
      {(['purple', 'pink'] as const).map(color => <button key={color} type="button"
        className={`theme-choice theme-choice-${color}`} aria-pressed={theme === color}
        disabled={busy} onClick={() => void selectTheme(color)}>
        <span className="theme-swatch" aria-hidden="true">
          {theme === color && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m6 12 4 4 8-8" />
          </svg>}
        </span>
        <span>{color === 'purple' ? 'Fioletowy' : 'Różowy'}</span>
      </button>)}
    </div>
    <p className="theme-save-status" role="status">{busy ? 'Zapisywanie…' : 'Wybór zapisuje się na Twoim koncie.'}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button type="button" className="email-confirmation-back" disabled={busy} onClick={onClose}>Zamknij</button>
  </dialog>
}
