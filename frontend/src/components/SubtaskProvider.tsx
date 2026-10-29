import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createSubtaskStore } from '../subtaskStore'
import { getSubtasks } from '../api/subtaskApi'
import type { Task } from '../types/Task'

const Context = createContext<ReturnType<typeof createSubtaskStore> | null>(null)
export function SubtaskProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createSubtaskStore(getSubtasks))
  return <Context.Provider value={store}>{children}</Context.Provider>
}
export function useSubtasks(taskId: number) {
  const store = useContext(Context)
  if (!store) throw new Error('Missing SubtaskProvider')
  const snapshot = useSyncExternalStore(store.subscribe, () => store.get(taskId))
  return { store, ...snapshot }
}
export function useTaskSubtaskCounts(task: Task) {
  const { items, owner } = useSubtasks(task.id)
  return { task: items ? { ...task, subtaskCount: items.length,
    completedSubtaskCount: items.filter(item => item.completed).length } : task, busy: owner !== null }
}
