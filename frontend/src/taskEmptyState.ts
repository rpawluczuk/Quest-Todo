export type TaskEmptyState = {
  message: string
  icon?: 'target' | 'list'
  centered?: boolean
  prominent?: boolean
}

export function getTaskEmptyStates(focusCount: number, backlogCount: number, totalCount: number): {
  focus: TaskEmptyState
  backlog: TaskEmptyState
} {
  const hasNoActiveTasks = focusCount === 0 && backlogCount === 0
  const hasNoTasks = hasNoActiveTasks && totalCount === 0

  return {
    focus: {
      message: backlogCount > 0
        ? 'Wybierz zadanie z Backlogu i przenieś je do Focusu.'
        : 'Tutaj znajdą się zadania, na których chcesz się teraz skupić.',
      icon: hasNoTasks ? 'target' : undefined,
      centered: hasNoTasks || undefined,
    },
    backlog: hasNoTasks
      ? {
          message: 'Nie masz jeszcze zadań. Dodaj pierwsze, aby rozpocząć!',
          icon: 'list',
          prominent: true,
        }
      : {
          message: 'Backlog jest pusty. Dodaj nowe zadanie lub przenieś tutaj zadanie z Focusu.',
        },
  }
}
