package pl.questtodo.goal;

import java.util.List;

public record AvailableGoalHabits(List<GoalHabit> habits, boolean hasMore) {}

