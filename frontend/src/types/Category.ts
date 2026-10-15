export type CategoryIcon =
  | 'HEART' | 'BRIEFCASE' | 'HOME' | 'BOOK' | 'DUMBBELL'
  | 'WALLET' | 'PEOPLE' | 'STAR' | 'LEAF' | 'RUNNING'
  | 'UTENSILS' | 'PLANE' | 'MUSIC' | 'PALETTE' | 'CODE'
  | 'MOON' | 'SUN' | 'CAR' | 'SHOPPING_CART' | 'OTHER'

export type CategoryColor =
  | 'RED' | 'ORANGE' | 'AMBER' | 'YELLOW' | 'LIME'
  | 'GREEN' | 'EMERALD' | 'TEAL' | 'CYAN' | 'SKY'
  | 'BLUE' | 'INDIGO' | 'PURPLE' | 'VIOLET' | 'FUCHSIA'
  | 'PINK' | 'ROSE' | 'BROWN' | 'SLATE' | 'GRAY'

export type Category = {
  id: number
  name: string
  icon: CategoryIcon
  color: CategoryColor
}
