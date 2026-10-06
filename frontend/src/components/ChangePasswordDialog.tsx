import { useEffect, useRef, useState, type FormEvent } from 'react'
import { changePassword } from '../api/authApi'

export default function ChangePasswordDialog({ onClose, onSuccess }: {
  onClose: () => void
  onSuccess: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    if (newPassword !== confirmation) { setError('Nowe hasła muszą być takie same.'); return }
    if (new TextEncoder().encode(newPassword).length > 72) {
      setError('Nowe hasło jest za długie (maksimum 72 bajty UTF-8).'); return
    }
    setBusy(true)
    try {
      await changePassword(currentPassword, newPassword, confirmation)
      onSuccess()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się zmienić hasła.')
    } finally {
      setBusy(false)
    }
  }

  return <dialog className="password-dialog" ref={dialog} aria-labelledby="password-dialog-title"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
    <h2 id="password-dialog-title">Zmień hasło</h2>
    <p>Po zmianie hasła zaloguj się ponownie na swoich urządzeniach.</p>
    <form className="login-form" onSubmit={submit} aria-busy={busy}>
      <label htmlFor="current-password">Obecne hasło</label>
      <input id="current-password" type="password" autoComplete="current-password" required
        value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} disabled={busy} />
      <label htmlFor="new-password">Nowe hasło</label>
      <input id="new-password" type="password" autoComplete="new-password" required minLength={8}
        value={newPassword} onChange={event => setNewPassword(event.target.value)} disabled={busy} />
      <small>Minimum 8 znaków, maksimum 72 bajty UTF-8.</small>
      <label htmlFor="confirm-password">Powtórz nowe hasło</label>
      <input id="confirm-password" type="password" autoComplete="new-password" required
        value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? 'Zapisywanie…' : 'Zmień hasło'}</button>
      <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Anuluj</button>
    </form>
  </dialog>
}
