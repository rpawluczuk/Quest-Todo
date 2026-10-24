import type { RefObject } from 'react'

export type GoalSection = 'milestones' | 'tasks' | 'habits'

export type GoalSectionActionHandle = {
  activate: () => void
  resetView?: () => void
}

export type GoalSectionActionProps = {
  actionTriggerRef?: RefObject<HTMLButtonElement | null>
  onActionDisabledChange?: (goalId: number, section: GoalSection, disabled: boolean) => void
}
