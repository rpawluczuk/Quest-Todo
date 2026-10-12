package pl.questtodo.goal;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import pl.questtodo.task.Task;

@RestController
@RequestMapping("/api/goals/{goalId}/tasks")
public class GoalTaskController {
    private final GoalTaskService tasks;

    public GoalTaskController(GoalTaskService tasks) { this.tasks = tasks; }

    @GetMapping
    public List<Task> getTasks(@PathVariable long goalId) { return tasks.getTasks(goalId); }

    @PutMapping("/{taskId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void attach(@PathVariable long goalId, @PathVariable long taskId) { tasks.attach(goalId, taskId); }

    @DeleteMapping("/{taskId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void detach(@PathVariable long goalId, @PathVariable long taskId) { tasks.detach(goalId, taskId); }
}
