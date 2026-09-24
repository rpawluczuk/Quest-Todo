package pl.questtodo.task;

import java.time.Instant;

public record Task(
        long id,
        String title,
        int points,
        boolean completed,
        boolean inFocus,
        Instant completedAt
) {
}
