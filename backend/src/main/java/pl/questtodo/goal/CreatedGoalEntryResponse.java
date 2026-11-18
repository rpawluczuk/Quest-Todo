package pl.questtodo.goal;

import java.time.Instant;

/** The flag describes this POST transaction, not the entry's later history. */
public record CreatedGoalEntryResponse(long id, GoalEntryType type, String content,
        Instant createdAt, Instant updatedAt, boolean reviewCompleted) {
    public CreatedGoalEntryResponse(GoalEntryResponse entry, boolean reviewCompleted) {
        this(entry.id(), entry.type(), entry.content(), entry.createdAt(), entry.updatedAt(), reviewCompleted);
    }
}
