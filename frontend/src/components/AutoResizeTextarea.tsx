import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }

export default function AutoResizeTextarea({ value, ...props }: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const element = textarea.current
    if (!element) return

    const resize = () => {
      element.style.height = 'auto'
      element.style.height = `${element.scrollHeight}px`
    }

    resize()
    let width = element.clientWidth
    const observer = new ResizeObserver(() => {
      const nextWidth = element.clientWidth
      if (nextWidth === width) return
      width = nextWidth
      resize()
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [value])

  return <textarea ref={textarea} value={value} rows={3} {...props} />
}
