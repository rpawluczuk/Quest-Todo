package pl.questtodo.goal;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.habit.HabitRepository;
import pl.questtodo.user.CurrentUserProvider;

@Service
@Transactional
public class GoalHabitService {
    private final GoalRepository goals;
    private final HabitRepository habits;
    private final GoalHabitRepository links;
    private final CurrentUserProvider currentUser;

    public GoalHabitService(GoalRepository goals, HabitRepository habits, GoalHabitRepository links,
                            CurrentUserProvider currentUser) {
        this.goals = goals;
        this.habits = habits;
        this.links = links;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<GoalHabit> getHabits(long goalId) {
        long userId = currentUser.getUserId();
        goals.findByIdAndUserId(goalId, userId).orElseThrow(GoalHabitService::notFound);
        return links.findHabits(goalId, userId);
    }

    @Transactional(readOnly = true)
    public AvailableGoalHabits getAvailableHabits(long goalId, String query, int page, int size) {
        if (page < 0 || size < 1 || size > 20) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nieprawidłowe parametry stronicowania.");
        }
        long userId = currentUser.getUserId();
        goals.findByIdAndUserId(goalId, userId).orElseThrow(GoalHabitService::notFound);
        var result = links.findAvailableHabits(goalId, userId, query.strip(), PageRequest.of(page, size));
        return new AvailableGoalHabits(result.getContent(), result.hasNext());
    }

    public void attach(long goalId, long habitId) {
        long userId = currentUser.getUserId();
        var goal = goals.findForUpdate(goalId, userId).orElseThrow(GoalHabitService::notFound);
        GoalService.requireActive(goal);
        var habit = habits.findForUpdate(habitId, userId).orElseThrow(GoalHabitService::notFound);
        if (!links.existsByGoalIdAndHabitId(goalId, habitId)) links.save(new GoalHabitEntity(goal, habit));
    }

    public void detach(long goalId, long habitId) {
        long userId = currentUser.getUserId();
        var goal = goals.findForUpdate(goalId, userId).orElseThrow(GoalHabitService::notFound);
        GoalService.requireActive(goal);
        habits.findForUpdate(habitId, userId).orElseThrow(GoalHabitService::notFound);
        links.deleteByGoalIdAndHabitId(goalId, habitId);
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Cel lub nawyk nie istnieje.");
    }
}
