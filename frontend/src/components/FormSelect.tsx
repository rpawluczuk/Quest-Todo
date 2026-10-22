import { forwardRef, useCallback, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import * as Select from '@radix-ui/react-select'

type FormSelectProps = {
  readonly value: string
  readonly onValueChange: (value: string) => void
  readonly disabled?: boolean
  readonly required?: boolean
  readonly id?: string
  readonly ariaLabel: string
  readonly triggerContent: ReactNode
  readonly triggerClassName?: string
  readonly contentClassName?: string
  readonly onCloseAutoFocus?: ComponentProps<typeof Select.Content>['onCloseAutoFocus']
  readonly children: ReactNode
}

const FormSelect = forwardRef<HTMLButtonElement, FormSelectProps>(function FormSelect({ value, onValueChange,
  disabled = false, required = false, id, ariaLabel, triggerContent, triggerClassName = '', contentClassName = '',
  onCloseAutoFocus, children }, forwardedRef) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | undefined>(undefined)
  const localTrigger = useRef<HTMLButtonElement | null>(null)
  const setTrigger = useCallback((element: HTMLButtonElement | null) => {
    localTrigger.current = element
    if (typeof forwardedRef === 'function') forwardedRef(element)
    else if (forwardedRef) forwardedRef.current = element
  }, [forwardedRef])

  return <Select.Root value={value} disabled={disabled} onValueChange={onValueChange}
    onOpenChange={open => {
      if (open) setPortalContainer(localTrigger.current?.closest('dialog') ?? undefined)
    }}>
    <Select.Trigger ref={setTrigger} id={id}
      className={`category-select-trigger${triggerClassName ? ` ${triggerClassName}` : ''}`}
      aria-label={ariaLabel} aria-required={required || undefined}>
      <Select.Value asChild>
        <span className="category-select-trigger-value">{triggerContent}</span>
      </Select.Value>
      <Select.Icon className="category-select-chevron">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
      </Select.Icon>
    </Select.Trigger>
    <Select.Portal container={portalContainer}>
      <Select.Content
        className={`category-select-content${contentClassName ? ` ${contentClassName}` : ''}`}
        position="popper" sideOffset={4} collisionPadding={12} onCloseAutoFocus={onCloseAutoFocus}>
        <Select.Viewport className="category-select-viewport">{children}</Select.Viewport>
      </Select.Content>
    </Select.Portal>
  </Select.Root>
})

export function FormSelectItem({ value, children, leading, reserveLeadingSpace = false, showIndicator = true,
  className = '' }: {
  readonly value: string
  readonly children: ReactNode
  readonly leading?: ReactNode
  readonly reserveLeadingSpace?: boolean
  readonly showIndicator?: boolean
  readonly className?: string
}) {
  return <Select.Item className={`category-select-item${className ? ` ${className}` : ''}`} value={value}>
    {leading ?? (reserveLeadingSpace
      ? <span className="category-select-item-icon-placeholder" aria-hidden="true" />
      : null)}
    <Select.ItemText>{children}</Select.ItemText>
    {showIndicator && <Select.ItemIndicator className="category-select-indicator" aria-hidden="true">
      <svg viewBox="0 0 20 20"><path d="m4.5 10 3.5 3.5 7.5-8" /></svg>
    </Select.ItemIndicator>}
  </Select.Item>
}

export function FormSelectSeparator() {
  return <Select.Separator className="category-select-separator" />
}

export default FormSelect
