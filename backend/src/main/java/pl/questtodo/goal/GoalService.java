package pl.questtodo.goal;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.user.CurrentUserProvider;
import pl.questtodo.user.UserService;

@Service
@Transactional
public class GoalService {
    private final GoalRepository goals;
    private final UserService users;
    private final CurrentUserProvider currentUser;

    public GoalService(GoalRepository goals, UserService users, CurrentUserProvider currentUser) {
        this.goals = goals;
        this.users = users;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<Goal> getGoals() {
        return goals.findByUserIdOrderByIdAsc(currentUser.getUserId()).stream()
                .map(GoalEntity::toGoal).toList();
    }

    @Transactional(readOnly = true)
    public Goal getGoal(long id) { return findOwned(id).toGoal(); }

    public Goal createGoal(String title) {
        return goals.save(new GoalEntity(title, users.currentReference())).toGoal();
    }

    public Goal updateGoal(long id, String title) {
        GoalEntity goal = findOwned(id);
        goal.rename(title);
        return goal.toGoal();
    }

    public void deleteGoal(long id) {
        goals.delete(findOwned(id));
    }

    private GoalEntity findOwned(long id) {
        return goals.findByIdAndUserId(id, currentUser.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cel nie istnieje."));
    }
}
