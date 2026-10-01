import { useRef, useState } from 'react'
import type { Purchase } from '../api/userApi'
import type { Reward } from '../types/Reward'
import CreateRewardForm from '../components/CreateRewardForm'
import EditRewardForm from '../components/EditRewardForm'
import RewardInventory from '../components/RewardInventory'
import TaskActionsMenu from '../components/TaskActionsMenu'

type RewardsPageProps = {
  readonly rewards: readonly Reward[]
  readonly purchases: readonly Purchase[]
  readonly points: number | null
  readonly buying: boolean
  readonly onBuyReward: (rewardId: number) => void
  readonly onAddReward: (title: string, cost: number) => Promise<void>
  readonly onSaveReward: (id: number, title: string, cost: number) => Promise<void>
  readonly onUsePurchase: (id: number) => Promise<void>
  readonly onDeleteReward: (id: number) => Promise<void>
}

function RewardsPage({ rewards, purchases, points, buying, onBuyReward, onAddReward, onSaveReward, onUsePurchase, onDeleteReward }: RewardsPageProps) {
  const [editingRewardId, setEditingRewardId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleteNotice, setDeleteNotice] = useState('')
  const deleting = useRef(false)

  async function remove(reward: Reward) {
    if (deleting.current || buying || editingRewardId !== null) return
    deleting.current = true
    setDeletingId(reward.id)
    setDeleteError('')
    setDeleteNotice('')
    try {
      await onDeleteReward(reward.id)
      setDeleteNotice(`Usunięto ze sklepu: ${reward.title}.`)
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'Nie udało się usunąć nagrody. Spróbuj ponownie.')
    } finally {
      deleting.current = false
      setDeletingId(null)
    }
  }

  const sortedRewards = [...rewards].sort((a, b) => a.cost - b.cost)

  return (
    <div className="rewards-sections">
      <section className="tasks-section" aria-labelledby="rewards-heading">
      <div className="section-header">
        <h2 id="rewards-heading">Dostępne nagrody</h2>
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
        {sortedRewards.map((reward) => (
          <li className={`task reward-card${editingRewardId === reward.id ? ' reward-card-editing' : ''}`} key={reward.id}>
            {editingRewardId === reward.id ? (
              <EditRewardForm
                reward={reward}
                onSave={onSaveReward}
                onCancel={() => setEditingRewardId(null)}
              />
            ) : (
              <>
                <span className="task-title reward-card-title">{reward.title}</span>
                <span className="task-points reward-card-points">{reward.cost} pkt</span>
                <button
                  type="button"
                  className="secondary-button reward-buy-button"
                  disabled={buying || deletingId !== null || editingRewardId !== null || points === null || points < reward.cost}
                  onClick={() => onBuyReward(reward.id)}
                  aria-label={`Kup nagrodę: ${reward.title}, ${reward.cost} punktów`}
                >
                  {points !== null && points < reward.cost
                    ? `Brakuje ${reward.cost - points} pkt`
                    : 'Kup nagrodę'}
                </button>
                <TaskActionsMenu
                  itemTitle={reward.title}
                  itemType="nagrody"
                  disabled={buying || deletingId !== null || editingRewardId !== null}
                  actions={[
                    { label: 'Edytuj', onSelect: () => setEditingRewardId(reward.id) },
                    { label: 'Usuń', destructive: true, onSelect: () => void remove(reward) },
                  ]}
                />
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="reward-status" role="status">{deleteNotice}</p>
      {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
      </section>
      <RewardInventory purchases={purchases} onUsePurchase={onUsePurchase} />
    </div>
  )
}

export default RewardsPage
