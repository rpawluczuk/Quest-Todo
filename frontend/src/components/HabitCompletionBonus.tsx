import { Trophy } from 'lucide-react'
import type { Habit } from '../types/Habit'
import { habitEndDateLabel } from '../habitSchedule'

const percent = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 })

export default function HabitCompletionBonus({ habit, today }: { habit: Habit; today: string }) {
  if (habit.completionBonusPoints === null || (!habit.endDate && habit.completionLimit === null)) return null
  const dated = habit.endDate !== null
  const regularity = habit.regularity
  const result = habit.completionBonusGranted ? 'Premia przyznana'
    : habit.completionBonusSettledOn ? 'Premia nieprzyznana'
    : habit.endedOn ? 'Premia nieprzyznana'
    : dated && habit.endDate! < today ? 'Premia oczekuje na rozliczenie'
    : 'Premia możliwa do zdobycia'
  return <div className="habit-completion-bonus-row">
    <div className="habit-completion-bonus-details">
      <Trophy className="habit-completion-bonus-icon" size={16} strokeWidth={2} aria-hidden="true" />
      <div className="habit-completion-bonus-copy">
        <span>{dated ? `Do ${habitEndDateLabel(habit.endDate!, today)} · próg ${habit.requiredSuccessPercent}%`
          : `${habit.totalCompletions}/${habit.completionLimit} wykonań`}</span>
        <small>{dated ? regularity && regularity.totalWeeks > 0 && regularity.successPercent !== null
          ? `Regularność: ${regularity.successfulWeeks}/${regularity.totalWeeks} tyg. (${percent.format(regularity.successPercent)}%)`
          : 'Regularność: jeszcze nie oceniono'
          : 'Premia za ukończenie'}</small>
        {dated && (habit.completionBonusGranted || habit.completionBonusSettledOn || habit.endedOn)
          && <small>{result}</small>}
      </div>
    </div>
    <span className="task-points task-card-points" title={result}
      aria-label={`${result}: ${habit.completionBonusPoints} pkt`}>+{habit.completionBonusPoints} pkt</span>
  </div>
}
