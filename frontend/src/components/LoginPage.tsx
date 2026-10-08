import { useState, type FormEvent } from 'react'
import { login, register } from '../api/authApi'
import type { User } from '../api/userApi'
import PasswordRecoveryPage from './PasswordRecoveryPage'

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
    <circle cx="12" cy="12" r="2.5" />
    {!visible && <path d="m4 4 16 16" />}
  </svg>
}

export default function LoginPage({ onLogin, initialNotice = '' }: { onLogin: (user: User) => void; initialNotice?: string }) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [registering, setRegistering] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [notice, setNotice] = useState(initialNotice)
  const [recovering, setRecovering] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (registering) {
        if (password !== confirmation) throw new Error('Hasła muszą być takie same.')
        const message = await register(username, password, email)
        setRegistering(false)
        setConfirmation('')
        setNotice(message)
      } else {
        onLogin(await login(username, password))
      }
      setPassword('')
      setShowPassword(false)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się zalogować.')
    } finally {
      setBusy(false)
    }
  }

  if (recovering) return <PasswordRecoveryPage onBack={() => setRecovering(false)} />
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
        {registering && <>
          <label htmlFor="registration-email">E-mail (opcjonalny)</label>
          <input id="registration-email" type="email" autoComplete="email" maxLength={254}
            value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
          <small>Możesz dodać i potwierdzić adres teraz lub później w menu konta.</small>
        </>}
        <label htmlFor="password">Hasło</label>
        <div className="login-password-field">
          <input id="password" name="password" type={showPassword ? 'text' : 'password'}
            autoComplete={registering ? 'new-password' : 'current-password'} required
            minLength={registering ? 8 : undefined} value={password}
            onChange={(event) => setPassword(event.target.value)} disabled={busy} />
          <button type="button" className="password-visibility-button" aria-pressed={showPassword}
            aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'} title={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
            disabled={busy} onClick={() => setShowPassword(value => !value)}>
            <PasswordVisibilityIcon visible={showPassword} />
          </button>
        </div>
        {!registering && <button type="button" className="login-inline-link login-forgot-link" disabled={busy}
          onClick={() => { setPassword(''); setShowPassword(false); setRecovering(true) }}>Nie pamiętasz hasła?</button>}
        {registering && <>
          <small>Hasło: minimum 8 znaków, maksimum 72 bajty UTF-8 (polskie litery zajmują więcej niż jeden bajt).</small>
          <label htmlFor="confirmation">Powtórz hasło</label>
          <input id="confirmation" type="password" autoComplete="new-password" required
            value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} />
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Proszę czekać…' : registering ? 'Utwórz konto' : 'Zaloguj się'}</button>
        <p className="login-mode-prompt">
          {registering ? 'Masz już konto? ' : 'Nie masz konta? '}
          <button type="button" className="login-inline-link" disabled={busy} onClick={() => {
            setRegistering(!registering)
            setPassword('')
            setShowPassword(false)
            setConfirmation('')
            setError('')
            setNotice('')
          }}>{registering ? 'Zaloguj się' : 'Zarejestruj się'}</button>
        </p>
      </form>
    </main>
  )
}
