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

    public HabitService(HabitRepository habits, UserService users, CurrentUserProvider currentUser,
                        HabitCompletionRepository completions, HabitCalendar calendar, HabitTargetRepository targets) {
        this.habits = habits;
        this.users = users;
        this.currentUser = currentUser;
        this.completions = completions;
        this.calendar = calendar;
        this.targets = targets;
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
        LocalDate today = calendar.today();
        HabitEntity habit = habits.save(new HabitEntity(name, users.currentReference(), today));
        HabitTargetEntity target = targets.save(new HabitTargetEntity(habit, targetDays == null ? 7 : targetDays,
                today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))));
        return toHabit(habit, today, false, List.of(target), 0);
    }

    public Habit updateHabit(long id, String name, Integer targetDays) {
        HabitEntity habit = findForUpdate(id);
        habit.rename(name);
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
        completions.deleteByHabitId(id);
        targets.deleteByHabit_Id(id);
        habits.delete(habit);
    }

    public void setCompletion(long id, LocalDate date, boolean completed) {
        HabitEntity habit = findForUpdate(id);
        validateDate(date);
        // Locking the habit serializes repeated or simultaneous changes to its completions.
        if (completed) {
            if (!completions.existsByHabitIdAndDate(id, date)) {
                completions.save(new HabitCompletionEntity(habit, date));
            }
        } else {
            completions.deleteByHabitIdAndDate(id, date);
        }
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
