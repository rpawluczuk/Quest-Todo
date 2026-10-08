import { useEffect, useState } from 'react'
import { confirmEmail } from '../api/emailApi'

function SuccessIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12 2.7 2.7L16.5 9" />
  </svg>
}

function BackIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
}

export default function EmailConfirmationPage({ token, onDone }: { token: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Keep the bearer token out of browser history and subsequent copied URLs.
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  async function confirm() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await confirmEmail(token)
      setDone(true)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się potwierdzić adresu.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="login-page email-confirmation-page">
    <h1>Quest Todo</h1>
    {done ? <section className="email-confirmation-success" role="status" aria-labelledby="email-confirmation-title">
      <div className="email-confirmation-heading">
        <span className="email-confirmation-success-icon"><SuccessIcon /></span>
        <h2 id="email-confirmation-title">E-mail potwierdzony!</h2>
      </div>
      <p>Adres e-mail został pomyślnie potwierdzony. Możesz teraz używać go do odzyskiwania hasła.</p>
      <button type="button" className="email-confirmation-primary" onClick={onDone}>Wróć do aplikacji</button>
    </section> : <section aria-labelledby="email-confirmation-title">
      <h2 id="email-confirmation-title">Potwierdź adres e-mail</h2>
      <p className="email-confirmation-description">Potwierdź adres e-mail powiązany z tym linkiem, aby móc korzystać z niego na swoim koncie.</p>
      {error && <p className="form-error email-confirmation-error" role="alert">{error}</p>}
      <button type="button" className="email-confirmation-primary" disabled={busy} onClick={() => void confirm()}>
        {busy ? 'Potwierdzanie…' : 'Potwierdź adres e-mail'}
      </button>
      <button type="button" className="email-confirmation-back" disabled={busy} onClick={onDone}>
        <BackIcon />
        <span>Wróć do aplikacji</span>
      </button>
    </section>}
  </main>
}
