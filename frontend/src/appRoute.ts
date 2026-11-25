export type MainPage = 'tasks' | 'habits' | 'goals' | 'rewards'
export type AppRoute = { page: MainPage } | { page: 'habit-history'; habitId: number | null; year: number | null }

export function readAppRoute(location: Pick<Location, 'pathname' | 'search'>): AppRoute {
  const match = /^\/habits\/([^/]+)\/history\/?$/.exec(location.pathname)
  if (match) {
    const id = Number(match[1])
    const years = new URLSearchParams(location.search).getAll('year')
    const value = years[0] ?? ''
    const year = /^\d{1,4}$/.test(value) ? Number(value) : 0
    return { page: 'habit-history', habitId: /^\d+$/.test(match[1]) && Number.isSafeInteger(id) && id > 0 ? id : null,
      year: years.length === 1 && year >= 1 && year <= 9999 ? year : null }
  }
  if (location.pathname === '/habits') return { page: 'habits' }
  if (location.pathname === '/goals') return { page: 'goals' }
  if (location.pathname === '/rewards') return { page: 'rewards' }
  return { page: 'tasks' }
}

export function mainPagePath(page: MainPage): string { return page === 'tasks' ? '/' : `/${page}` }
export function habitHistoryPath(id: number, year: number): string { return `/habits/${id}/history?year=${year}` }
