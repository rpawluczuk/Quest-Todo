package pl.questtodo.goal;

import java.util.List;
import pl.questtodo.task.Task;

public record AvailableGoalTasks(List<Task> tasks, boolean hasMore) {}
