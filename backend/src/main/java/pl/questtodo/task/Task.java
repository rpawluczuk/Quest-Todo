package pl.questtodo.task;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import pl.questtodo.category.Category;

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
        Category category,
        List<Long> goalIds,
        List<String> goalTitles
) {
    public Task withGoals(List<Long> ids, List<String> titles) {
        return new Task(id, title, points, completed, inFocus, completedAt, description, dueDate, dueTime, category,
                List.copyOf(ids), List.copyOf(titles));
    }
}
