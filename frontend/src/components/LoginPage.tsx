import { useRef, useState, type FormEvent } from 'react'
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

function SuccessIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12 2.7 2.7L16.5 9" />
  </svg>
}

type RegistrationField = 'username' | 'email' | 'password' | 'confirmation'
type RegistrationErrors = Partial<Record<RegistrationField, string>>

export type LoginSuccessNotice = {
  title: string
  description: string
}

function SuccessNotice({ notice }: { notice: LoginSuccessNotice }) {
  return <div className="registration-success" role="status">
    <span className="registration-success-icon"><SuccessIcon /></span>
    <div>
      <p className="registration-success-title">{notice.title}</p>
      <p>{notice.description}</p>
    </div>
  </div>
}

function loginError(value: string): string | undefined {
  const login = value.trim().toLowerCase()
  if (login.length < 3 || login.length > 64) return 'Login musi mieć od 3 do 64 znaków.'
  if (!/^[a-z0-9._-]+$/.test(login)) return 'Login może zawierać tylko litery, cyfry, kropki, _ i -.'
  if (!/^[a-z0-9]/.test(login)) return 'Login musi zaczynać się literą lub cyfrą.'
}

function passwordError(value: string): string | undefined {
  if (value.length < 8) return 'Hasło musi mieć minimum 8 znaków.'
  if (new TextEncoder().encode(value).length > 72) return 'Hasło jest za długie. Wybierz krótsze.'
}

function confirmationError(password: string, confirmation: string, requireValue: boolean): string | undefined {
  if (passwordError(password)) return undefined
  if (!confirmation) return requireValue ? 'Powtórz hasło.' : undefined
  if (password !== confirmation) return 'Hasła muszą być takie same.'
}

export default function LoginPage({ onLogin, initialNotice = '', initialSuccess = null }: {
  onLogin: (user: User) => void
  initialNotice?: string
  initialSuccess?: LoginSuccessNotice | null
}) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [registering, setRegistering] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [notice, setNotice] = useState(initialNotice)
  const [successNotice, setSuccessNotice] = useState(initialSuccess)
  const [registrationSuccess, setRegistrationSuccess] = useState<{ emailProvided: boolean } | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<RegistrationErrors>({})
  const emailInput = useRef<HTMLInputElement>(null)

  function validateRegistration(): boolean {
    const currentPasswordError = passwordError(password)
    const errors: RegistrationErrors = {
      username: loginError(username),
      email: email && emailInput.current && !emailInput.current.validity.valid
        ? 'Podaj poprawny adres e-mail.' : undefined,
      password: currentPasswordError,
      confirmation: currentPasswordError ? undefined : confirmationError(password, confirmation, true),
    }
    setFieldErrors(errors)
    return !Object.values(errors).some(Boolean)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (registering && !validateRegistration()) return
    setBusy(true)
    setError('')
    setNotice('')
    setSuccessNotice(null)
    setRegistrationSuccess(null)
    try {
      if (registering) {
        const emailProvided = Boolean(email.trim())
        await register(username, password, email)
        setRegistering(false)
        setConfirmation('')
        setShowConfirmation(false)
        setFieldErrors({})
        setRegistrationSuccess({ emailProvided })
      } else {
        onLogin(await login(username, password))
      }
      setPassword('')
      setShowPassword(false)
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'Nie udało się zalogować.'
      if (registering) {
        const normalized = message.toLocaleLowerCase('pl')
        if (normalized.includes('login')) setFieldErrors(current => ({ ...current, username: message }))
        else if (normalized.includes('e-mail') || normalized.includes('email') || normalized.includes('adres'))
          setFieldErrors(current => ({ ...current, email: message }))
        else if (normalized.includes('hasło'))
          setFieldErrors(current => ({ ...current, password: passwordError(password) ?? 'Sprawdź wpisane hasło.' }))
        else setError(message)
      } else setError(message)
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
      {successNotice && <SuccessNotice notice={successNotice} />}
      {registrationSuccess && <SuccessNotice notice={{
        title: 'Konto zostało utworzone!',
        description: registrationSuccess.emailProvided
          ? 'Sprawdź pocztę i potwierdź adres e-mail. Możesz już się zalogować.'
          : 'Możesz już się zalogować.',
      }} />}
      <form className={`login-form${registering ? ' registration-form' : ''}`} onSubmit={submit}
        aria-busy={busy} noValidate={registering}>
        <label htmlFor="login">Login</label>
        <input id="login" name="username" autoComplete="username" autoCapitalize="none"
          spellCheck={false} required maxLength={64} value={username}
          aria-invalid={registering && Boolean(fieldErrors.username)}
          aria-describedby={registering ? fieldErrors.username ? 'registration-login-error' : 'registration-login-help' : undefined}
          onChange={(event) => {
            const nextUsername = event.target.value
            setUsername(nextUsername)
            setFieldErrors(current => current.username
              ? { ...current, username: loginError(nextUsername) }
              : current)
          }}
          onBlur={() => registering && setFieldErrors(current => ({ ...current, username: loginError(username) }))}
          disabled={busy} />
        {registering && (fieldErrors.username
          ? <p id="registration-login-error" className="field-error" role="alert">{fieldErrors.username}</p>
          : <small id="registration-login-help">3–64 znaki. Litery, cyfry, kropki, _ i -.</small>)}
        {registering && <>
          <label htmlFor="registration-email">E-mail (opcjonalnie)</label>
          <input ref={emailInput} id="registration-email" type="email" autoComplete="email" maxLength={254}
            value={email} aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'registration-email-error' : 'registration-email-help'}
            onChange={event => {
              const nextEmail = event.target.value
              const invalidEmail = nextEmail.trim() && !event.currentTarget.validity.valid
              setEmail(nextEmail)
              setFieldErrors(current => current.email
                ? { ...current, email: invalidEmail ? 'Podaj poprawny adres e-mail.' : undefined }
                : current)
            }}
            onBlur={() => setFieldErrors(current => ({ ...current, email: email && emailInput.current && !emailInput.current.validity.valid
              ? 'Podaj poprawny adres e-mail.' : undefined }))}
            disabled={busy} />
          {fieldErrors.email
            ? <p id="registration-email-error" className="field-error" role="alert">{fieldErrors.email}</p>
            : <small id="registration-email-help">Umożliwia odzyskanie hasła. Możesz dodać go później.</small>}
        </>}
        <label htmlFor="password">Hasło</label>
        <div className="login-password-field">
          <input id="password" name="password" type={showPassword ? 'text' : 'password'}
            autoComplete={registering ? 'new-password' : 'current-password'} required
            minLength={registering ? 8 : undefined} value={password}
            aria-invalid={registering && Boolean(fieldErrors.password)}
            aria-describedby={registering ? fieldErrors.password ? 'registration-password-error' : 'registration-password-help' : undefined}
            onChange={(event) => {
              const nextPassword = event.target.value
              setPassword(nextPassword)
              setFieldErrors(current => ({
                ...current,
                password: current.password ? passwordError(nextPassword) : undefined,
                confirmation: confirmationError(nextPassword, confirmation, false),
              }))
            }}
            onBlur={() => registering && setFieldErrors(current => ({
              ...current,
              password: passwordError(password),
              confirmation: confirmationError(password, confirmation, false),
            }))}
            disabled={busy} />
          <button type="button" className="password-visibility-button" aria-pressed={showPassword}
            aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'} title={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
            disabled={busy} onClick={() => setShowPassword(value => !value)}>
            <PasswordVisibilityIcon visible={showPassword} />
          </button>
        </div>
        {!registering && <button type="button" className="login-inline-link login-forgot-link" disabled={busy}
          onClick={() => {
            setPassword('')
            setShowPassword(false)
            setSuccessNotice(null)
            setRegistrationSuccess(null)
            setRecovering(true)
          }}>Nie pamiętasz hasła?</button>}
        {registering && <>
          {fieldErrors.password
            ? <p id="registration-password-error" className="field-error" role="alert">{fieldErrors.password}</p>
            : <small id="registration-password-help">Minimum 8 znaków.</small>}
          <label htmlFor="confirmation">Powtórz hasło</label>
          <div className="login-password-field">
            <input id="confirmation" name="password-confirmation" type={showConfirmation ? 'text' : 'password'}
              autoComplete="new-password" required value={confirmation} aria-invalid={Boolean(fieldErrors.confirmation)}
              aria-describedby={fieldErrors.confirmation ? 'registration-confirmation-error' : undefined}
              onChange={(event) => {
                const nextConfirmation = event.target.value
                setConfirmation(nextConfirmation)
                setFieldErrors(current => current.confirmation
                  ? { ...current, confirmation: confirmationError(password, nextConfirmation, true) }
                  : current)
              }}
              onBlur={() => setFieldErrors(current => ({
                ...current,
                confirmation: confirmationError(password, confirmation, true),
              }))}
              disabled={busy} />
            <button type="button" className="password-visibility-button" aria-pressed={showConfirmation}
              aria-label={showConfirmation ? 'Ukryj powtórzone hasło' : 'Pokaż powtórzone hasło'}
              title={showConfirmation ? 'Ukryj powtórzone hasło' : 'Pokaż powtórzone hasło'} disabled={busy}
              onClick={() => setShowConfirmation(value => !value)}>
              <PasswordVisibilityIcon visible={showConfirmation} />
            </button>
          </div>
          {fieldErrors.confirmation && <p id="registration-confirmation-error" className="field-error" role="alert">{fieldErrors.confirmation}</p>}
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
            setShowConfirmation(false)
            setFieldErrors({})
            setError('')
            setNotice('')
            setSuccessNotice(null)
            setRegistrationSuccess(null)
          }}>{registering ? 'Zaloguj się' : 'Zarejestruj się'}</button>
        </p>
      </form>
    </main>
  )
}
