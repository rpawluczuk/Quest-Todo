package pl.questtodo.habit;

import java.time.LocalDate;

public record Habit(long id, String name, LocalDate createdOn, boolean completed,
                    HabitTarget target, HabitTarget latestTarget, long weeklyCompletedDays, int rewardPoints,
                    boolean weeklyRewardGranted, String description, LocalDate startDate, LocalDate endDate, Integer completionLimit,
                    long totalCompletions, String status, LocalDate endedOn, HabitEndReason endReason) {}
