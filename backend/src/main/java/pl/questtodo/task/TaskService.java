package pl.questtodo.task;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.goal.GoalEntity;
import pl.questtodo.goal.GoalRepository;
import pl.questtodo.category.CategoryEntity;
import pl.questtodo.category.CategoryRepository;
import pl.questtodo.user.CurrentUserProvider;
import pl.questtodo.user.UserService;

@Service
@Transactional
public class TaskService {
    private final TaskRepository taskRepository;
    private final UserService userService;
    private final CurrentUserProvider currentUser;
    private final TaskPriorityService priorities;
    private final GoalRepository goals;
    private final CategoryRepository categories;

    public TaskService(TaskRepository taskRepository, UserService userService, CurrentUserProvider currentUser,
                       TaskPriorityService priorities, GoalRepository goals,
                       CategoryRepository categories) {
        this.taskRepository = taskRepository;
        this.userService = userService;
        this.currentUser = currentUser;
        this.priorities = priorities;
        this.goals = goals;
        this.categories = categories;
    }

    public List<Task> getTasks() {
        priorities.promoteForUser(currentUser.getUserId());
        return toTasks(taskRepository.findByUserIdOrderByIdAsc(currentUser.getUserId()));
    }

    public Task createTask(String title, int points, String description, LocalDate dueDate, LocalTime dueTime,
                           Long categoryId, Long goalId) {
        var goal = ownedGoal(goalId);
        var category = ownedCategory(categoryId);
        var task = new TaskEntity(title, points, description, dueDate, dueTime, category, goal,
                userService.currentReference());
        priorities.promote(task);
        taskRepository.save(task);
        return task.toTask();
    }

    public record Overview(List<Task> tasks, long completedCount) {}
    public record History(List<Task> tasks, long total, boolean hasMore) {}

    public Overview overview() {
        long owner = currentUser.getUserId();
        priorities.promoteForUser(owner);
        return new Overview(toTasks(taskRepository.findByUserIdAndCompletedFalseOrderByIdAsc(owner)),
                taskRepository.countByUserIdAndCompletedTrue(owner));
    }

    @Transactional(readOnly = true)
    public History history(int page) {
        if (page < 0 || page > Integer.MAX_VALUE / 20) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        var result = taskRepository.findHistory(currentUser.getUserId(), org.springframework.data.domain.PageRequest.of(page, 20));
        return new History(toTasks(result.getContent()), result.getTotalElements(), result.hasNext());
    }

    public Task getTask(long id) {
        priorities.promoteForUser(currentUser.getUserId());
        return toTask(taskRepository.findByIdAndUserId(id, currentUser.getUserId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Zadanie nie istnieje.")));
    }

    public Task updateCompletion(long id, boolean completed) {
        TaskEntity task = findForUpdate(id);
        if (task.isCompleted() != completed) {
            userService.lockCurrentUser().addPoints(completed ? task.getPoints() : -(long) task.getPoints());
        }
        task.setCompleted(completed);
        priorities.promote(task);
        return toTask(task);
    }

    public Task updateFocus(long id, boolean inFocus) {
        TaskEntity task = findForUpdate(id);
        task.setManualFocus(inFocus, priorities.today().plusDays(7));
        return toTask(task);
    }

    public Task updateTask(long id, String title, int points, String description, boolean updateDescription,
                           LocalDate dueDate, LocalTime dueTime, boolean updateDueDate,
                           Long categoryId, boolean updateCategory, Long goalId, boolean updateGoal) {
        TaskEntity task = findForUpdate(id);
        if (task.isCompleted()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Nie moÅ¼na edytowaÄ‡ wykonanego zadania.");
        }
        CategoryEntity category = updateCategory ? ownedCategory(categoryId) : null;
        GoalEntity goal = updateGoal ? ownedGoal(goalId) : null;
        task.updateDetails(title, points, description, updateDescription, dueDate, dueTime, updateDueDate);
        if (updateCategory) task.setCategory(category);
        if (updateGoal) task.setGoal(goal);
        priorities.promote(task);
        taskRepository.flush();
        return toTask(task);
    }

    public void deleteTask(long id) {
        taskRepository.delete(findForUpdate(id));
    }

    private TaskEntity findForUpdate(long id) {
        return taskRepository.findForUpdate(id, currentUser.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zadanie nie istnieje."));
    }

    private Task toTask(TaskEntity entity) {
        return entity.toTask();
    }

    private List<Task> toTasks(List<TaskEntity> entities) {
        return entities.stream().map(TaskEntity::toTask).toList();
    }

    private GoalEntity ownedGoal(Long goalId) {
        if (goalId == null) return null;
        return goals.findByIdAndUserId(goalId, currentUser.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cel nie istnieje."));
    }

    private CategoryEntity ownedCategory(Long categoryId) {
        if (categoryId == null) return null;
        return categories.findByIdAndUserId(categoryId, currentUser.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Kategoria nie istnieje."));
    }
}
