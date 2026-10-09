import { useEffect, useRef, useState, type FormEvent } from 'react'
import { apiFetch } from '../api/apiFetch'
import { canDeleteAccount, currentPasswordError, loginConfirmationError } from '../deleteAccountValidation'

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

export default function DeleteAccountDialog({ login, onClose, onSuccess }: {
  login: string; onClose: () => void; onSuccess: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmationError, setConfirmationError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const opener = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const element = dialog.current
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element?.showModal()
    return () => {
      element?.close()
      const previousFocus = opener.current
      if (previousFocus?.isConnected) requestAnimationFrame(() => previousFocus.focus())
    }
  }, [])
  const ready = canDeleteAccount(login, confirmation, password, accepted)

  function close() {
    if (busy) return
    setPassword('')
    setConfirmation('')
    setAccepted(false)
    setError('')
    setConfirmationError('')
    setPasswordError('')
    setShowPassword(false)
    onClose()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const nextConfirmationError = loginConfirmationError(login, confirmation)
    const nextPasswordError = currentPasswordError(password)
    setConfirmationError(nextConfirmationError)
    setPasswordError(nextPasswordError)
    if (!ready) return
    setBusy(true)
    setError('')
    try {
      const response = await apiFetch('/api/users/me', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, loginConfirmation: confirmation, irreversibleConfirmation: accepted }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { message?: string }
        throw new Error(result.message ?? 'Nie udało się usunąć konta. Sprawdź połączenie i spróbuj ponownie.')
      }
      onSuccess()
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'Nie udało się usunąć konta.'
      const normalized = message.toLocaleLowerCase('pl')
      if (normalized.includes('hasło')) setPasswordError(message)
      else if (normalized.includes('login')) setConfirmationError(message)
      else setError(message)
    } finally { setBusy(false) }
  }
  return <dialog className="password-dialog delete-account-dialog" ref={dialog} aria-labelledby="delete-account-title"
    aria-describedby="delete-account-warning"
    onCancel={event => { event.preventDefault(); close() }}>
    <button type="button" className="password-dialog-close" aria-label="Zamknij" title="Zamknij"
      disabled={busy} onClick={close}><CloseIcon /></button>
    <h2 id="delete-account-title">Usuń konto</h2>
    <div id="delete-account-warning" className="delete-account-warning" role="note">
      <p><strong>Usunięcie konta jest nieodwracalne.</strong></p>
      <p>Utracisz wszystkie swoje zadania, nawyki, nagrody, punkty, historię zakupów, dane logowania oraz adres e-mail.</p>
      <p>Po usunięciu konta nastąpi wylogowanie ze wszystkich urządzeń.</p>
    </div>
    <form className="login-form" onSubmit={submit} aria-busy={busy}>
      <label htmlFor="delete-login">Potwierdź login</label>
      <input id="delete-login" required autoComplete="off" autoCapitalize="none" spellCheck={false}
        maxLength={64} value={confirmation} aria-invalid={Boolean(confirmationError)}
        aria-describedby={confirmationError ? 'delete-login-error' : 'delete-login-help'}
        onChange={event => {
          const value = event.target.value
          setConfirmation(value)
          if (confirmationError) setConfirmationError(loginConfirmationError(login, value))
        }}
        onBlur={() => setConfirmationError(loginConfirmationError(login, confirmation))} disabled={busy} />
      {confirmationError
        ? <p id="delete-login-error" className="field-error" role="alert">{confirmationError}</p>
        : <small id="delete-login-help">Wpisz <strong>{login}</strong>, aby kontynuować.</small>}
      <label htmlFor="delete-password">Obecne hasło</label>
      <div className="login-password-field">
        <input id="delete-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required
          value={password} aria-invalid={Boolean(passwordError)} aria-describedby={passwordError ? 'delete-password-error' : undefined}
          onChange={event => {
            const value = event.target.value
            setPassword(value)
            if (passwordError) setPasswordError(currentPasswordError(value))
          }}
          onBlur={() => setPasswordError(currentPasswordError(password))} disabled={busy} />
        <button type="button" className="password-visibility-button" aria-pressed={showPassword}
          aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'} title={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
          disabled={busy} onClick={() => setShowPassword(value => !value)}>
          <PasswordVisibilityIcon visible={showPassword} />
        </button>
      </div>
      {passwordError && <p id="delete-password-error" className="field-error" role="alert">{passwordError}</p>}
      <label className="delete-account-confirmation">
        <input type="checkbox" required checked={accepted} onChange={event => setAccepted(event.target.checked)} disabled={busy} />
        <span>Rozumiem, że trwale usunę konto i jego dane.</span>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="delete-account-actions">
        <button type="button" className="secondary-button" disabled={busy} onClick={close}>Anuluj</button>
        <button type="submit" className="delete-account-button" disabled={!ready || busy}>
          {busy ? 'Usuwanie…' : 'Usuń konto bezpowrotnie'}</button>
      </div>
    </form>
  </dialog>
}
