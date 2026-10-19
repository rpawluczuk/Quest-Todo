export function targetLabel(days: number): string {
  return days === 7 ? 'Codziennie' : `${days} ${days === 1 ? 'dzień' : 'dni'} w tygodniu`
}

export function formatHabitProgress(completed: number, target: number | null,
  period: 'week' | 'month' = 'week') {
  return {
    count: `${completed}/${target ?? '—'}`,
    period: period === 'week' ? 'dni w tygodniu' : 'dni w miesiącu',
  }
}
