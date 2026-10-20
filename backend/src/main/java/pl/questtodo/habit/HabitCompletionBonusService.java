package pl.questtodo.habit;

import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.questtodo.user.UserRepository;

@Service
@Transactional
public class HabitCompletionBonusService {
    private final HabitRepository habits;
    private final HabitCompletionBonusAwardRepository awards;
    private final HabitCompletionRepository completions;
    private final HabitTargetRepository targets;
    private final HabitCalendar calendar;
    private final UserRepository users;

    public HabitCompletionBonusService(HabitRepository habits, HabitCompletionBonusAwardRepository awards,
            HabitCompletionRepository completions, HabitTargetRepository targets, HabitCalendar calendar,
            UserRepository users) {
        this.habits = habits;
        this.awards = awards;
        this.completions = completions;
        this.targets = targets;
        this.calendar = calendar;
        this.users = users;
    }

    public void settle(long habitId) {
        var habit = habits.findForSettlement(habitId).orElse(null);
        if (habit == null || habit.getEndDate() == null || !habit.getEndDate().isBefore(calendar.today())
                || habit.getEndedOn() != null || habit.getCompletionBonusPoints() == null
                || habit.getRequiredSuccessPercent() == null) return;
        var existing = awards.findById(habitId);
        if (existing.isPresent() && existing.get().getSettledOn() != null) return;
        reconcile(habit);
    }

    @Transactional(readOnly = true)
    public HabitRegularity regularity(HabitEntity habit) {
        if (habit.getEndDate() == null) return null;
        return HabitRegularity.calculate(habit.getStartDate(), habit.getEndDate(), calendar.today(),
                targets.findByHabit_IdOrderByEffectiveFromAsc(habit.getId()).stream()
                        .map(HabitTargetEntity::toTarget).toList(),
                completions.findByHabitIdAndDateBetween(habit.getId(), habit.getStartDate(), habit.getEndDate())
                        .stream().map(HabitCompletionEntity::getDate).collect(Collectors.toSet()));
    }

    // Caller holds the habit lock. Account locking follows the same order as weekly awards.
    // Explicit history/configuration corrections reconcile the existing entry, not a second award.
    public boolean reconcile(HabitEntity habit) {
        var recorded = awards.findById(habit.getId()).orElse(null);
        boolean dated = habit.getEndDate() != null;
        boolean wasDated = recorded != null && recorded.getSettledOn() != null;
        HabitRegularity regularity = null;
        boolean eligible;
        if (dated) {
            boolean due = habit.getEndedOn() == null && habit.getCompletionBonusPoints() != null
                    && habit.getRequiredSuccessPercent() != null && habit.getEndDate().isBefore(calendar.today());
            if (due) regularity = regularity(habit);
            eligible = due && regularity.meets(habit.getRequiredSuccessPercent());
            if (!due && recorded == null) return false;
        } else {
            if (habit.getCompletionLimit() == null) {
                if (!wasDated) return false; // Preserve existing count-bonus behavior.
                eligible = false;
            } else {
                eligible = completions.countByHabitId(habit.getId()) >= habit.getCompletionLimit();
            }
            if (recorded == null && (!eligible || habit.getCompletionBonusPoints() == null)) return false;
        }
        boolean previouslyActive = recorded != null && recorded.isActive();
        if (recorded == null) {
            recorded = new HabitCompletionBonusAwardEntity(habit.getId(), habit.getCompletionBonusPoints());
            recorded.deactivate();
        }
        if (regularity != null) recorded.settle(calendar.today(), regularity);
        else recorded.clearSettlement();
        boolean changed = previouslyActive != eligible;
        if (changed) {
            var user = users.findForUpdate(habit.ownerId()).orElseThrow();
            user.addPoints(eligible ? recorded.getPoints() : -(long) recorded.getPoints());
        }
        if (eligible) recorded.activate();
        else recorded.deactivate();
        awards.save(recorded);
        return changed;
    }

    public boolean reconcileDatedConfiguration(HabitEntity habit) {
        if (habit.getEndDate() != null
                || awards.findById(habit.getId()).map(a -> a.getSettledOn() != null).orElse(false))
            return reconcile(habit);
        return false;
    }
}
