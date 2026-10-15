package pl.questtodo.task;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.goal.GoalEntity;
import pl.questtodo.goal.GoalRepository;
import pl.questtodo.goal.GoalTaskEntity;
import pl.questtodo.goal.GoalTaskRepository;
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
    private final GoalTaskRepository goalTasks;
    private final GoalRepository goals;
    private final CategoryRepository categories;

    public TaskService(TaskRepository taskRepository, UserService userService, CurrentUserProvider currentUser,
                       TaskPriorityService priorities, GoalTaskRepository goalTasks, GoalRepository goals,
                       CategoryRepository categories) {
        this.taskRepository = taskRepository;
        this.userService = userService;
        this.currentUser = currentUser;
        this.priorities = priorities;
        this.goalTasks = goalTasks;
        this.goals = goals;
        this.categories = categories;
    }

    public List<Task> getTasks() {
        priorities.promoteForUser(currentUser.getUserId());
        return toTasks(taskRepository.findByUserIdOrderByIdAsc(currentUser.getUserId()));
    }

    public Task createTask(String title, int points, String description, LocalDate dueDate, LocalTime dueTime,
                           Long categoryId, List<Long> goalIds) {
        var selectedGoals = ownedGoals(goalIds == null ? List.of() : goalIds);
        var category = ownedCategory(categoryId);
        var task = new TaskEntity(title, points, description, dueDate, dueTime, category,
                userService.currentReference());
        priorities.promote(task);
        taskRepository.save(task);
        selectedGoals.forEach(goal -> goalTasks.save(new GoalTaskEntity(goal, task)));
        var selected = selectedGoals.stream().map(GoalEntity::toGoal).toList();
        return task.toTask().withGoals(selected.stream().map(goal -> goal.id()).toList(),
                selected.stream().map(goal -> goal.title()).toList());
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
        if (!inFocus && task.requiresPriority(priorities.today().plusDays(7))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Zadanie z terminem w ciągu 7 dni lub po terminie pozostaje w priorytetach. Aby je przenieść, zmień lub usuń termin.");
        }
        task.setInFocus(inFocus);
        return toTask(task);
    }

    public Task updateTask(long id, String title, int points, String description, boolean updateDescription,
                           LocalDate dueDate, LocalTime dueTime, boolean updateDueDate,
                           Long categoryId, boolean updateCategory, List<Long> goalIds) {
        TaskEntity task = findForUpdate(id);
        if (task.isCompleted()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Nie moÅ¼na edytowaÄ‡ wykonanego zadania.");
        }
        CategoryEntity category = updateCategory ? ownedCategory(categoryId) : null;
        var selectedGoals = goalIds == null ? null : ownedGoals(goalIds);
        task.updateDetails(title, points, description, updateDescription, dueDate, dueTime, updateDueDate);
        if (updateCategory) task.setCategory(category);
        if (goalIds != null) {
            goalTasks.deleteByTaskId(task.getId());
            selectedGoals.forEach(goal -> goalTasks.save(new GoalTaskEntity(goal, task)));
        }
        priorities.promote(task);
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
        return toTasks(List.of(entity)).getFirst();
    }

    private List<Task> toTasks(List<TaskEntity> entities) {
        if (entities.isEmpty()) return List.of();
        long userId = currentUser.getUserId();
        var idsByTask = new HashMap<Long, List<Long>>();
        var titlesByTask = new HashMap<Long, List<String>>();
        var taskIds = entities.stream().map(TaskEntity::getId).toList();
        for (var link : goalTasks.findGoalTitles(userId, taskIds)) {
            idsByTask.computeIfAbsent(link.getTaskId(), ignored -> new ArrayList<>()).add(link.getGoalId());
            titlesByTask.computeIfAbsent(link.getTaskId(), ignored -> new ArrayList<>()).add(link.getGoalTitle());
        }
        return entities.stream().map(entity -> entity.toTask()
                .withGoals(idsByTask.getOrDefault(entity.getId(), List.of()),
                        titlesByTask.getOrDefault(entity.getId(), List.of()))).toList();
    }

    private List<GoalEntity> ownedGoals(List<Long> requestedIds) {
        var ids = new LinkedHashSet<>(requestedIds);
        if (ids.isEmpty()) return List.of();
        var selectedGoals = goals.findByUserIdAndIdInOrderByIdAsc(currentUser.getUserId(), ids);
        if (selectedGoals.size() != ids.size()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Co najmniej jeden wybrany cel nie istnieje.");
        }
        return selectedGoals;
    }

    private CategoryEntity ownedCategory(Long categoryId) {
        if (categoryId == null) return null;
        return categories.findByIdAndUserId(categoryId, currentUser.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Kategoria nie istnieje."));
    }
}
