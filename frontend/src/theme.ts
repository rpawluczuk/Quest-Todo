export type Theme = 'purple' | 'pink'

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}
