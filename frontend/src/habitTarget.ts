export function targetLabel(days: number): string {
  return days === 7 ? 'Codziennie' : `${days} ${days === 1 ? 'dzień' : 'dni'} w tygodniu`
}
