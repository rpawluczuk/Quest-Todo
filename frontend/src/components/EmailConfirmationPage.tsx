import { useEffect, useState } from 'react'
import { confirmEmail } from '../api/emailApi'

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
    try { await confirmEmail(token); setDone(true) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Nie udało się potwierdzić adresu.') }
    finally { setBusy(false) }
  }
  return <main className="login-page">
    <h1>Quest Todo</h1>
    <h2>Potwierdź adres e-mail</h2>
    {done ? <p role="status">Adres e-mail został potwierdzony.</p> : <>
      <p>Potwierdź tylko wtedy, gdy podano ten adres przy swoim koncie Quest Todo.</p>
      <button className="secondary-button email-close" disabled={busy} onClick={() => void confirm()}>
        {busy ? 'Potwierdzanie…' : 'Potwierdź adres'}</button>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="secondary-button email-close" disabled={busy} onClick={onDone}>Wróć do aplikacji</button>
  </main>
}
