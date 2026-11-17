import type { Goal } from './types/Goal.ts'

// Page-owned data, with request ordering shared by list reads, detail reads and writes.
export function createGoalState() {
  let goals: Goal[] = []
  let sequence = 0
  let latestList = 0
  const versions = new Map<number, number>()
  const listeners = new Set<() => void>()
  function publish(next: Goal[]) { goals = next; listeners.forEach(listener => listener()) }
  return {
    get: () => goals,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    beginList() { latestList = ++sequence; return latestList },
    isLatestList(ticket: number) { return ticket === latestList },
    acceptList(ticket: number, incoming: Goal[]) {
      if (ticket !== latestList) return false
      const current = new Map(goals.map(goal => [goal.id, goal]))
      const result: Goal[] = []
      for (const goal of incoming) {
        if ((versions.get(goal.id) ?? 0) > ticket) {
          const newer = current.get(goal.id)
          if (newer) result.push(newer)
        } else { result.push(goal); versions.set(goal.id, ticket) }
        current.delete(goal.id)
      }
      for (const goal of current.values()) {
        if ((versions.get(goal.id) ?? 0) > ticket) result.push(goal)
        else versions.set(goal.id, ticket)
      }
      publish(result)
      return true
    },
    beginRead(id: number) { const ticket = ++sequence; versions.set(id, ticket); return ticket },
    isCurrent(id: number, ticket: number) { return versions.get(id) === ticket },
    acceptRead(id: number, ticket: number, goal: Goal) {
      if (versions.get(id) !== ticket || goal.id !== id) return false
      publish(goals.map(current => current.id === id ? goal : current))
      return true
    },
    put(goal: Goal) {
      versions.set(goal.id, ++sequence)
      publish(goals.some(current => current.id === goal.id)
        ? goals.map(current => current.id === goal.id ? goal : current) : [...goals, goal])
    },
    remove(id: number) {
      versions.set(id, ++sequence) // Keep a tombstone so an old list cannot resurrect a deleted goal.
      publish(goals.filter(goal => goal.id !== id))
    },
  }
}
