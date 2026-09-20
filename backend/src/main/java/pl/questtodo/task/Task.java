package pl.questtodo.task;

public record Task(
        long id,
        String title,
        int points,
        boolean completed,
        boolean inFocus
) {
}
