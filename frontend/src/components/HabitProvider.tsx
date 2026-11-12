import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createHabitStore } from '../habitStore'
import { changeHabitStatus, getHabits, getHabitEntries } from '../api/habitApi'
import { createHabitJournalStore } from '../habitJournal'

const Context = createContext<ReturnType<typeof createHabitStore> | null>(null)
const JournalContext = createContext<ReturnType<typeof createHabitJournalStore> | null>(null)
export function HabitProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createHabitStore(getHabits, changeHabitStatus))
  const [journal] = useState(() => createHabitJournalStore(getHabitEntries))
  return <Context.Provider value={store}><JournalContext.Provider value={journal}>{children}</JournalContext.Provider></Context.Provider>
}
export function useHabitJournalStore() {
  const store = useContext(JournalContext)
  if (!store) throw new Error('Missing HabitProvider')
  return store
}
export function useHabitStore() {
  const store = useContext(Context)
  if (!store) throw new Error('Missing HabitProvider')
  useSyncExternalStore(store.subscribe, store.revision)
  return store
}
