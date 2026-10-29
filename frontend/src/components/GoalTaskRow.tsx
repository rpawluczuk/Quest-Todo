import { useRef, useState } from 'react'
import type { Task } from '../types/Task'
import TaskSubtasks, { type TaskSubtasksHandle } from './TaskSubtasks'
import TaskActionsMenu from './TaskActionsMenu'
import IncompleteSubtasksDialog from './IncompleteSubtasksDialog'
import { useTaskSubtaskCounts } from './SubtaskProvider'
import { getTaskDuePresentation } from '../taskDue'

export default function GoalTaskRow({ task: sourceTask, disabled, readOnly, onToggle, onDetach }: {
  task: Task; disabled: boolean; readOnly: boolean
  onToggle: () => void; onDetach: () => void
}) {
  const { task, busy } = useTaskSubtaskCounts(sourceTask)
  const subtasks = useRef<TaskSubtasksHandle>(null)
  const [confirm, setConfirm] = useState(false)
  const due = getTaskDuePresentation(task)
  return <li className="goal-linked-task">
    <input type="checkbox" checked={task.completed} disabled={disabled || busy || confirm}
      aria-label={`Wykonane: ${task.title}`} onChange={() => {
        if (!task.completed && task.subtaskCount > task.completedSubtaskCount) setConfirm(true)
        else onToggle()
      }} />
    <span className={`goal-linked-item-title${task.completed ? ' goal-task-completed' : ''}`}>{task.title}</span>
    <div className="goal-linked-item-meta">
      {due && <span className={`goal-linked-task-due${due.overdue ? ' task-card-due-overdue' : ''}`}>{due.label}</span>}
      <span className="task-points task-card-points">{task.points} pkt</span>
    </div>
    <TaskActionsMenu itemTitle={task.title} disabled={disabled || busy || confirm} actions={[
      { label: 'Dodaj podzadanie', icon: 'list-plus', onSelect: () => subtasks.current?.openCreate() },
      { label: 'Odepnij od celu', onSelect: onDetach },
    ]} />
    <TaskSubtasks ref={subtasks} taskId={task.id} total={task.subtaskCount ?? 0} completed={task.completedSubtaskCount ?? 0}
      readOnly={readOnly} disabled={(!readOnly && disabled) || confirm}
      onBusyChange={() => {}} onCountsChange={() => {}} />
    {confirm && <IncompleteSubtasksDialog total={task.subtaskCount} completed={task.completedSubtaskCount}
      onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); onToggle() }} />}
  </li>
}
