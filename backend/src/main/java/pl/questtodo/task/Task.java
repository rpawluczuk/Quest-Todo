package pl.questtodo.task;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record Task(
        long id,
        String title,
        int points,
        boolean completed,
        boolean inFocus,
        Instant completedAt,
        String description,
        LocalDate dueDate,
        LocalTime dueTime,
        List<String> goalTitles
) {
    public Task withGoalTitles(List<String> titles) {
        return new Task(id, title, points, completed, inFocus, completedAt, description, dueDate, dueTime,
                List.copyOf(titles));
    }
}
