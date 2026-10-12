import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }

export default function AutoResizeTextarea({ value, ...props }: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const element = textarea.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [value])

  return <textarea ref={textarea} value={value} rows={3} {...props} />
}
