import type { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

export default function SortableSubtask({ id, title, completed, disabled, children }: {
  id: number; title: string; completed: boolean; disabled: boolean; children: (handle: ReactNode) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled })
  return <li ref={setNodeRef} className={`${completed ? 'subtask-completed' : ''}${isDragging ? ' subtask-dragging' : ''}`}
    style={{ transform: CSS.Transform.toString(transform ? { ...transform, x: 0 } : null), transition }}>
    {children(<button ref={setActivatorNodeRef} type="button" className="subtask-grip" disabled={disabled}
      {...attributes} {...listeners} aria-label={`Zmień kolejność: ${title}`} title="Przeciągnij, aby zmienić kolejność">
      <GripVertical size={18} aria-hidden="true" />
    </button>)}
  </li>
}
