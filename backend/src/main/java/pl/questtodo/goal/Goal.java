package pl.questtodo.goal;

import java.time.Instant;

public record Goal(long id, String title, String currentState, String desiredOutcome,
                   boolean completed, Instant completedAt) {}
