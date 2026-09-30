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
      <section className="reward-inventory" aria-labelledby="inventory-heading">
        <h3 id="inventory-heading" ref={heading} tabIndex={-1}>Do wykorzystania</h3>
        {groups.size === 0 ? <p>Nie masz nagród do wykorzystania.</p> : (
          <ul className="task-list">
            {[...groups.entries()].map(([key, { purchase, count }]) => (
              <li className="task" key={key}>
                <span className="task-title">{purchase.title}</span>
                <div className="task-actions">
                  <span className="task-points" aria-label={`Dostępne sztuki: ${count}`}>×{count}</span>
                  <button
                    type="button"
                    className="secondary-button"
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
      {purchases.length > 0 && (
        <details className="reward-purchases">
          <summary>Historia zakupów ({purchases.length})</summary>
          <ul>
            {[...purchases].sort((a, b) => b.id - a.id).map((purchase) => (
              <li key={purchase.id}>
                <span>{purchase.title} — {purchase.cost} pkt</span>
                <div className="purchase-details">
                  Zakup: {purchase.purchasedAt
                    ? <time dateTime={purchase.purchasedAt}>{dateFormat.format(new Date(purchase.purchasedAt))}</time>
                    : 'data nieznana'}
                  {' · '}
                  {purchase.usedAt
                    ? <>Wykorzystano: <time dateTime={purchase.usedAt}>{dateFormat.format(new Date(purchase.usedAt))}</time></>
                    : 'Do wykorzystania'}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  )
}
