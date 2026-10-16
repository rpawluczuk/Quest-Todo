import type { Category } from './types/Category'

export const categoriesChangedEvent = 'quest-todo:categories-changed'

export type CategoryMutation =
  | { type: 'upsert'; category: Category }
  | { type: 'delete'; id: number }

export function notifyCategoriesChanged() {
  window.dispatchEvent(new Event(categoriesChangedEvent))
}
