import { useEffect, useId, useRef, useState } from 'react'

type UserMenuProps = {
  username: string
  onLogout: () => Promise<void>
  loggingOut: boolean
}

export default function UserMenu({ username, onLogout, loggingOut }: UserMenuProps) {
  const [open, setOpen] = useState(false)
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

  return (
    <div className="user-menu" ref={container} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
    }}>
      <button ref={trigger} type="button" className="user-avatar"
        aria-label={loggingOut ? 'Wylogowywanie…' : username ? `Menu użytkownika: ${username}` : 'Menu użytkownika'}
        aria-expanded={open} aria-controls={open ? panelId : undefined}
        disabled={loggingOut} onClick={() => setOpen(!open)}>
        {Array.from(username.trim())[0]?.toLocaleUpperCase('pl') ?? '?'}
      </button>
      {open && <div id={panelId} className="user-menu-panel">
        <p className="user-menu-name">{username || 'Login niedostępny — odśwież stronę po aktualizacji backendu.'}</p>
        <button type="button" className="user-menu-logout" onClick={() => {
          setOpen(false)
          trigger.current?.focus()
          void onLogout()
        }}>Wyloguj się</button>
      </div>}
    </div>
  )
}
