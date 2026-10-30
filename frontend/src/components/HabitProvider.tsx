import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createHabitStore } from '../habitStore'
import { changeHabitStatus, getHabits } from '../api/habitApi'

const Context = createContext<ReturnType<typeof createHabitStore> | null>(null)
export function HabitProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createHabitStore(getHabits, changeHabitStatus))
  return <Context.Provider value={store}>{children}</Context.Provider>
}
export function useHabitStore() {
  const store = useContext(Context)
  if (!store) throw new Error('Missing HabitProvider')
  useSyncExternalStore(store.subscribe, store.revision)
  return store
}
