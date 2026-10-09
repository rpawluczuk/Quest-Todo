import { useEffect, useState } from 'react'
import { createHabit, deleteHabit, getHabits, updateHabit } from '../api/habitApi'
import CreateHabitForm from '../components/CreateHabitForm'
import EditHabitForm from '../components/EditHabitForm'
import TaskActionsMenu from '../components/TaskActionsMenu'
import type { Habit } from '../types/Habit'

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    getHabits(controller.signal).then(loaded => {
      if (!controller.signal.aborted) setHabits(loaded)
    }).catch(() => {
      if (!controller.signal.aborted) setLoadError('Nie udało się pobrać nawyków. Odśwież stronę i spróbuj ponownie.')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [])

  async function add(name: string) {
    const habit = await createHabit(name)
    setHabits(current => [...current, habit])
  }

  async function save(id: number, name: string) {
    const updated = await updateHabit(id, name)
    setHabits(current => current.map(habit => habit.id === id ? updated : habit))
    setEditingId(null)
  }

  async function remove(id: number) {
    if (deletingId !== null) return
    setDeletingId(id)
    setDeleteError('')
    try {
      await deleteHabit(id)
      setHabits(current => current.filter(habit => habit.id !== id))
      setEditingId(current => current === id ? null : current)
    } catch (failure) {
      setDeleteError(failure instanceof Error ? failure.message : 'Nie udało się usunąć nawyku.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="tasks-section" aria-labelledby="habits-heading">
      <div className="section-header">
        <h2 id="habits-heading">Nawyki</h2>
        <p>Regularne czynności, które chcesz rozwijać.</p>
      </div>
      {loading && <p role="status">Ładowanie nawyków…</p>}
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {!loading && !loadError && <>
        <CreateHabitForm onAdd={add} />
        {habits.length === 0 && <p className="empty-state">Nie masz jeszcze nawyków.</p>}
        <ul className="task-list">
          {habits.map(habit => <li className={`task habit-card${editingId === habit.id ? ' habit-card-editing' : ''}`} key={habit.id}>
            {editingId === habit.id ? <EditHabitForm habit={habit}
              onSave={name => save(habit.id, name)} onCancel={() => setEditingId(null)} /> : <>
              <span className="task-title habit-name">{habit.name}</span>
              <TaskActionsMenu itemTitle={habit.name} itemType="nawyku"
                disabled={deletingId !== null || editingId !== null}
                actions={[
                  { label: 'Edytuj', onSelect: () => setEditingId(habit.id) },
                  { label: 'Usuń', destructive: true, onSelect: () => void remove(habit.id) },
                ]} />
            </>}
          </li>)}
        </ul>
        {deletingId !== null && <p className="reward-status" role="status">Usuwanie nawyku…</p>}
        {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
      </>}
    </section>
  )
}
