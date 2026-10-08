import { useEffect, useId, useRef, useState } from 'react'
import { getEmail } from '../api/emailApi'

type MenuIconName = 'password' | 'email' | 'logout' | 'delete'

function MenuIcon({ name }: { name: MenuIconName }) {
  const paths: Record<MenuIconName, React.ReactNode> = {
    password: <><circle cx="8" cy="8" r="3" /><path d="M10.2 10.2 15.5 15.5M13 13l1.4-1.4M15 15l1.4-1.4" /></>,
    email: <><rect x="2.5" y="4" width="15" height="12" rx="2" /><path d="m4 6 6 4.5L16 6" /></>,
    logout: <><path d="M8 3H4.5A1.5 1.5 0 0 0 3 4.5v11A1.5 1.5 0 0 0 4.5 17H8" /><path d="M12.5 6.5 16 10l-3.5 3.5M8 10h8" /></>,
    delete: <><path d="M3.5 5.5h13M8 3.5h4M5.5 5.5l.7 11h7.6l.7-11M8 8.5v5M12 8.5v5" /></>,
  }
  return <svg className="user-menu-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"
    fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {paths[name]}
  </svg>
}

type UserMenuProps = {
  username: string
  onLogout: () => Promise<void>
  loggingOut: boolean
  onChangePassword: () => void
  onEmail: () => void
  onDeleteAccount: () => void
}

export default function UserMenu({ username, onLogout, loggingOut, onChangePassword, onEmail, onDeleteAccount }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const [verifiedEmail, setVerifiedEmail] = useState<string | null | undefined>(undefined)
  const [emailError, setEmailError] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    function closeOutside(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    getEmail(controller.signal).then(status => {
      if (!controller.signal.aborted) setVerifiedEmail(status.verifiedEmail)
    }).catch(() => {
      if (!controller.signal.aborted) setEmailError(true)
    })
    return () => controller.abort()
  }, [open])

  const initial = Array.from(username.trim())[0]?.toLocaleUpperCase('pl') ?? '?'
  const emailDescription = emailError ? 'Nie udało się pobrać adresu e-mail'
    : verifiedEmail === undefined ? 'Pobieranie adresu e-mail…'
      : verifiedEmail ?? 'Nie dodano adresu e-mail'
  const emailAction = verifiedEmail === undefined || emailError ? 'Adres e-mail'
    : verifiedEmail ? 'Zmień adres e-mail' : 'Dodaj adres e-mail'

  return (
    <div className="user-menu" ref={container} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
    }}>
      <button ref={trigger} type="button" className="user-avatar"
        aria-label={loggingOut ? 'Wylogowywanie…' : username ? `Menu użytkownika: ${username}` : 'Menu użytkownika'}
        aria-expanded={open} aria-controls={open ? panelId : undefined}
        disabled={loggingOut} onClick={() => {
          if (!open) { setVerifiedEmail(undefined); setEmailError(false) }
          setOpen(!open)
        }}>
        {initial}
      </button>
      {open && <div id={panelId} className="user-menu-panel">
        <div className="user-menu-profile">
          <span className="user-menu-profile-avatar" aria-hidden="true">{initial}</span>
          <div className="user-menu-profile-details">
            <p className="user-menu-name">{username || 'Login niedostępny'}</p>
            <p className={`user-menu-email${verifiedEmail ? '' : ' user-menu-email-muted'}`} aria-live="polite"
              title={verifiedEmail ?? undefined}>{emailDescription}</p>
          </div>
        </div>
        <div className="user-menu-actions">
        <button type="button" className="user-menu-logout" onClick={() => {
          setOpen(false)
          trigger.current?.focus()
          onChangePassword()
        }}><MenuIcon name="password" /><span>Zmień hasło</span></button>
        <button type="button" className="user-menu-logout" onClick={() => {
          setOpen(false)
          trigger.current?.focus()
          onEmail()
        }}><MenuIcon name="email" /><span>{emailAction}</span></button>
        <button type="button" className="user-menu-logout" onClick={() => {
          setOpen(false)
          trigger.current?.focus()
          void onLogout()
        }}><MenuIcon name="logout" /><span>Wyloguj się</span></button>
        <div className="user-menu-danger">
          <button type="button" className="user-menu-logout delete-account-menu" onClick={() => {
            setOpen(false)
            trigger.current?.focus()
            onDeleteAccount()
          }}><MenuIcon name="delete" /><span>Usuń konto</span></button>
        </div>
        </div>
      </div>}
    </div>
  )
}
