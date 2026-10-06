import UserMenu from './UserMenu'

type HeaderProps = {
  points: number | null
  username: string
  onLogout: () => Promise<void>
  loggingOut: boolean
  onChangePassword: () => void
}

function Header({ points, username, onLogout, loggingOut, onChangePassword }: HeaderProps) {
  return (
    <header className="app-header">
      <h1>Quest Todo</h1>
      <div className="header-account">
        <span className="points-balance" aria-live="polite">
        {points === null ? 'Saldo niedostępne' : <>Saldo <span className="points-balance-value">{points} pkt</span></>}
        </span>
        <UserMenu username={username} onLogout={onLogout} loggingOut={loggingOut} onChangePassword={onChangePassword} />
      </div>
    </header>
  )
}

export default Header
