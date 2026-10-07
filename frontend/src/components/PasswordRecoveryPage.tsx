import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../api/apiFetch'

export default function PasswordRecoveryPage({ token, onBack }: { token?: string; onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (token !== undefined) window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [token])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
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
      setMessage(token === undefined ? ((await response.json()) as { message: string }).message : 'Hasło zostało zmienione. Zaloguj się nowym hasłem.')
      setPassword('')
      setConfirmation('')
      setDone(true)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się połączyć z aplikacją.')
    } finally { setBusy(false) }
  }
  return <main className="login-page">
    <h1>Quest Todo</h1>
    <h2>{token === undefined ? 'Nie pamiętasz hasła?' : 'Ustaw nowe hasło'}</h2>
    {done ? <p role="status">{message}</p> : <form className="login-form" onSubmit={submit} aria-busy={busy}>
      {token === undefined ? <>
        <p>Podaj adres wcześniej potwierdzony w menu konta. Konto bez potwierdzonego e-maila nie może skorzystać z odzyskiwania hasła.</p>
        <label htmlFor="recovery-email">Adres e-mail</label>
        <input id="recovery-email" type="email" autoComplete="email" required maxLength={254}
          value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
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
      <button disabled={busy}>{busy ? 'Proszę czekać…' : token === undefined ? 'Wyślij link' : 'Zapisz nowe hasło'}</button>
    </form>}
    <button className="secondary-button email-close" disabled={busy} onClick={onBack}>Wróć do logowania</button>
  </main>
}
