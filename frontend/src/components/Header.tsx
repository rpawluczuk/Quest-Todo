type HeaderProps = {
  points: number | null
}

function Header({ points }: HeaderProps) {
  return (
    <header className="app-header">
      <h1>Quest Todo</h1>
      <span className="points-balance" aria-live="polite">
        {points === null ? 'Saldo niedostępne' : <>Saldo <span className="points-balance-value">{points} pkt</span></>}
      </span>
    </header>
  )
}

export default Header
