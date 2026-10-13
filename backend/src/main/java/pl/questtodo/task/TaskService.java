package pl.questtodo.task;

import java.util.List;
import java.time.LocalDate;
import java.time.LocalTime;
import pl.questtodo.user.CurrentUserProvider;
import pl.questtodo.user.UserService;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class TaskService {
    private final TaskRepository taskRepository;
    private final UserService userService;
    private final CurrentUserProvider currentUser;
    private final TaskPriorityService priorities;

    public TaskService(TaskRepository taskRepository, UserService userService, CurrentUserProvider currentUser,
                       TaskPriorityService priorities) {
        this.taskRepository = taskRepository;
        this.userService = userService;
        this.currentUser = currentUser;
        this.priorities = priorities;
    }

    public List<Task> getTasks() {
        priorities.promoteForUser(currentUser.getUserId());
        return taskRepository.findByUserIdOrderByIdAsc(currentUser.getUserId()).stream()
                .map(TaskEntity::toTask)
                .toList();
    }

    public Task createTask(String title, int points, String description, LocalDate dueDate, LocalTime dueTime) {
        var task = new TaskEntity(title, points, description, dueDate, dueTime, userService.currentReference());
        priorities.promote(task);
        return taskRepository.save(task).toTask();
    }

    public record Overview(List<Task> tasks, long completedCount) {}
    public record History(List<Task> tasks, long total, boolean hasMore) {}

    public Overview overview() {
        long owner = currentUser.getUserId();
        priorities.promoteForUser(owner);
        return new Overview(taskRepository.findByUserIdAndCompletedFalseOrderByIdAsc(owner).stream()
                .map(TaskEntity::toTask).toList(), taskRepository.countByUserIdAndCompletedTrue(owner));
    }

    @Transactional(readOnly = true)
    public History history(int page) {
        if (page < 0 || page > Integer.MAX_VALUE / 20) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        var result = taskRepository.findHistory(currentUser.getUserId(), org.springframework.data.domain.PageRequest.of(page, 20));
        return new History(result.getContent().stream().map(TaskEntity::toTask).toList(), result.getTotalElements(), result.hasNext());
    }

    public Task getTask(long id) {
        priorities.promoteForUser(currentUser.getUserId());
        return taskRepository.findByIdAndUserId(id, currentUser.getUserId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Zadanie nie istnieje.")).toTask();
    }

    public Task updateCompletion(long id, boolean completed) {
        TaskEntity task = findForUpdate(id);
        if (task.isCompleted() != completed) {
            userService.lockCurrentUser().addPoints(completed ? task.getPoints() : -(long) task.getPoints());
        }
        task.setCompleted(completed);
        priorities.promote(task);
        return task.toTask();
    }

    public Task updateFocus(long id, boolean inFocus) {
        TaskEntity task = findForUpdate(id);
        if (!inFocus && task.requiresPriority(priorities.today().plusDays(7))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Zadanie z terminem w ciągu 7 dni lub po terminie pozostaje w priorytetach. Aby je przenieść, zmień lub usuń termin.");
        }
        task.setInFocus(inFocus);
        return task.toTask();
    }

    public Task updateTask(long id, String title, int points, String description, boolean updateDescription,
                           LocalDate dueDate, LocalTime dueTime, boolean updateDueDate) {
        TaskEntity task = findForUpdate(id);
        if (task.isCompleted()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Nie moÅ¼na edytowaÄ‡ wykonanego zadania.");
        }
        task.updateDetails(title, points, description, updateDescription, dueDate, dueTime, updateDueDate);
        priorities.promote(task);
        return task.toTask();
    }

    public void deleteTask(long id) {
        taskRepository.delete(findForUpdate(id));
    }

    private TaskEntity findForUpdate(long id) {
        return taskRepository.findForUpdate(id, currentUser.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zadanie nie istnieje."));
    }
}
