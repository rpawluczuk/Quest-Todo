import { useEffect, useRef, useState, type FormEvent } from 'react'
import { apiFetch } from '../api/apiFetch'

function EnvelopeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </svg>
}

function BackIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
}

function RetryIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 11a8 8 0 1 0-2.3 5.7" />
    <path d="M20 4v7h-7" />
  </svg>
}

export default function PasswordRecoveryPage({ token, onBack }: { token?: string; onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const emailInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (token !== undefined) window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [token])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (token === undefined) {
      const validationError = !email.trim()
        ? 'Podaj adres e-mail.'
        : emailInput.current && !emailInput.current.validity.valid
          ? 'Podaj poprawny adres e-mail.'
          : ''
      setEmailError(validationError)
      if (validationError) return
    }
    setBusy(true)
    setError('')
    try {
      if (token !== undefined && password !== confirmation) throw new Error('Hasła muszą być takie same.')
      if (token !== undefined && new TextEncoder().encode(password).length > 72) throw new Error('Hasło może mieć maksymalnie 72 bajty UTF-8.')
      const response = await apiFetch(token === undefined ? '/api/auth/password/forgot' : '/api/auth/password/reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(token === undefined ? { email } : { token, password, confirmation }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { message?: string }
        throw new Error(result.message ?? 'Nie udało się wykonać operacji. Odśwież stronę i spróbuj ponownie.')
      }
      if (token === undefined) {
        await response.json()
        setMessage('Jeśli podany adres jest przypisany do konta i został potwierdzony, otrzymasz wiadomość z linkiem do zresetowania hasła.')
      } else {
        setMessage('Hasło zostało zmienione. Zaloguj się nowym hasłem.')
      }
      setPassword('')
      setConfirmation('')
      setDone(true)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się połączyć z aplikacją.')
    } finally { setBusy(false) }
  }
  return <main className="login-page">
    <h1>Quest Todo</h1>
    {done && token === undefined
      ? <div className="recovery-success-heading">
          <span className="recovery-success-icon"><EnvelopeIcon /></span>
          <h2>Sprawdź pocztę</h2>
        </div>
      : <h2>{token === undefined ? 'Nie pamiętasz hasła?' : 'Ustaw nowe hasło'}</h2>}
    {done ? <p className="recovery-status" role="status">{message}</p> : <form className="login-form recovery-form"
      onSubmit={submit} aria-busy={busy} noValidate={token === undefined}>
      {token === undefined ? <>
        <p className="recovery-description">Podaj potwierdzony adres e-mail przypisany do konta. Wyślemy Ci link do zresetowania hasła.</p>
        <label htmlFor="recovery-email">Adres e-mail</label>
        <input ref={emailInput} id="recovery-email" type="email" autoComplete="email" required maxLength={254}
          value={email} aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? 'recovery-email-error' : undefined}
          onChange={event => {
            const nextEmail = event.target.value
            setEmail(nextEmail)
            if (emailError) {
              setEmailError(!nextEmail.trim()
                ? 'Podaj adres e-mail.'
                : event.currentTarget.validity.valid ? '' : 'Podaj poprawny adres e-mail.')
            }
          }}
          onBlur={event => setEmailError(!event.currentTarget.value.trim()
            ? 'Podaj adres e-mail.'
            : event.currentTarget.validity.valid ? '' : 'Podaj poprawny adres e-mail.')}
          disabled={busy} />
        {emailError && <p id="recovery-email-error" className="field-error" role="alert">{emailError}</p>}
      </> : <>
        <label htmlFor="recovery-password">Nowe hasło</label>
        <input id="recovery-password" type="password" autoComplete="new-password" required minLength={8}
          value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
        <small>Minimum 8 znaków, maksimum 72 bajty UTF-8.</small>
        <label htmlFor="recovery-confirmation">Powtórz nowe hasło</label>
        <input id="recovery-confirmation" type="password" autoComplete="new-password" required
          value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} />
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy
        ? token === undefined ? 'Wysyłanie…' : 'Zapisywanie…'
        : token === undefined ? 'Wyślij link do resetowania hasła' : 'Zapisz nowe hasło'}</button>
    </form>}
    {done && token === undefined && <button type="button" className="recovery-back-link recovery-retry-link"
      onClick={() => {
        setDone(false)
        setMessage('')
        setError('')
        setEmailError('')
        requestAnimationFrame(() => emailInput.current?.focus())
      }}>
      <RetryIcon />
      <span>Spróbuj ponownie</span>
    </button>}
    <button type="button" className="recovery-back-link" disabled={busy} onClick={onBack}>
      <BackIcon />
      <span>Wróć do logowania</span>
    </button>
  </main>
}
