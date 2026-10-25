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

    public Goal createGoal(String title, String currentState, String desiredOutcome) {
        return goals.save(new GoalEntity(title, optionalText(currentState), optionalText(desiredOutcome),
                users.currentReference())).toGoal();
    }

    public Goal updateGoal(long id, String title, String currentState, String desiredOutcome) {
        GoalEntity goal = findOwnedForUpdate(id);
        requireActive(goal);
        goal.updateDetails(title, optionalText(currentState), optionalText(desiredOutcome));
        return goal.toGoal();
    }

    public Goal updateCompletion(long id, boolean completed) {
        GoalEntity goal = findOwnedForUpdate(id);
        goal.setCompleted(completed);
        return goal.toGoal();
    }

    public void deleteGoal(long id) {
        goals.delete(findOwned(id));
    }

    private GoalEntity findOwned(long id) {
        return goals.findByIdAndUserId(id, currentUser.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cel nie istnieje."));
    }

    private GoalEntity findOwnedForUpdate(long id) {
        return goals.findForUpdate(id, currentUser.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cel nie istnieje."));
    }

    static void requireActive(GoalEntity goal) {
        if (goal.isCompleted()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Osiągnięty cel jest dostępny tylko do odczytu. Wznów cel, aby go zmieniać.");
        }
    }

    private static String optionalText(String value) {
        if (value == null || value.isBlank()) return null;
        return value.strip();
    }
}
