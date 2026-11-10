package pl.questtodo.habit;

import pl.questtodo.goal.GoalEntryType;

import java.time.Instant;

public record HabitEntryResponse(long id, GoalEntryType type, String content, Instant createdAt, Instant updatedAt) {}
