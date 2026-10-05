import { useEffect, useRef, useState } from 'react'
import App from './App'
import LoginPage from './components/LoginPage'
import { logout, readSession } from './api/authApi'
import type { User } from './api/userApi'
import './App.css'

export default function SessionApp() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
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
    const expire = () => setUser(null)
    window.addEventListener('quest-session-expired', expire)
    if ('BroadcastChannel' in window) {
      channel.current = new BroadcastChannel('quest-todo-session')
      channel.current.onmessage = () => window.location.reload()
    }
    return () => {
      controller.abort()
      window.removeEventListener('quest-session-expired', expire)
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

  if (loading) return <main className="login-page"><p role="status">Sprawdzanie sesji…</p></main>
  if (!user && error) return (
    <main className="login-page">
      <p className="form-error" role="alert">{error}</p>
      <button onClick={() => window.location.reload()}>Spróbuj ponownie</button>
    </main>
  )
  if (!user) return <LoginPage onLogin={(account) => {
    setError('')
    setUser(account)
    channel.current?.postMessage('login')
  }} />
  return (
    <>
      <div className="account-bar">
        <span>Zalogowano jako <strong>{user.name}</strong></span>
        <button className="secondary-button" onClick={signOut} disabled={loggingOut}>
          {loggingOut ? 'Wylogowywanie…' : 'Wyloguj się'}
        </button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      {/* Unmounting App removes all data when the session ends or changes user. */}
      <App key={user.id} />
    </>
  )
}
