package pl.questtodo.habit;

import java.util.List;
import java.time.LocalDate;
import java.time.DayOfWeek;
import java.time.temporal.TemporalAdjusters;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.user.CurrentUserProvider;
import pl.questtodo.user.UserService;

@Service
@Transactional
public class HabitService {
    private final HabitRepository habits;
    private final UserService users;
    private final CurrentUserProvider currentUser;
    private final HabitCompletionRepository completions;
    private final HabitCalendar calendar;
    private final HabitTargetRepository targets;
    private final HabitAwardRepository awards;

    public HabitService(HabitRepository habits, UserService users, CurrentUserProvider currentUser,
                        HabitCompletionRepository completions, HabitCalendar calendar, HabitTargetRepository targets,
                        HabitAwardRepository awards) {
        this.habits = habits;
        this.users = users;
        this.currentUser = currentUser;
        this.completions = completions;
        this.calendar = calendar;
        this.targets = targets;
        this.awards = awards;
    }

    @Transactional(readOnly = true)
    public List<Habit> getHabits(LocalDate requestedDate) {
        LocalDate date = requestedDate == null ? calendar.today() : requestedDate;
        validateDate(date);
        long userId = currentUser.getUserId();
        var completedIds = completions.findCompletedIds(userId, date);
        LocalDate monday = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        var weeklyCounts = completions.countWeek(userId, monday, monday.plusDays(6)).stream()
                .collect(Collectors.toMap(HabitCompletionRepository.WeeklyCount::getHabitId,
                        HabitCompletionRepository.WeeklyCount::getCompletedDays));
        var targetHistory = targets.findByHabitUserIdOrderByEffectiveFromAsc(userId).stream()
                .collect(Collectors.groupingBy(HabitTargetEntity::getHabitId));
        return habits.findByUserIdOrderByIdAsc(userId).stream()
                .map(habit -> toHabit(habit, date, completedIds.contains(habit.getId()),
                        targetHistory.getOrDefault(habit.getId(), List.of()),
                        weeklyCounts.getOrDefault(habit.getId(), 0L)))
                .toList();
    }

    public Habit createHabit(String name, Integer targetDays) {
        return createHabit(name, targetDays, null);
    }

    public Habit createHabit(String name, Integer targetDays, Integer rewardPoints) {
        LocalDate today = calendar.today();
        HabitEntity habit = habits.save(new HabitEntity(name, users.currentReference(), today));
        habit.setRewardPoints(rewardPoints == null ? 0 : rewardPoints);
        HabitTargetEntity target = targets.save(new HabitTargetEntity(habit, targetDays == null ? 7 : targetDays,
                today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))));
        return toHabit(habit, today, false, List.of(target), 0);
    }

    public Habit updateHabit(long id, String name, Integer targetDays) {
        return updateHabit(id, name, targetDays, null);
    }

    public Habit updateHabit(long id, String name, Integer targetDays, Integer rewardPoints) {
        HabitEntity habit = findForUpdate(id);
        habit.rename(name);
        if (rewardPoints != null) habit.setRewardPoints(rewardPoints);
        LocalDate today = calendar.today();
        if (targetDays != null) changeTarget(habit, targetDays, today);
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        return toHabit(habit, today, completions.existsByHabitIdAndDate(id, today),
                targets.findByHabit_IdOrderByEffectiveFromAsc(id),
                completions.countByHabitIdAndDateBetween(id, monday, monday.plusDays(6)));
    }

    private void changeTarget(HabitEntity habit, int days, LocalDate today) {
        var history = targets.findByHabit_IdOrderByEffectiveFromAsc(habit.getId());
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        var current = history.stream().filter(t -> t.getEffectiveFrom().equals(monday)).findFirst().orElse(null);
        // Preserve older weeks and replace any legacy scheduled changes.
        history.stream().filter(t -> t != current && !t.getEffectiveFrom().isBefore(monday))
                .forEach(targets::delete);
        if (current != null) {
            current.changeTargetDays(days);
        } else {
            targets.save(new HabitTargetEntity(habit, days, monday));
        }
    }

    private Habit toHabit(HabitEntity habit, LocalDate date, boolean completed, List<HabitTargetEntity> history,
                          long weeklyCompletedDays) {
        HabitTarget active = null;
        HabitTarget latest = null;
        for (var target : history) {
            latest = target.toTarget();
            if (!target.getEffectiveFrom().isAfter(date)) active = latest;
        }
        return habit.toHabit(completed, active, latest, weeklyCompletedDays);
    }

    public void deleteHabit(long id) {
        HabitEntity habit = findForUpdate(id);
        awards.deleteByHabit_Id(id);
        completions.deleteByHabitId(id);
        targets.deleteByHabit_Id(id);
        habits.delete(habit);
    }

    public HabitCompletionResult setCompletion(long id, LocalDate date, boolean completed) {
        HabitEntity habit = findForUpdate(id);
        validateDate(date);
        HabitAwardEntity award = null;
        Long balance = null;
        // Locking the habit serializes repeated or simultaneous changes to its completions.
        if (completed) {
            if (!completions.existsByHabitIdAndDate(id, date)) {
                var completion = completions.save(new HabitCompletionEntity(habit, date));
                var snapshot = snapshot(habit, date);
                LocalDate monday = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                if (snapshot.target() != null && snapshot.weeklyCompletedDays() >= snapshot.target().targetDays()
                        && !awards.existsByHabit_IdAndWeekStart(id, monday)) {
                    var user = users.lockCurrentUser();
                    user.addPoints(habit.getRewardPoints());
                    balance = user.getPoints();
                    award = awards.save(new HabitAwardEntity(habit, monday, habit.getRewardPoints(),
                            completion.getId(), date, calendar.now()));
                }
            }
        } else {
            completions.deleteByHabitIdAndDate(id, date);
        }
        return new HabitCompletionResult(snapshot(habit, date), balance, award == null ? null : award.toAward());
    }

    public HabitCompletionResult undoAward(long habitId, java.util.UUID awardId) {
        HabitEntity habit = findForUpdate(habitId);
        var award = awards.findByIdAndHabit_Id(awardId, habitId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Ta nagroda została już cofnięta lub nie istnieje."));
        var user = users.lockCurrentUser();
        // Check after acquiring both locks so waiting cannot extend the undo window.
        if (!calendar.now().isBefore(award.getUndoUntil()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Czas na cofnięcie nagrody upłynął.");
        var completion = completions.findByHabitIdAndDate(habitId, award.getCompletionDate());
        if (completion.isPresent() && completion.get().getId() != award.getCompletionId())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Wykonanie zostało już zmienione. Nie można cofnąć tej operacji.");
        completion.ifPresent(completions::delete);
        user.addPoints(-(long) award.getPoints());
        awards.delete(award);
        return new HabitCompletionResult(snapshot(habit, award.getCompletionDate()), user.getPoints(), null);
    }

    private Habit snapshot(HabitEntity habit, LocalDate date) {
        LocalDate monday = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        return toHabit(habit, date, completions.existsByHabitIdAndDate(habit.getId(), date),
                targets.findByHabit_IdOrderByEffectiveFromAsc(habit.getId()),
                completions.countByHabitIdAndDateBetween(habit.getId(), monday, monday.plusDays(6)));
    }

    private void validateDate(LocalDate date) {
        if (date.isAfter(calendar.today())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nie można wybrać dnia z przyszłości.");
        }
    }

    private HabitEntity findForUpdate(long id) {
        return habits.findForUpdate(id, currentUser.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nawyk nie istnieje."));
    }
}
