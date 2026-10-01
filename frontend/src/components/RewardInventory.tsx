import { useRef, useState } from 'react'
import type { Purchase } from '../api/userApi'

type RewardInventoryProps = {
  readonly purchases: readonly Purchase[]
  readonly onUsePurchase: (id: number) => Promise<void>
}

const dateFormat = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'short' })

export default function RewardInventory({ purchases, onUsePurchase }: RewardInventoryProps) {
  const [usingId, setUsingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const using = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const groups = new Map<string, { purchase: Purchase; count: number }>()

  // IDs also preserve purchase order for legacy records with no purchase date.
  for (const purchase of [...purchases].sort((a, b) => a.id - b.id)) {
    if (purchase.usedAt) continue
    const key = JSON.stringify([purchase.rewardId, purchase.title])
    const group = groups.get(key)
    if (group) group.count++
    else groups.set(key, { purchase, count: 1 })
  }

  const availableCount = [...groups.values()].reduce((total, group) => total + group.count, 0)

  async function redeem(purchase: Purchase) {
    if (using.current) return
    using.current = true
    setUsingId(purchase.id)
    setError('')
    setNotice('')
    try {
      await onUsePurchase(purchase.id)
      setNotice(`Wykorzystano: ${purchase.title}.`)
      heading.current?.focus({ preventScroll: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się wykorzystać nagrody. Spróbuj ponownie.')
    } finally {
      using.current = false
      setUsingId(null)
    }
  }

  return (
    <>
      <section className="tasks-section reward-inventory" aria-labelledby="inventory-heading">
        <div className="section-header">
          <h2 id="inventory-heading" ref={heading} tabIndex={-1}>Do wykorzystania ({availableCount})</h2>
        </div>
        {groups.size === 0 ? <p>Nie masz nagród do wykorzystania.</p> : (
          <ul className="task-list">
            {[...groups.entries()].map(([key, { purchase, count }]) => (
              <li className="task purchased-reward-card" key={key}>
                <span className="task-title purchased-reward-title">{purchase.title}</span>
                <div className="purchased-reward-actions">
                  <span className="task-points" aria-label={`Dostępne sztuki: ${count}`}>×{count}</span>
                  <button
                    type="button"
                    className="secondary-button purchased-reward-use-button"
                    aria-label={`Wykorzystaj: ${purchase.title}`}
                    disabled={usingId !== null}
                    onClick={() => void redeem(purchase)}
                  >
                    {usingId === purchase.id ? 'Zapisywanie…' : 'Wykorzystaj'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="reward-status" role="status">{notice}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
      <details className="tasks-section reward-purchases">
          <summary>Historia zakupów ({purchases.length})</summary>
          {purchases.length > 0 && <div className="purchase-history-list" role="list">
            {[...purchases].sort((a, b) => b.id - a.id).map((purchase) => (
              <div className="purchase-history-entry" role="listitem" key={purchase.id}>
                <div className="purchase-history-main">
                  <span className="purchase-history-title">{purchase.title}</span>
                  <span className="purchase-history-cost">{purchase.cost} pkt</span>
                </div>
                <div className="purchase-details">
                  <span>Kupiono: {purchase.purchasedAt
                    ? <time dateTime={purchase.purchasedAt}>{dateFormat.format(new Date(purchase.purchasedAt))}</time>
                    : 'data nieznana'}</span>
                  {purchase.usedAt ? (
                    <span>Wykorzystano: <time dateTime={purchase.usedAt}>{dateFormat.format(new Date(purchase.usedAt))}</time></span>
                  ) : <span className="purchase-available-status">Do wykorzystania</span>}
                </div>
              </div>
            ))}
          </div>}
        </details>
    </>
  )
}
