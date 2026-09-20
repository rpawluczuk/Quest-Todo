type HeaderProps = {
  points: number
}

function Header({ points }: HeaderProps) {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Małe kroki, codzienne zwycięstwa</p>
        <h1>Quest Todo</h1>
        <p className="subtitle">Zrób miejsce na to, co ważne.</p>
      </div>
      <div className="points-balance">
        <span>Twoje saldo</span>
        <strong aria-live="polite">{points} punktów</strong>
      </div>
    </header>
  )
}

export default Header
