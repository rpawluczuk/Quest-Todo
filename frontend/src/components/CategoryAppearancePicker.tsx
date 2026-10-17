import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { CategoryColor, CategoryIcon as CategoryIconName } from '../types/Category'
import CategoryIcon from './CategoryIcon'

const iconOptions: readonly [CategoryIconName, string][] = [
  ['HEART', 'Serce'], ['BRIEFCASE', 'Praca'], ['HOME', 'Dom'], ['BOOK', 'Książka'],
  ['DUMBBELL', 'Aktywność'], ['RUNNING', 'Bieganie'], ['UTENSILS', 'Jedzenie'],
  ['WALLET', 'Finanse'], ['PEOPLE', 'Relacje'], ['STAR', 'Gwiazda'], ['LEAF', 'Natura'],
  ['PLANE', 'Podróże'], ['MUSIC', 'Muzyka'], ['PALETTE', 'Twórczość'],
  ['CODE', 'Programowanie'], ['MOON', 'Sen'], ['SUN', 'Słońce'], ['CAR', 'Samochód'],
  ['SHOPPING_CART', 'Zakupy'], ['OTHER', 'Inne'],
]

const colorOptions: readonly [CategoryColor, string][] = [
  ['RED', 'Czerwony'], ['ORANGE', 'Pomarańczowy'], ['AMBER', 'Bursztynowy'],
  ['YELLOW', 'Żółty'], ['LIME', 'Limonkowy'], ['GREEN', 'Zielony'],
  ['EMERALD', 'Szmaragdowy'], ['TEAL', 'Morski'], ['CYAN', 'Cyjan'], ['SKY', 'Błękitny'],
  ['BLUE', 'Niebieski'], ['INDIGO', 'Indygo'], ['PURPLE', 'Fioletowy'],
  ['VIOLET', 'Purpurowy'], ['FUCHSIA', 'Fuksja'], ['PINK', 'Różowy'], ['ROSE', 'Różany'],
  ['BROWN', 'Brązowy'], ['SLATE', 'Grafitowy'], ['GRAY', 'Szary'],
]

export default function CategoryAppearancePicker({ icon, color, disabled, popover = false,
  onIconChange, onColorChange }: {
  readonly icon: CategoryIconName
  readonly color: CategoryColor
  readonly disabled: boolean
  readonly popover?: boolean
  readonly onIconChange: (icon: CategoryIconName) => void
  readonly onColorChange: (color: CategoryColor) => void
}) {
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const iconTrigger = useRef<HTMLButtonElement>(null)
  const colorTrigger = useRef<HTMLButtonElement>(null)
  const iconGrid = useRef<HTMLDivElement>(null)
  const colorGrid = useRef<HTMLDivElement>(null)
  const iconGridId = useId()
  const colorGridId = useId()

  useEffect(() => {
    if (!iconPickerOpen && !colorPickerOpen) return
    function closeOnOutsideClick(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) {
        setIconPickerOpen(false)
        setColorPickerOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [iconPickerOpen, colorPickerOpen])

  useLayoutEffect(() => {
    if (!popover || (!iconPickerOpen && !colorPickerOpen)) return
    const grid = iconPickerOpen ? iconGrid.current : colorGrid.current
    const trigger = iconPickerOpen ? iconTrigger.current : colorTrigger.current
    if (!grid || !trigger) return

    function positionPopover() {
      if (!grid || !trigger) return
      const viewportMargin = 12
      const triggerGap = 6
      const width = Math.min(272, window.innerWidth - viewportMargin * 2)
      const maxHeight = Math.min(230, window.innerHeight - viewportMargin * 2)
      grid.style.width = `${width}px`
      grid.style.maxHeight = `${maxHeight}px`

      const triggerRect = trigger.getBoundingClientRect()
      const popoverHeight = grid.getBoundingClientRect().height
      const spaceBelow = window.innerHeight - triggerRect.bottom - viewportMargin
      const spaceAbove = triggerRect.top - viewportMargin
      const opensAbove = spaceBelow < popoverHeight + triggerGap && spaceAbove > spaceBelow
      const preferredTop = opensAbove
        ? triggerRect.top - popoverHeight - triggerGap
        : triggerRect.bottom + triggerGap
      const preferredLeft = iconPickerOpen ? triggerRect.left : triggerRect.right - width

      grid.style.top = `${Math.max(viewportMargin,
        Math.min(preferredTop, window.innerHeight - popoverHeight - viewportMargin))}px`
      grid.style.left = `${Math.max(viewportMargin,
        Math.min(preferredLeft, window.innerWidth - width - viewportMargin))}px`
      grid.style.visibility = 'visible'
    }

    positionPopover()
    window.addEventListener('resize', positionPopover)
    window.addEventListener('scroll', positionPopover, true)
    return () => {
      window.removeEventListener('resize', positionPopover)
      window.removeEventListener('scroll', positionPopover, true)
    }
  }, [popover, iconPickerOpen, colorPickerOpen])

  return <div className={`category-creator-options${popover ? ' category-creator-options-popover' : ''}`} ref={container}>
    <div className="form-field category-icon-field">
      <span>Symbol</span>
      <button ref={iconTrigger} type="button" className="category-icon-trigger" disabled={disabled}
        aria-expanded={iconPickerOpen} aria-controls={iconGridId}
        aria-label={`Wybierz symbol. Wybrano: ${iconOptions.find(([value]) => value === icon)?.[1] ?? 'Inne'}`}
        onClick={() => { setColorPickerOpen(false); setIconPickerOpen(open => !open) }}
        onKeyDown={event => {
          if (event.key === 'Escape' && iconPickerOpen) { event.preventDefault(); setIconPickerOpen(false) }
        }}>
        <CategoryIcon icon={icon} color={color} />
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
      </button>
    </div>
    <div className="form-field category-color-field">
      <span>Kolor</span>
      <button ref={colorTrigger} type="button" className="category-color-trigger" disabled={disabled}
        aria-expanded={colorPickerOpen} aria-controls={colorGridId}
        aria-label={`Wybierz kolor. Wybrano: ${colorOptions.find(([value]) => value === color)?.[1] ?? 'Fioletowy'}`}
        onClick={() => { setIconPickerOpen(false); setColorPickerOpen(open => !open) }}
        onKeyDown={event => {
          if (event.key === 'Escape' && colorPickerOpen) { event.preventDefault(); setColorPickerOpen(false) }
        }}>
        <span className={`category-color-swatch category-color-swatch-${color.toLowerCase()}`} aria-hidden="true" />
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
      </button>
    </div>
    {iconPickerOpen && <div ref={iconGrid} id={iconGridId}
      className={`category-icon-grid${popover ? ' category-appearance-popover' : ''}`}
      role="group" aria-label="Dostępne symbole"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); setIconPickerOpen(false); iconTrigger.current?.focus() }
      }}>
      {iconOptions.map(([value, label]) => <button key={value} type="button"
        className={`category-icon-option${icon === value ? ' selected' : ''}`}
        aria-label={label} aria-pressed={icon === value} title={label}
        onClick={() => { onIconChange(value); setIconPickerOpen(false); iconTrigger.current?.focus() }}>
        <CategoryIcon icon={value} color={color} />
      </button>)}
    </div>}
    {colorPickerOpen && <div ref={colorGrid} id={colorGridId}
      className={`category-color-grid${popover ? ' category-appearance-popover' : ''}`}
      role="group" aria-label="Dostępne kolory"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); setColorPickerOpen(false); colorTrigger.current?.focus() }
      }}>
      {colorOptions.map(([value, label]) => <button key={value} type="button"
        className={`category-color-option${color === value ? ' selected' : ''}`}
        aria-label={label} aria-pressed={color === value} title={label}
        onClick={() => { onColorChange(value); setColorPickerOpen(false); colorTrigger.current?.focus() }}>
        <span className={`category-color-swatch category-color-swatch-${value.toLowerCase()}`} aria-hidden="true" />
      </button>)}
    </div>}
  </div>
}
