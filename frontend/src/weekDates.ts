export function startOfWeek(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7)
  return monday
}

export function weekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday)
    day.setDate(day.getDate() + index)
    return day
  })
}

export function moveWeek(monday: Date, direction: -1 | 1, today: Date): Date {
  const next = startOfWeek(monday)
  next.setDate(next.getDate() + direction * 7)
  const current = startOfWeek(today)
  return next > current ? current : next
}
