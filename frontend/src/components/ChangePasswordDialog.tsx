import { useEffect, useRef, useState, type FormEvent } from 'react'
import { changePassword } from '../api/authApi'

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
    <circle cx="12" cy="12" r="2.5" />
    {!visible && <path d="m4 4 16 16" />}
  </svg>
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
}

export default function ChangePasswordDialog({ onClose, onSuccess }: {
  onClose: () => void
  onSuccess: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    if (newPassword !== confirmation) { setError('Nowe hasła muszą być takie same.'); return }
    if (new TextEncoder().encode(newPassword).length > 72) {
      setError('Nowe hasło jest za długie (maksimum 72 bajty UTF-8).'); return
    }
    setBusy(true)
    try {
      await changePassword(currentPassword, newPassword, confirmation)
      onSuccess()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się zmienić hasła.')
    } finally {
      setBusy(false)
    }
  }

  return <dialog className="password-dialog change-password-dialog" ref={dialog} aria-labelledby="password-dialog-title"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
    <button type="button" className="password-dialog-close" aria-label="Zamknij" title="Zamknij"
      disabled={busy} onClick={onClose}><CloseIcon /></button>
    <h2 id="password-dialog-title">Zmień hasło</h2>
    <p>Po zmianie hasła nastąpi wylogowanie ze wszystkich urządzeń.</p>
    <form className="login-form" onSubmit={submit} aria-busy={busy}>
      <label htmlFor="current-password">Obecne hasło</label>
      <div className="login-password-field">
        <input id="current-password" type={showCurrentPassword ? 'text' : 'password'} autoComplete="current-password" required
          value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} disabled={busy} />
        <button type="button" className="password-visibility-button" aria-pressed={showCurrentPassword}
          aria-label={showCurrentPassword ? 'Ukryj obecne hasło' : 'Pokaż obecne hasło'}
          title={showCurrentPassword ? 'Ukryj obecne hasło' : 'Pokaż obecne hasło'} disabled={busy}
          onClick={() => setShowCurrentPassword(value => !value)}>
          <PasswordVisibilityIcon visible={showCurrentPassword} />
        </button>
      </div>
      <label htmlFor="new-password">Nowe hasło</label>
      <div className="login-password-field">
        <input id="new-password" type={showNewPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8}
          value={newPassword} onChange={event => setNewPassword(event.target.value)} disabled={busy} />
        <button type="button" className="password-visibility-button" aria-pressed={showNewPassword}
          aria-label={showNewPassword ? 'Ukryj nowe hasło' : 'Pokaż nowe hasło'}
          title={showNewPassword ? 'Ukryj nowe hasło' : 'Pokaż nowe hasło'} disabled={busy}
          onClick={() => setShowNewPassword(value => !value)}>
          <PasswordVisibilityIcon visible={showNewPassword} />
        </button>
      </div>
      <small>Minimum 8 znaków.</small>
      <label htmlFor="confirm-password">Powtórz nowe hasło</label>
      <div className="login-password-field">
        <input id="confirm-password" type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" required
          value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} />
        <button type="button" className="password-visibility-button" aria-pressed={showConfirmation}
          aria-label={showConfirmation ? 'Ukryj powtórzone hasło' : 'Pokaż powtórzone hasło'}
          title={showConfirmation ? 'Ukryj powtórzone hasło' : 'Pokaż powtórzone hasło'} disabled={busy}
          onClick={() => setShowConfirmation(value => !value)}>
          <PasswordVisibilityIcon visible={showConfirmation} />
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? 'Zapisywanie…' : 'Zmień hasło'}</button>
      <button type="button" className="password-dialog-cancel" disabled={busy} onClick={onClose}>Anuluj</button>
    </form>
  </dialog>
}
