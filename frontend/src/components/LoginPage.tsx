import { useState, type FormEvent } from 'react'
import { login, register } from '../api/authApi'
import type { User } from '../api/userApi'

export default function LoginPage({ onLogin, initialNotice = '' }: { onLogin: (user: User) => void; initialNotice?: string }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [registering, setRegistering] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [notice, setNotice] = useState(initialNotice)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (registering) {
        if (password !== confirmation) throw new Error('Hasła muszą być takie same.')
        await register(username, password)
        setRegistering(false)
        setConfirmation('')
        setNotice('Konto utworzone. Zaloguj się wybranym loginem i hasłem.')
      } else {
        onLogin(await login(username, password))
      }
      setPassword('')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się zalogować.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-page">
      <h1>Quest Todo</h1>
      <p>{registering ? 'Utwórz konto z własnymi zadaniami i nagrodami.' : 'Zaloguj się, aby wrócić do swoich zadań i nagród.'}</p>
      {notice && <p role="status">{notice}</p>}
      <form className="login-form" onSubmit={submit} aria-busy={busy}>
        <label htmlFor="login">Login</label>
        <input id="login" name="username" autoComplete="username" autoCapitalize="none"
          spellCheck={false} required maxLength={64} value={username}
          onChange={(event) => setUsername(event.target.value)} disabled={busy} />
        {registering && <small>Login: 3–64 znaki, litery a–z, cyfry, kropka, podkreślenie lub myślnik. Zacznij literą lub cyfrą.</small>}
        <label htmlFor="password">Hasło</label>
        <input id="password" name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'}
          required minLength={registering ? 8 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
        {registering && <>
          <small>Hasło: minimum 8 znaków, maksimum 72 bajty UTF-8 (polskie litery zajmują więcej niż jeden bajt).</small>
          <label htmlFor="confirmation">Powtórz hasło</label>
          <input id="confirmation" type="password" autoComplete="new-password" required
            value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} />
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Proszę czekać…' : registering ? 'Utwórz konto' : 'Zaloguj się'}</button>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => {
          setRegistering(!registering)
          setPassword('')
          setConfirmation('')
          setError('')
          setNotice('')
        }}>{registering ? 'Mam już konto — zaloguj się' : 'Nie masz konta? Zarejestruj się'}</button>
      </form>
    </main>
  )
}
