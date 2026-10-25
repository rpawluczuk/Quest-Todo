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
        GoalService.requireActive(goal);
        MilestoneEntity milestone = goal.addMilestone(title.strip());
        goals.flush();
        return milestone.toMilestone();
    }
    public Milestone setCompleted(long goalId, long milestoneId, boolean completed) {
        GoalEntity goal = goals.findForUpdate(goalId, currentUser.getUserId())
                .orElseThrow(MilestoneService::notFound);
        GoalService.requireActive(goal);
        MilestoneEntity milestone = findMilestone(goal, milestoneId);
        milestone.setCompleted(completed);
        return milestone.toMilestone();
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Cel nie istnieje.");
    }

    public Milestone rename(long goalId, long milestoneId, String title) {
        GoalEntity goal = goals.findForUpdate(goalId, currentUser.getUserId()).orElseThrow(MilestoneService::notFound);
        GoalService.requireActive(goal);
        MilestoneEntity milestone = findMilestone(goal, milestoneId);
        milestone.rename(title.strip());
        return milestone.toMilestone();
    }

    public void delete(long goalId, long milestoneId) {
        GoalEntity goal = goals.findForUpdate(goalId, currentUser.getUserId()).orElseThrow(MilestoneService::notFound);
        GoalService.requireActive(goal);
        goal.removeMilestone(findMilestone(goal, milestoneId));
    }

    private static MilestoneEntity findMilestone(GoalEntity goal, long id) {
        return goal.getMilestones().stream().filter(item -> item.getId() == id).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Kamień milowy nie istnieje."));
    }

    public List<Milestone> reorder(long goalId, List<Long> ids) {
        GoalEntity goal = goals.findForUpdate(goalId, currentUser.getUserId()).orElseThrow(MilestoneService::notFound);
        GoalService.requireActive(goal);
        var byId = goal.getMilestones().stream().collect(java.util.stream.Collectors.toMap(MilestoneEntity::getId, item -> item));
        if (ids.size() != byId.size() || new java.util.HashSet<>(ids).size() != ids.size()
                || !byId.keySet().containsAll(ids)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Lista kamieni milowych zmieniła się lub jest niepoprawna. Odśwież listę i spróbuj ponownie.");
        }
        // Vacate final positions first; the unique constraint is checked after each UPDATE.
        long temporaryStart = (long) goal.getMilestones().stream().mapToInt(MilestoneEntity::getPosition).max().orElse(-1) + 1;
        if (temporaryStart + ids.size() > Integer.MAX_VALUE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Nie można teraz zmienić kolejności.");
        }
        for (int i = 0; i < ids.size(); i++) byId.get(ids.get(i)).setPosition((int) temporaryStart + i);
        goals.flush();
        for (int i = 0; i < ids.size(); i++) byId.get(ids.get(i)).setPosition(i);
        goals.flush();
        return ids.stream().map(id -> byId.get(id).toMilestone()).toList();
    }
}
