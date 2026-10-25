package pl.questtodo.task;

import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** Enriches an entire page with one aggregate query, without loading subtasks. */
@Component
public class TaskResponseMapper {
    private final SubtaskRepository subtasks;

    public TaskResponseMapper(SubtaskRepository subtasks) { this.subtasks = subtasks; }

    public List<Task> toTasks(List<TaskEntity> entities) {
        if (entities.isEmpty()) return List.of();
        var counts = subtasks.countByTaskIds(entities.stream().map(TaskEntity::getId).toList())
                .stream().collect(Collectors.toMap(SubtaskRepository.Counts::getTaskId, Function.identity()));
        return entities.stream().map(entity -> {
            var count = counts.get(entity.getId());
            return entity.toTask(count == null ? 0 : count.getTotal(), count == null ? 0 : count.getCompleted());
        }).toList();
    }

    public Task toTask(TaskEntity entity) { return toTasks(List.of(entity)).getFirst(); }
}
