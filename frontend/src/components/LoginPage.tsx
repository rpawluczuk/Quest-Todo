import { useState, type FormEvent } from 'react'
import { login } from '../api/authApi'
import type { User } from '../api/userApi'

export default function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      onLogin(await login(username, password))
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
      <p>Zaloguj się, aby wrócić do swoich zadań i nagród.</p>
      <form className="login-form" onSubmit={submit} aria-busy={busy}>
        <label htmlFor="login">Login</label>
        <input id="login" name="username" autoComplete="username" autoCapitalize="none"
          spellCheck={false} required maxLength={64} value={username}
          onChange={(event) => setUsername(event.target.value)} disabled={busy} />
        <label htmlFor="password">Hasło</label>
        <input id="password" name="password" type="password" autoComplete="current-password"
          required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Logowanie…' : 'Zaloguj się'}</button>
      </form>
    </main>
  )
}
