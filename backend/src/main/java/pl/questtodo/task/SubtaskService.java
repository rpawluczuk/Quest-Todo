package pl.questtodo.task;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.task.dto.*;
import pl.questtodo.user.CurrentUserProvider;

@Service
@Transactional
public class SubtaskService {
    private final TaskRepository tasks;
    private final SubtaskRepository subtasks;
    private final CurrentUserProvider currentUser;

    public SubtaskService(TaskRepository tasks, SubtaskRepository subtasks, CurrentUserProvider currentUser) {
        this.tasks = tasks;
        this.subtasks = subtasks;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<SubtaskResponse> list(long taskId) {
        tasks.findByIdAndUserId(taskId, currentUser.getUserId()).orElseThrow(SubtaskService::taskNotFound);
        return subtasks.findByTaskIdOrderByPositionAscIdAsc(taskId).stream()
                .map(SubtaskEntity::toResponse).toList();
    }

    public SubtaskResponse create(long taskId, CreateSubtaskRequest request) {
        var task = lockTask(taskId);
        int position = Math.addExact(subtasks.maxPosition(taskId), 1);
        return subtasks.save(new SubtaskEntity(task, request.title().strip(), position)).toResponse();
    }

    public SubtaskResponse update(long taskId, long id, UpdateSubtaskRequest request) {
        lockTask(taskId);
        var subtask = find(taskId, id);
        if (request.hasTitle()) subtask.setTitle(request.getTitle().strip());
        if (request.hasCompleted()) subtask.setCompleted(request.getCompleted());
        return subtask.toResponse();
    }

    public void delete(long taskId, long id) {
        lockTask(taskId);
        subtasks.delete(find(taskId, id));
    }

    public List<SubtaskResponse> reorder(long taskId, List<Long> ids) {
        lockTask(taskId);
        var byId = subtasks.findByTaskIdOrderByPositionAscIdAsc(taskId).stream()
                .collect(java.util.stream.Collectors.toMap(SubtaskEntity::getId, item -> item));
        if (ids.size() != byId.size() || new java.util.HashSet<>(ids).size() != ids.size()
                || !byId.keySet().containsAll(ids)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Lista podzadań zmieniła się lub jest niepoprawna. Odśwież listę i spróbuj ponownie.");
        }
        // No unique position constraint: dirty checking updates only changed rows.
        // The parent lock serializes ordering with create, delete and other writes.
        for (int i = 0; i < ids.size(); i++) byId.get(ids.get(i)).setPosition(i);
        return ids.stream().map(id -> byId.get(id).toResponse()).toList();
    }

    // All writers lock the parent, including TaskService.deleteTask. This also
    // serializes position allocation without loading the subtask collection.
    private TaskEntity lockTask(long taskId) {
        return tasks.findForUpdate(taskId, currentUser.getUserId()).orElseThrow(SubtaskService::taskNotFound);
    }

    private SubtaskEntity find(long taskId, long id) {
        return subtasks.findByIdAndTaskId(id, taskId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Podzadanie nie istnieje."));
    }

    private static ResponseStatusException taskNotFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Zadanie nie istnieje.");
    }
}
