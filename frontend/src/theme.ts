export type Theme = 'purple' | 'pink'

const storageKey = 'quest-todo-theme'

export function readTheme(): Theme {
  try {
    return localStorage.getItem(storageKey) === 'pink' ? 'pink' : 'purple'
  } catch {
    return 'purple'
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

export function saveTheme(theme: Theme) {
  applyTheme(theme)
  try {
    localStorage.setItem(storageKey, theme)
    return true
  } catch {
    return false
  }
}
