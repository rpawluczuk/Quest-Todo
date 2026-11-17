package pl.questtodo.goal;

import java.util.List;
import java.time.Clock;
import java.time.LocalDate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.user.CurrentUserProvider;
import pl.questtodo.user.UserService;

@Service
@Transactional
public class GoalService {
    private final Clock clock;
    private final GoalRepository goals;
    private final UserService users;
    private final CurrentUserProvider currentUser;

    public GoalService(GoalRepository goals, UserService users, CurrentUserProvider currentUser, Clock clock) {
        this.clock = clock;
        this.goals = goals;
        this.users = users;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<Goal> getGoals() {
        LocalDate today = today();
        return goals.findByUserIdOrderByIdAsc(currentUser.getUserId()).stream()
                .map(goal -> goal.toGoal(today)).toList();
    }

    @Transactional(readOnly = true)
    public Goal getGoal(long id) { return findOwned(id).toGoal(today()); }

    public Goal createGoal(String title, String currentState, String desiredOutcome, GoalReviewFrequency frequency) {
        GoalEntity goal = new GoalEntity(title, optionalText(currentState), optionalText(desiredOutcome), users.currentReference());
        goal.configureReviews(frequency, today());
        return goals.save(goal).toGoal(today());
    }

    public Goal updateGoal(long id, String title, String currentState, String desiredOutcome,
                           GoalReviewFrequency frequency, boolean frequencyPresent) {
        GoalEntity goal = findOwnedForUpdate(id);
        requireActive(goal);
        if (frequencyPresent) goal.configureReviews(frequency, today());
        goal.updateDetails(title, optionalText(currentState), optionalText(desiredOutcome));
        return goal.toGoal(today());
    }

    public Goal updateCompletion(long id, boolean completed) {
        GoalEntity goal = findOwnedForUpdate(id);
        if (goal.isCompleted() != completed) {
            goal.setCompleted(completed);
            goal.restartReviews(today());
        }
        return goal.toGoal(today());
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

    private LocalDate today() { return LocalDate.now(clock.withZone(GoalReviewTimeConfiguration.ZONE)); }

    private static String optionalText(String value) {
        if (value == null || value.isBlank()) return null;
        return value.strip();
    }
}
