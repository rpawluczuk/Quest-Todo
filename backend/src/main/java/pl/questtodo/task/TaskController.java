package pl.questtodo.task;

import java.util.List;
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
        if (request.title() == null || request.title().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nazwa zadania jest wymagana.");
        }
        if (request.points() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Punkty są wymagane.");
        }
        int points;
        try {
            points = request.points().intValueExact();
        } catch (ArithmeticException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Punkty muszą być liczbą całkowitą w zakresie int.");
        }
        if (points <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Punkty muszą być dodatnie.");
        }
        return taskService.createTask(request.title().strip(), points);
    }
}
