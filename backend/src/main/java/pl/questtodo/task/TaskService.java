package pl.questtodo.task;

import java.util.List;

import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class TaskService {
    private final TaskRepository taskRepository;

    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    @Transactional(readOnly = true)
    public List<Task> getTasks() {
        return taskRepository.findAll(Sort.by("id")).stream()
                .map(TaskEntity::toTask)
                .toList();
    }

    public Task createTask(String title, int points) {
        return taskRepository.save(new TaskEntity(title, points)).toTask();
    }

    public Task updateCompletion(long id, boolean completed) {
        TaskEntity task = findForUpdate(id);
        task.setCompleted(completed);
        return task.toTask();
    }

    public Task updateFocus(long id, boolean inFocus) {
        TaskEntity task = findForUpdate(id);
        task.setInFocus(inFocus);
        return task.toTask();
    }

    public Task updateTask(long id, String title, int points) {
        TaskEntity task = findForUpdate(id);
        if (task.isCompleted()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Nie można edytować wykonanego zadania.");
        }
        task.updateDetails(title, points);
        return task.toTask();
    }

    public void deleteTask(long id) {
        taskRepository.delete(findForUpdate(id));
    }

    private TaskEntity findForUpdate(long id) {
        return taskRepository.findForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zadanie nie istnieje."));
    }
}
