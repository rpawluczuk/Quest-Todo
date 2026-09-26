import type { Purchase } from '../api/userApi'
import type { Reward } from '../types/Reward'
import CreateRewardForm from '../components/CreateRewardForm'

type RewardsPageProps = {
  readonly rewards: readonly Reward[]
  readonly purchases: readonly Purchase[]
  readonly points: number | null
  readonly buying: boolean
  readonly onBuyReward: (rewardId: number) => void
  readonly onAddReward: (title: string, cost: number) => Promise<void>
}

function RewardsPage({ rewards, purchases, points, buying, onBuyReward, onAddReward }: RewardsPageProps) {
  return (
    <section className="tasks-section" aria-labelledby="rewards-heading">
      <div className="section-header">
        <h2 id="rewards-heading">Nagrody</h2>
        <p>Wymień zdobyte punkty na coś dla siebie.</p>
      </div>
      <CreateRewardForm onAddReward={onAddReward} />
      {points !== null && points < 0 && (
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
                disabled={buying || points === null || points < reward.cost}
                onClick={() => onBuyReward(reward.id)}
                aria-label={`Kup nagrodę: ${reward.title}, ${reward.cost} punktów`}
              >
                Kup nagrodę
              </button>
              {points !== null && points < reward.cost && (
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
            {purchases.map((purchase) => (
              <li key={purchase.id}>{purchase.title} — {purchase.cost} pkt</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default RewardsPage
