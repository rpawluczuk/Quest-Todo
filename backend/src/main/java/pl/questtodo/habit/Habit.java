package pl.questtodo.habit;

import java.time.LocalDate;
import java.util.List;
import pl.questtodo.category.Category;

public record Habit(long id, String name, LocalDate createdOn, boolean completed,
                    HabitTarget target, HabitTarget latestTarget, long weeklyCompletedDays, int rewardPoints,
                    boolean weeklyRewardGranted, String description, LocalDate startDate, LocalDate endDate, Integer completionLimit,
                    Integer completionBonusPoints, Integer requiredSuccessPercent,
                    long totalCompletions, String status, LocalDate endedOn, HabitEndReason endReason,
                    Category category,
                    List<Long> goalIds,
                    List<String> goalTitles, HabitRegularity regularity,
                    boolean completionBonusGranted, LocalDate completionBonusSettledOn,
                    Boolean completionBonusEverGranted, boolean completionBonusConditionsLocked, Integer completionBonusAwardPoints) {
    public Habit withGoals(List<Long> ids, List<String> titles) {
        return new Habit(id, name, createdOn, completed, target, latestTarget, weeklyCompletedDays, rewardPoints,
                weeklyRewardGranted, description, startDate, endDate, completionLimit,
                completionBonusPoints, requiredSuccessPercent, totalCompletions, status,
                endedOn, endReason, category, List.copyOf(ids), List.copyOf(titles),
                regularity, completionBonusGranted, completionBonusSettledOn,
                completionBonusEverGranted, completionBonusConditionsLocked, completionBonusAwardPoints);
    }
    public Habit withCompletionBonus(HabitRegularity regularity, boolean granted, LocalDate settledOn,
            Boolean everGranted, boolean locked, Integer awardPoints) {
        return new Habit(id, name, createdOn, completed, target, latestTarget, weeklyCompletedDays, rewardPoints,
                weeklyRewardGranted, description, startDate, endDate, completionLimit,
                completionBonusPoints, requiredSuccessPercent, totalCompletions, status,
                endedOn, endReason, category, goalIds, goalTitles, regularity, granted, settledOn, everGranted, locked, awardPoints);
    }
}
