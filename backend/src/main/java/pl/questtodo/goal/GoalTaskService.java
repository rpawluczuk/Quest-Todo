package pl.questtodo.goal;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.task.Task;
import pl.questtodo.task.TaskEntity;
import pl.questtodo.task.TaskRepository;
import pl.questtodo.user.CurrentUserProvider;

@Service
@Transactional
public class GoalTaskService {
    private final GoalRepository goals;
    private final TaskRepository tasks;
    private final CurrentUserProvider currentUser;
    private final pl.questtodo.task.TaskPriorityService priorities;

    public GoalTaskService(GoalRepository goals, TaskRepository tasks,
                           CurrentUserProvider currentUser, pl.questtodo.task.TaskPriorityService priorities) {
        this.goals = goals;
        this.tasks = tasks;
        this.currentUser = currentUser;
        this.priorities = priorities;
    }

    public List<Task> getTasks(long goalId) {
        long userId = currentUser.getUserId();
        goals.findByIdAndUserId(goalId, userId).orElseThrow(GoalTaskService::notFound);
        priorities.promoteForUser(userId);
        return tasks.findByGoalIdAndUserIdOrderByIdAsc(goalId, userId).stream().map(TaskEntity::toTask).toList();
    }

    public AvailableGoalTasks getAvailableTasks(long goalId, boolean completed, String query, int page, int size) {
        if (page < 0 || size < 1 || size > 20) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nieprawidłowe parametry stronicowania.");
        }
        long userId = currentUser.getUserId();
        goals.findByIdAndUserId(goalId, userId).orElseThrow(GoalTaskService::notFound);
        priorities.promoteForUser(userId);
        String normalizedQuery = query == null ? "" : query.strip();
        var result = tasks.findAvailableForGoal(goalId, userId, completed, normalizedQuery,
                PageRequest.of(page, size));
        return new AvailableGoalTasks(result.getContent().stream().map(TaskEntity::toTask).toList(),
                result.hasNext());
    }

    public void attach(long goalId, long taskId) {
        long userId = currentUser.getUserId();
        var goal = goals.findForUpdate(goalId, userId).orElseThrow(GoalTaskService::notFound);
        var task = tasks.findForUpdate(taskId, userId).orElseThrow(GoalTaskService::notFound);
        task.setGoal(goal);
    }

    public void detach(long goalId, long taskId) {
        long userId = currentUser.getUserId();
        goals.findForUpdate(goalId, userId).orElseThrow(GoalTaskService::notFound);
        var task = tasks.findForUpdate(taskId, userId).orElseThrow(GoalTaskService::notFound);
        if (task.belongsToGoal(goalId)) task.setGoal(null);
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Cel lub zadanie nie istnieje.");
    }
}
