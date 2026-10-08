import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getEmail, saveEmail, type EmailStatus } from '../api/emailApi'

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
    <circle cx="12" cy="12" r="2.5" />
    {!visible && <path d="m4 4 16 16" />}
  </svg>
}

function EnvelopeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </svg>
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
}

function ClockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
}

function EditIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
}

function BackIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
}

export default function EmailDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [status, setStatus] = useState<EmailStatus | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [editingAddress, setEditingAddress] = useState(false)
  const [confirmingResend, setConfirmingResend] = useState(false)

  useEffect(() => {
    const element = dialog.current
    const controller = new AbortController()
    element?.showModal()
    getEmail(controller.signal).then(value => {
      if (!controller.signal.aborted) {
        setStatus(value)
        setEmail(value.pendingEmail ?? '')
      }
    }).catch(() => {
      if (!controller.signal.aborted) setError('Nie udało się pobrać adresu. Zamknij i otwórz formularz ponownie.')
    })
    return () => { controller.abort(); element?.close() }
  }, [])

  async function send(resend: boolean) {
    if (busy) return
    if (!password) { setError('Podaj obecne hasło.'); return }
    setBusy(true)
    setError('')
    try {
      await saveEmail(email, password, resend)
      setPassword('')
      setShowPassword(false)
      setSent(true)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się wysłać wiadomości.')
    } finally { setBusy(false) }
  }

  function submit(event: FormEvent) { event.preventDefault(); void send(false) }
  const hasVerifiedEmail = Boolean(status?.verifiedEmail)
  const hasPendingEmail = Boolean(status?.pendingEmail)
  const showPending = status && hasPendingEmail && !editingAddress && !sent

  return <dialog ref={dialog} className="password-dialog email-dialog" aria-labelledby="email-title"
    onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <button type="button" className="email-dialog-close" aria-label="Zamknij" title="Zamknij"
      disabled={busy} onClick={onClose}><CloseIcon /></button>

    {sent ? <div className="email-sent" role="status">
      <div className="email-sent-heading">
        <span className="email-sent-icon"><EnvelopeIcon /></span>
        <h2 id="email-title">Sprawdź pocztę</h2>
      </div>
      <p>Wysłaliśmy link potwierdzający na podany adres. Adres zostanie aktywowany po jego potwierdzeniu.</p>
    </div> : showPending ? <>
      <h2 id="email-title">Adres e-mail</h2>
      <div className="email-address-status email-address-pending email-pending-summary">
        <div className="email-pending-label"><ClockIcon /><span>Oczekuje na potwierdzenie</span></div>
        <strong>{status.pendingEmail}</strong>
        {status.expiresAt && <small>Link ważny do {new Date(status.expiresAt).toLocaleString('pl-PL', {
          day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })}.</small>}
      </div>
      <p className="email-dialog-description">Sprawdź skrzynkę pocztową i kliknij link, aby potwierdzić adres.</p>

      {confirmingResend ? <form className="login-form email-dialog-form email-resend-form"
        onSubmit={event => { event.preventDefault(); void send(true) }} aria-busy={busy}>
        <label htmlFor="resend-email-password">Obecne hasło</label>
        <div className="login-password-field">
          <input id="resend-email-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
            autoFocus required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
          <button type="button" className="password-visibility-button" aria-pressed={showPassword}
            aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'} title={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
            disabled={busy} onClick={() => setShowPassword(value => !value)}>
            <PasswordVisibilityIcon visible={showPassword} />
          </button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Wysyłanie…' : 'Potwierdź i wyślij link'}</button>
      </form> : <button type="button" className="email-pending-primary" disabled={busy} onClick={() => {
        setError('')
        setConfirmingResend(true)
      }}>Wyślij link ponownie</button>}

      {confirmingResend && <button type="button" className="email-resend-back-link" disabled={busy} onClick={() => {
        setConfirmingResend(false)
        setPassword('')
        setShowPassword(false)
        setError('')
      }}><BackIcon /><span>Wstecz</span></button>}

      {!confirmingResend && <button type="button" className="email-use-another-link" disabled={busy} onClick={() => {
        setEditingAddress(true)
        setConfirmingResend(false)
        setEmail('')
        setPassword('')
        setShowPassword(false)
        setError('')
      }}><EditIcon /><span>Użyj innego adresu</span></button>}
    </> : <>
      <h2 id="email-title">{status ? hasVerifiedEmail ? 'Zmień adres e-mail' : 'Dodaj adres e-mail' : 'Adres e-mail'}</h2>
      {!status && !error && <p role="status">Ładowanie…</p>}
      {status && <>
        {hasVerifiedEmail ? <>
          <div className="email-address-status">
            <span>Potwierdzony adres</span>
            <strong>{status.verifiedEmail}</strong>
          </div>
          <p className="email-dialog-description">Podaj nowy adres e-mail. Dotychczasowy pozostanie aktywny do czasu potwierdzenia nowego.</p>
        </> : <p className="email-dialog-description">Dodaj adres e-mail, aby móc odzyskać hasło. Wyślemy Ci link do jego potwierdzenia.</p>}

        <form className="login-form email-dialog-form" onSubmit={submit} aria-busy={busy}>
          <label htmlFor="account-email">{hasVerifiedEmail ? 'Nowy adres e-mail' : 'Adres e-mail'}</label>
          <input id="account-email" type="email" autoComplete="email" required maxLength={254}
            value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
          <label htmlFor="email-password">Obecne hasło</label>
          <div className="login-password-field">
            <input id="email-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required
              value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
            <button type="button" className="password-visibility-button" aria-pressed={showPassword}
              aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'} title={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
              disabled={busy} onClick={() => setShowPassword(value => !value)}>
              <PasswordVisibilityIcon visible={showPassword} />
            </button>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? 'Wysyłanie…' : 'Wyślij link potwierdzający'}</button>
        </form>
      </>}
      {error && !status && <p className="form-error" role="alert">{error}</p>}
    </>}

    <button type="button" className="email-cancel-link" disabled={busy} onClick={onClose}>
      {sent || showPending ? 'Zamknij' : 'Anuluj'}
    </button>
  </dialog>
}
