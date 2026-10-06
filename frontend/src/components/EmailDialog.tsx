import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getEmail, saveEmail, type EmailStatus } from '../api/emailApi'

export default function EmailDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [status, setStatus] = useState<EmailStatus | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const element = dialog.current
    const controller = new AbortController()
    element?.showModal()
    getEmail(controller.signal).then(value => {
      if (!controller.signal.aborted) { setStatus(value); setEmail(value.pendingEmail ?? '') }
    }).catch(() => { if (!controller.signal.aborted) setError('Nie udało się pobrać adresu. Zamknij i otwórz formularz ponownie.') })
    return () => { controller.abort(); element?.close() }
  }, [])

  async function send(resend: boolean) {
    if (busy) return
    if (!password) { setError('Podaj obecne hasło.'); return }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await saveEmail(email, password, resend)
      setPassword('')
      setStatus(await getEmail())
      setNotice('Wiadomość wysłana. Sprawdź skrzynkę (także spam) i potwierdź adres linkiem. Link jest ważny 24 godziny.')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się wysłać wiadomości.')
    } finally { setBusy(false) }
  }

  function submit(event: FormEvent) { event.preventDefault(); void send(false) }
  return <dialog ref={dialog} className="password-dialog email-dialog" aria-labelledby="email-title"
    onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <h2 id="email-title">Adres e-mail</h2>
    {!status && !error && <p role="status">Ładowanie…</p>}
    {status && <>
      <p>{status.verifiedEmail ? <>Potwierdzony adres: <strong>{status.verifiedEmail}</strong></> : 'Nie masz jeszcze potwierdzonego adresu e-mail.'}</p>
      {status.pendingEmail && <p>Oczekuje na potwierdzenie: <strong>{status.pendingEmail}</strong>.
        {status.expiresAt && ` Link ważny do: ${new Date(status.expiresAt).toLocaleString('pl-PL')}. Po tym terminie wyślij nowy.`}</p>}
      {status.verifiedEmail && <p>Obecny adres będzie działał do potwierdzenia nowego.</p>}
      <form className="login-form" onSubmit={submit} aria-busy={busy}>
        <label htmlFor="account-email">{status.verifiedEmail ? 'Nowy adres e-mail' : 'Adres e-mail'}</label>
        <input id="account-email" type="email" autoComplete="email" required maxLength={254}
          value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
        <label htmlFor="email-password">Obecne hasło</label>
        <input id="email-password" type="password" autoComplete="current-password" required
          value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
        <button type="submit" disabled={busy}>{busy ? 'Wysyłanie…' : 'Wyślij link potwierdzający'}</button>
        {status.pendingEmail && <button type="button" className="secondary-button" disabled={busy}
          onClick={() => void send(true)}>Wyślij ponownie na {status.pendingEmail}</button>}
      </form>
    </>}
    {notice && <p role="status">{notice}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button type="button" className="secondary-button email-close" disabled={busy} onClick={onClose}>Zamknij</button>
  </dialog>
}
