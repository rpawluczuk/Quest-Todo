package pl.questtodo.task;

import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import java.math.BigDecimal;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.server.ResponseStatusException;

import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping
    public List<Task> getTasks() {
        return taskService.getTasks();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Task createTask(@Valid @RequestBody CreateTaskRequest request) {
        String title = request.title().strip();
        int points = request.points().intValueExact();
        return taskService.createTask(title, points);
    }

    @PatchMapping("/{id}")
    public Task updateTask(@PathVariable long id, @Valid @RequestBody UpdateTaskRequest request) {
        String title = request.title().strip();
        int points = request.points().intValueExact();
        return taskService.updateTask(id, title, points);
    }

    @PatchMapping("/{id}/completion")
    public Task updateCompletion(@PathVariable long id, @RequestBody UpdateCompletionRequest request) {
        if (request.completed() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pole completed jest wymagane.");
        }
        return taskService.updateCompletion(id, request.completed());
    }

    @PatchMapping("/{id}/focus")
    public Task updateFocus(@PathVariable long id, @RequestBody UpdateFocusRequest request) {
        if (request.inFocus() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pole inFocus jest wymagane.");
        }
        return taskService.updateFocus(id, request.inFocus());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTask(@PathVariable long id) {
        taskService.deleteTask(id);
    }
}
