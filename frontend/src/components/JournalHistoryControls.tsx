import type { createGoalJournalStore } from '../goalJournal'

export default function JournalHistoryControls({ id, store, onShowLess }: {
  id: number; store: ReturnType<typeof createGoalJournalStore>; onShowLess: () => void
}) {
  // The container subscribes to this same snapshot along with the entry list.
  const { data, full, history, historyLoading, historyError, busy } = store.get(id)
  return <>
    {full && historyLoading && <p role="status" className="goal-journal-total">Ładowanie historii…</p>}
    {full && historyError && <div><p className="form-error" role="alert">{historyError}</p>
      <button type="button" className="goal-picker-link" disabled={busy || historyLoading}
        onClick={() => { void store.more(id) }}>Spróbuj ponownie</button>
    </div>}
    {data && data.totalElements > 3 && <div className="goal-journal-history-actions">
      {!full ? <button type="button" className="goal-picker-link" disabled={busy || historyLoading}
        onClick={() => { void store.showHistory(id) }}>Pokaż wszystkie wpisy ({data.totalElements})</button>
        : <>
          {history?.hasMore && !historyError && <button type="button" className="goal-picker-link"
            disabled={busy || historyLoading} onClick={() => { void store.more(id) }}>
            {historyLoading ? 'Ładowanie…' : 'Pokaż więcej wpisów'}
          </button>}
          <button type="button" className="goal-picker-link" disabled={busy} onClick={onShowLess}>Pokaż mniej</button>
        </>}
    </div>}
  </>
}
