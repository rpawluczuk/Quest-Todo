import type { Reward } from '../types/Reward'

type RewardsPageProps = {
  readonly rewards: readonly Reward[]
  readonly purchases: readonly Reward[]
  readonly points: number
  readonly onBuyReward: (rewardId: number) => void
}

function RewardsPage({ rewards, purchases, points, onBuyReward }: RewardsPageProps) {
  return (
    <section className="tasks-section" aria-labelledby="rewards-heading">
      <div className="section-header">
        <h2 id="rewards-heading">Nagrody</h2>
        <p>Wymień zdobyte punkty na coś dla siebie.</p>
      </div>
      {points < 0 && (
        <p className="empty-state">
          Masz ujemne saldo po cofnięciu wykonania zadań. Zdobądź punkty, aby ponownie kupować nagrody.
        </p>
      )}
      <ul className="task-list">
        {rewards.length === 0 && <li className="empty-state">Brak dostępnych nagród.</li>}
        {rewards.map((reward) => (
          <li className="task" key={reward.id}>
            <span className="task-title">{reward.title}</span>
            <div className="task-actions">
              <span className="task-points">{reward.cost} pkt</span>
              <button
                type="button"
                className="secondary-button"
                disabled={points < reward.cost}
                onClick={() => onBuyReward(reward.id)}
                aria-label={`Kup nagrodę: ${reward.title}, ${reward.cost} punktów`}
              >
                Kup nagrodę
              </button>
              {points < reward.cost && (
                <span>Brakuje {reward.cost - points} pkt</span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="reward-status" role="status">
        {purchases.length > 0
          ? `Liczba zakupów: ${purchases.length}. Ostatnia nagroda: ${purchases[purchases.length - 1].title}.`
          : 'Nie kupiono jeszcze żadnej nagrody.'}
      </p>
      {purchases.length > 0 && (
        <div className="reward-purchases">
          <h3>Kupione nagrody</h3>
          <ul>
            {rewards.map((reward) => {
              const count = purchases.filter((purchase) => purchase.id === reward.id).length
              return count > 0 ? <li key={reward.id}>{reward.title} × {count}</li> : null
            })}
          </ul>
        </div>
      )}
    </section>
  )
}

export default RewardsPage
