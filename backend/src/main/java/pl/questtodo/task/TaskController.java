package pl.questtodo.task;

import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.server.ResponseStatusException;

import jakarta.validation.Valid;
import pl.questtodo.task.dto.CreateTaskRequest;
import pl.questtodo.task.dto.UpdateCompletionRequest;
import pl.questtodo.task.dto.UpdateFocusRequest;
import pl.questtodo.task.dto.UpdateTaskRequest;

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
        validateDueDate(request.dueDate(), request.dueTime());
        String title = request.title().strip();
        int points = request.points().intValueExact();
        return taskService.createTask(title, points, normalizeDescription(request.description()), request.dueDate(),
                request.dueTime(), request.goalIds());
    }

    @PatchMapping("/{id}")
    public Task updateTask(@PathVariable long id, @Valid @RequestBody UpdateTaskRequest request) {
        validateDueDate(request.dueDate(), request.dueTime());
        String title = request.title().strip();
        int points = request.points().intValueExact();
        return taskService.updateTask(id, title, points, normalizeDescription(request.description()), request.description() != null,
                request.dueDate(), request.dueTime(), Boolean.TRUE.equals(request.clearDueDate()) || request.dueDate() != null || request.dueTime() != null,
                request.goalIds());
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

    @GetMapping("/overview")
    public TaskService.Overview overview() { return taskService.overview(); }

    @GetMapping("/history")
    public TaskService.History history(@org.springframework.web.bind.annotation.RequestParam(defaultValue = "0") int page) {
        return taskService.history(page);
    }

    @GetMapping("/{id}")
    public Task getTask(@PathVariable long id) { return taskService.getTask(id); }

    private static String normalizeDescription(String description) {
        if (description == null || description.isBlank()) return null;
        return description.strip();
    }

    private static void validateDueDate(java.time.LocalDate dueDate, java.time.LocalTime dueTime) {
        if (dueTime != null && dueDate == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Wybierz datę terminu przed ustawieniem godziny.");
        }
    }
}
