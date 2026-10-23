package pl.questtodo.goal;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.user.CurrentUserProvider;

@Service
@Transactional
public class MilestoneService {
    private final GoalRepository goals;
    private final CurrentUserProvider currentUser;
    public MilestoneService(GoalRepository goals, CurrentUserProvider currentUser) {
        this.goals = goals;
        this.currentUser = currentUser;
    }
    @Transactional(readOnly = true)
    public List<Milestone> list(long goalId) {
        return goals.findByIdAndUserId(goalId, currentUser.getUserId())
                .orElseThrow(MilestoneService::notFound).getMilestones().stream()
                .map(MilestoneEntity::toMilestone).toList();
    }
    public Milestone create(long goalId, String title) {
        // Serialize appends within a goal so concurrent requests get distinct positions.
        GoalEntity goal = goals.findForUpdate(goalId, currentUser.getUserId())
                .orElseThrow(MilestoneService::notFound);
        MilestoneEntity milestone = goal.addMilestone(title.strip());
        goals.flush();
        return milestone.toMilestone();
    }
    public Milestone setCompleted(long goalId, long milestoneId, boolean completed) {
        GoalEntity goal = goals.findForUpdate(goalId, currentUser.getUserId())
                .orElseThrow(MilestoneService::notFound);
        MilestoneEntity milestone = goal.getMilestones().stream()
                .filter(item -> item.getId() == milestoneId).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Kamień milowy nie istnieje."));
        milestone.setCompleted(completed);
        return milestone.toMilestone();
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Cel nie istnieje.");
    }
}
