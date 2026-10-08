import { useEffect, useRef, useState } from 'react'
import App from './App'
import LoginPage from './components/LoginPage'
import ChangePasswordDialog from './components/ChangePasswordDialog'
import EmailDialog from './components/EmailDialog'
import EmailConfirmationPage from './components/EmailConfirmationPage'
import PasswordRecoveryPage from './components/PasswordRecoveryPage'
import DeleteAccountDialog from './components/DeleteAccountDialog'
import { logout, readSession } from './api/authApi'
import type { User } from './api/userApi'
import './App.css'

export default function SessionApp() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [editingEmail, setEditingEmail] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [emailToken, setEmailToken] = useState<string | null>(() => new URLSearchParams(window.location.hash.slice(1)).get('verify-email'))
  const [notice, setNotice] = useState('')
  const [resetToken, setResetToken] = useState<string | null>(() => new URLSearchParams(window.location.hash.slice(1)).get('reset-password'))
  const channel = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    readSession(controller.signal).then((account) => {
      if (!controller.signal.aborted) setUser(account)
    }).catch(() => {
      if (!controller.signal.aborted) setError('Nie udało się połączyć z aplikacją.')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    const expire = () => { setUser(null); setChangingPassword(false); setEditingEmail(false); setDeletingAccount(false); setError('') }
    const openEmailLink = () => {
      const reset = new URLSearchParams(window.location.hash.slice(1)).get('reset-password')
      if (reset !== null) { setResetToken(reset); setEmailToken(null) }
      const token = new URLSearchParams(window.location.hash.slice(1)).get('verify-email')
      if (token !== null) setEmailToken(token)
    }
    window.addEventListener('quest-session-expired', expire)
    window.addEventListener('hashchange', openEmailLink)
    if ('BroadcastChannel' in window) {
      channel.current = new BroadcastChannel('quest-todo-session')
      channel.current.onmessage = () => window.location.reload()
    }
    return () => {
      controller.abort()
      window.removeEventListener('quest-session-expired', expire)
      window.removeEventListener('hashchange', openEmailLink)
      channel.current?.close()
      channel.current = null
    }
  }, [])

  async function signOut() {
    setLoggingOut(true)
    setError('')
    try {
      await logout()
      setUser(null)
      channel.current?.postMessage('logout')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się wylogować.')
    } finally {
      setLoggingOut(false)
    }
  }

  if (resetToken !== null) return <PasswordRecoveryPage key={resetToken} token={resetToken}
    onBack={() => window.location.replace(window.location.pathname)} />
  if (emailToken !== null) return <EmailConfirmationPage key={emailToken} token={emailToken} onDone={() => {
    setEmailToken(null)
    setEditingEmail(false)
    setChangingPassword(false)
  }} />
  if (loading) return <main className="login-page"><p role="status">Sprawdzanie sesji…</p></main>
  if (!user && error) return (
    <main className="login-page">
      <p className="form-error" role="alert">{error}</p>
      <button onClick={() => window.location.reload()}>Spróbuj ponownie</button>
    </main>
  )
  if (!user) return <LoginPage initialNotice={notice} onLogin={(account) => {
    setNotice('')
    setError('')
    setUser(account)
    channel.current?.postMessage('login')
  }} />
  return (
    <>
      <App key={user.id} user={user} onLogout={signOut} loggingOut={loggingOut} logoutError={error}
        onChangePassword={() => setChangingPassword(true)} onEmail={() => setEditingEmail(true)}
        onDeleteAccount={() => setDeletingAccount(true)} />
      {deletingAccount && <DeleteAccountDialog login={user.login ?? ''} onClose={() => setDeletingAccount(false)}
        onSuccess={() => {
          setDeletingAccount(false)
          setChangingPassword(false)
          setEditingEmail(false)
          setError('')
          setNotice('Konto i jego dane zostały usunięte.')
          setUser(null)
          channel.current?.postMessage('logout')
        }} />}
      {editingEmail && <EmailDialog onClose={() => setEditingEmail(false)} />}
      {changingPassword && <ChangePasswordDialog onClose={() => setChangingPassword(false)} onSuccess={() => {
        setChangingPassword(false)
        setError('')
        setNotice('Hasło zostało zmienione. Zaloguj się nowym hasłem.')
        setUser(null)
        channel.current?.postMessage('logout')
      }} />}
    </>
  )
}
