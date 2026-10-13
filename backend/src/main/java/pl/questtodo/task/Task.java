package pl.questtodo.task;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

public record Task(
        long id,
        String title,
        int points,
        boolean completed,
        boolean inFocus,
        Instant completedAt,
        String description,
        LocalDate dueDate,
        LocalTime dueTime
) {
}
