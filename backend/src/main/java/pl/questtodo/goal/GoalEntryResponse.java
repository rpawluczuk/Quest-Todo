package pl.questtodo.goal;

import java.time.Instant;

public record GoalEntryResponse(long id, GoalEntryType type, String content, Instant createdAt, Instant updatedAt) {}
