import { useEffect, useRef, useState, type FormEvent } from 'react'
import { apiFetch } from '../api/apiFetch'

export default function DeleteAccountDialog({ login, onClose, onSuccess }: {
  login: string; onClose: () => void; onSuccess: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  const ready = login.length > 0 && confirmation === login && password.length > 0 && accepted
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!ready || busy) return
    setBusy(true)
    setError('')
    try {
      const response = await apiFetch('/api/users/me', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, loginConfirmation: confirmation, irreversibleConfirmation: accepted }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { message?: string }
        throw new Error(result.message ?? 'Nie udało się usunąć konta. Sprawdź połączenie i spróbuj ponownie.')
      }
      onSuccess()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się usunąć konta.')
    } finally { setBusy(false) }
  }
  return <dialog className="password-dialog" ref={dialog} aria-labelledby="delete-account-title"
    aria-describedby="delete-account-warning"
    onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <h2 id="delete-account-title">Usuń konto</h2>
    <p id="delete-account-warning">Usuniesz konto oraz wszystkie swoje zadania, nagrody, historię zakupów,
      punkty i dane logowania wraz z adresem e-mail. Nastąpi to od razu — nie będzie możliwości cofnięcia
      tej operacji w aplikacji. Zostaniesz wylogowany na swoich urządzeniach.</p>
    <form className="login-form" onSubmit={submit} aria-busy={busy}>
      <label htmlFor="delete-login">Aby potwierdzić, przepisz swój login: <strong>{login}</strong></label>
      <input id="delete-login" required autoComplete="off" autoCapitalize="none" spellCheck={false}
        maxLength={64} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} />
      <label htmlFor="delete-password">Obecne hasło</label>
      <input id="delete-password" type="password" autoComplete="current-password" required
        value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
      <label className="delete-account-confirmation">
        <input type="checkbox" required checked={accepted} onChange={event => setAccepted(event.target.checked)} disabled={busy} />
        <span>Rozumiem, że trwale usunę konto i jego dane.</span>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Anuluj</button>
      <button type="submit" className="delete-account-button" disabled={!ready || busy}>
        {busy ? 'Usuwanie…' : 'Usuń konto bezpowrotnie'}</button>
    </form>
  </dialog>
}
