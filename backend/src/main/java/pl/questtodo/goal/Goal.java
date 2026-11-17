package pl.questtodo.goal;

import java.time.Instant;
import java.time.LocalDate;

public record Goal(long id, String title, String currentState, String desiredOutcome,
                   boolean completed, Instant completedAt, GoalReviewFrequency reviewFrequency,
                   LocalDate nextReviewDate, boolean reviewDue) {}
