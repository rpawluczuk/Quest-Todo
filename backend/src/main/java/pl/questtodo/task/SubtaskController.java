package pl.questtodo.task;

import java.util.List;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import pl.questtodo.task.dto.*;

@RestController
@RequestMapping("/api/tasks/{taskId}/subtasks")
public class SubtaskController {
    private final SubtaskService subtasks;

    public SubtaskController(SubtaskService subtasks) { this.subtasks = subtasks; }

    @GetMapping
    public List<SubtaskResponse> list(@PathVariable long taskId) { return subtasks.list(taskId); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SubtaskResponse create(@PathVariable long taskId, @Valid @RequestBody CreateSubtaskRequest request) {
        return subtasks.create(taskId, request);
    }

    @PatchMapping("/{subtaskId}")
    public SubtaskResponse update(@PathVariable long taskId, @PathVariable long subtaskId,
                                  @Valid @RequestBody UpdateSubtaskRequest request) {
        return subtasks.update(taskId, subtaskId, request);
    }

    @DeleteMapping("/{subtaskId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long taskId, @PathVariable long subtaskId) {
        subtasks.delete(taskId, subtaskId);
    }

    @PutMapping("/order")
    public List<SubtaskResponse> reorder(@PathVariable long taskId,
                                         @Valid @RequestBody ReorderSubtasksRequest request) {
        return subtasks.reorder(taskId, request.subtaskIds());
    }
}
