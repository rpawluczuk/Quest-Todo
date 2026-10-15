package pl.questtodo.habit;

import java.time.LocalDate;
import java.util.List;

public record Habit(long id, String name, LocalDate createdOn, boolean completed,
                    HabitTarget target, HabitTarget latestTarget, long weeklyCompletedDays, int rewardPoints,
                    boolean weeklyRewardGranted, String description, LocalDate startDate, LocalDate endDate, Integer completionLimit,
                    long totalCompletions, String status, LocalDate endedOn, HabitEndReason endReason,
                    List<Long> goalIds,
                    List<String> goalTitles) {
    public Habit withGoals(List<Long> ids, List<String> titles) {
        return new Habit(id, name, createdOn, completed, target, latestTarget, weeklyCompletedDays, rewardPoints,
                weeklyRewardGranted, description, startDate, endDate, completionLimit, totalCompletions, status,
                endedOn, endReason, List.copyOf(ids), List.copyOf(titles));
    }
}
