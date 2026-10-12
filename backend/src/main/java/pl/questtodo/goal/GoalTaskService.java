package pl.questtodo.goal;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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
    private final GoalTaskRepository links;
    private final CurrentUserProvider currentUser;

    public GoalTaskService(GoalRepository goals, TaskRepository tasks, GoalTaskRepository links,
                           CurrentUserProvider currentUser) {
        this.goals = goals;
        this.tasks = tasks;
        this.links = links;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<Task> getTasks(long goalId) {
        long userId = currentUser.getUserId();
        goals.findByIdAndUserId(goalId, userId).orElseThrow(GoalTaskService::notFound);
        return links.findTasks(goalId, userId).stream().map(TaskEntity::toTask).toList();
    }

    public void attach(long goalId, long taskId) {
        long userId = currentUser.getUserId();
        // Serialize changes to a goal, including repeated concurrent attach requests.
        var goal = goals.findForUpdate(goalId, userId).orElseThrow(GoalTaskService::notFound);
        var task = tasks.findForUpdate(taskId, userId).orElseThrow(GoalTaskService::notFound);
        if (!links.existsByGoalIdAndTaskId(goalId, taskId)) links.save(new GoalTaskEntity(goal, task));
    }

    public void detach(long goalId, long taskId) {
        long userId = currentUser.getUserId();
        goals.findForUpdate(goalId, userId).orElseThrow(GoalTaskService::notFound);
        tasks.findForUpdate(taskId, userId).orElseThrow(GoalTaskService::notFound);
        links.deleteByGoalIdAndTaskId(goalId, taskId);
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Cel lub zadanie nie istnieje.");
    }
}
