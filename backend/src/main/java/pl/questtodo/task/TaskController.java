package pl.questtodo.task;

import java.util.List;
import java.math.BigDecimal;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.server.ResponseStatusException;

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
    public Task createTask(@RequestBody CreateTaskRequest request) {
        int points = validateTask(request.title(), request.points());
        return taskService.createTask(request.title().strip(), points);
    }

    @PatchMapping("/{id}")
    public Task updateTask(@PathVariable long id, @RequestBody UpdateTaskRequest request) {
        int points = validateTask(request.title(), request.points());
        return taskService.updateTask(id, request.title().strip(), points);
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

    private int validateTask(String title, BigDecimal requestedPoints) {
        if (title == null || title.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nazwa zadania jest wymagana.");
        }
        if (requestedPoints == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Punkty są wymagane.");
        }
        int points;
        try {
            points = requestedPoints.intValueExact();
        } catch (ArithmeticException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Punkty muszą być liczbą całkowitą w zakresie int.");
        }
        if (points <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Punkty muszą być dodatnie.");
        }
        return points;
    }
}
