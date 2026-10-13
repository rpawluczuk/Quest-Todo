import type { Task } from './types/Task'

export type TaskDuePresentation = {
  label: string
  overdue: boolean
}

function parseDate(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number)
  return { year, month, day }
}

function dayNumber(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) / 86_400_000
}

function formatDate(value: string, currentYear: number): string {
  const { year, month, day } = parseDate(value)
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    day: 'numeric',
    month: 'short',
    ...(year === currentYear ? {} : { year: 'numeric' }),
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}

function warsawNow(now: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)!.value)
  return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour'), minute: value('minute') }
}

export function getTaskDuePresentation(
  task: Pick<Task, 'dueDate' | 'dueTime' | 'completed'>,
  now = new Date(),
): TaskDuePresentation | null {
  if (!task.dueDate) return null

  const due = parseDate(task.dueDate)
  const current = warsawNow(now)
  const todayNumber = dayNumber(current.year, current.month, current.day)
  const dueNumber = dayNumber(due.year, due.month, due.day)
  const time = task.dueTime?.slice(0, 5) ?? ''
  const currentMinutes = current.hour * 60 + current.minute
  const dueMinutes = time ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) : null
  const overdue = !task.completed && (dueNumber < todayNumber ||
    (dueNumber === todayNumber && dueMinutes !== null && currentMinutes > dueMinutes))

  let dateLabel: string
  if (dueNumber === todayNumber) dateLabel = 'Dzisiaj'
  else if (dueNumber === todayNumber + 1) dateLabel = 'Jutro'
  else dateLabel = formatDate(task.dueDate, current.year)

  const label = `${dateLabel}${time ? `, ${time}` : ''}`
  return { label: overdue ? `Po terminie · ${label}` : label, overdue }
}
