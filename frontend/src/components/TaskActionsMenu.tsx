import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

type TaskMenuIconName = 'pencil' | 'arrow-down' | 'arrow-up' | 'trash-2'

type TaskMenuAction = {
  readonly label: string
  readonly onSelect: () => void
  readonly destructive?: boolean
  readonly icon?: TaskMenuIconName
}

type TaskActionsMenuProps = {
  readonly itemTitle: string
  readonly itemType?: 'zadania' | 'nagrody' | 'nawyku' | 'celu'
  readonly disabled: boolean
  readonly actions: readonly TaskMenuAction[]
}

const taskMenuIconPaths: Record<TaskMenuIconName, ReactNode> = {
  pencil: (
    <>
      <path d="M21.17 6.81a1 1 0 0 0-3.98-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.36a.5.5 0 0 0 .62.62L7 20.66a2 2 0 0 0 .83-.5Z" />
      <path d="m15 5 4 4" />
    </>
  ),
  'arrow-down': (
    <>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </>
  ),
  'arrow-up': (
    <>
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </>
  ),
  'trash-2': (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <path d="m19 6-1 14c0 1-1 2-2 2H8c-1 0-2-1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </>
  ),
}

const TaskMenuIcon = ({ name }: { readonly name: TaskMenuIconName }) => (
  <svg
    aria-hidden="true"
    className="task-menu-item-icon"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
  >
    {taskMenuIconPaths[name]}
  </svg>
)

export default function TaskActionsMenu({ itemTitle, itemType = 'zadania', disabled, actions }: TaskActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuId = useId()
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const initialItem = useRef(0)
  const open = isOpen && !disabled

  function close(restoreFocus = false) {
    setIsOpen(false)
    if (restoreFocus) trigger.current?.focus()
  }

  useLayoutEffect(() => {
    if (!open || !menu.current) return
    const panel = menu.current
    if (panel.getBoundingClientRect().bottom > window.innerHeight - 8) {
      panel.style.top = 'auto'
      panel.style.bottom = 'calc(100% + 4px)'
    }
    panel.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[initialItem.current]?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  function handleMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    let next: number
    switch (event.key) {
      case 'ArrowDown': next = (index + 1) % items.length; break
      case 'ArrowUp': next = (index - 1 + items.length) % items.length; break
      case 'Home': next = 0; break
      case 'End': next = items.length - 1; break
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        close(true)
        return
      case 'Tab':
        // Continue normal tab navigation from the trigger, outside the menu.
        close(true)
        return
      default: return
    }
    event.preventDefault()
    items[next]?.focus()
  }

  return (
    <div
      className="task-menu"
      ref={container}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close()
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="task-menu-trigger"
        aria-label={`Więcej opcji dla ${itemType} „${itemTitle}”`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation()
          initialItem.current = 0
          setIsOpen(!open)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            initialItem.current = event.key === 'ArrowUp' ? actions.length - 1 : 0
            setIsOpen(true)
          }
        }}
      >
        <span aria-hidden="true">⋮</span>
      </button>
      {open && (
        <div ref={menu} id={menuId} className="task-menu-panel" role="menu" aria-label={`Akcje ${itemType}: ${itemTitle}`} onKeyDown={handleMenuKey}>
          {actions.map((action, index) => (
            <Fragment key={action.label}>
              {action.destructive && index > 0 && <div className="task-menu-separator" role="separator" />}
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={action.destructive ? 'task-menu-item task-menu-item-danger' : 'task-menu-item'}
                onClick={(event) => {
                  event.stopPropagation()
                  close(true)
                  action.onSelect()
                }}
              >
                {action.icon ? <TaskMenuIcon name={action.icon} /> : null}
                <span>{action.label}</span>
              </button>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}
