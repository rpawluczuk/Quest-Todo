import UserMenu from './UserMenu'
import type { Theme } from '../theme'
import type { CategoryMutation } from '../categoryEvents'

type HeaderProps = {
  theme: Theme
  onThemeChange: (theme: Theme) => Promise<void>
  points: number | null
  username: string
  onLogout: () => Promise<void>
  loggingOut: boolean
  onChangePassword: () => void
  onEmail: () => void
  onDeleteAccount: () => void
  onCategoriesChanged: (change: CategoryMutation) => void
}

function Header({ points, username, onLogout, loggingOut, onChangePassword, onEmail, onDeleteAccount,
  onCategoriesChanged, theme, onThemeChange }: HeaderProps) {
  return (
    <header className="app-header">
      <h1>Quest Todo</h1>
      <div className="header-account">
        <span className="points-balance" aria-live="polite">
        {points === null ? 'Saldo niedostępne' : <>Saldo <span className="points-balance-value">{points} pkt</span></>}
        </span>
        <UserMenu username={username} onLogout={onLogout} loggingOut={loggingOut} onChangePassword={onChangePassword} onEmail={onEmail} onDeleteAccount={onDeleteAccount}
          onCategoriesChanged={onCategoriesChanged} theme={theme} onThemeChange={onThemeChange} />
      </div>
    </header>
  )
}

export default Header
