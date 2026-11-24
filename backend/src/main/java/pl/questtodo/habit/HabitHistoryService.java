package pl.questtodo.habit;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.user.CurrentUserProvider;

import static pl.questtodo.habit.HabitHistory.DayStatus.*;
import static pl.questtodo.habit.HabitHistory.WeekStatus.*;

@Service
@Transactional(readOnly = true)
public class HabitHistoryService {
    private final HabitRepository habits;
    private final HabitTargetRepository targets;
    private final HabitCompletionRepository completions;
    private final HabitActivityService activity;
    private final HabitCalendar calendar;
    private final CurrentUserProvider currentUser;

    public HabitHistoryService(HabitRepository habits, HabitTargetRepository targets,
            HabitCompletionRepository completions, HabitActivityService activity,
            HabitCalendar calendar, CurrentUserProvider currentUser) {
        this.habits = habits;
        this.targets = targets;
        this.completions = completions;
        this.activity = activity;
        this.calendar = calendar;
        this.currentUser = currentUser;
    }

    public HabitHistory get(long id, int year) {
        if (year < 1 || year > 9999)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rok musi być liczbą od 1 do 9999.");
        var habit = habits.findByIdAndUserId(id, currentUser.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nawyk nie istnieje."));
        var today = calendar.today();
        var yearStart = LocalDate.of(year, 1, 1);
        var yearEnd = LocalDate.of(year, 12, 31);
        var firstMonday = yearStart.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        var lastMonday = yearEnd.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        Set<LocalDate> saved = completions.findByHabitIdAndDateBetween(id, firstMonday, lastMonday.plusDays(6))
                .stream().map(HabitCompletionEntity::getDate).collect(Collectors.toSet());
        var history = targets.findByHabit_IdOrderByEffectiveFromAsc(id);
        var timeline = activity.timeline(id);
        var start = habit.getStartDate();
        var end = habit.getEndDate();
        // A scheduled end is inclusive; manual ending excludes endedOn itself.
        if (habit.getEndedOn() != null && (end == null || habit.getEndedOn().minusDays(1).isBefore(end)))
            end = habit.getEndedOn().minusDays(1);

        var days = new ArrayList<HabitHistory.Day>();
        for (var date = yearStart; !date.isAfter(yearEnd); date = date.plusDays(1)) {
            var status = date.isAfter(today) ? FUTURE
                    : date.isBefore(start) || (end != null && date.isAfter(end)) || !timeline.wasActiveOn(date)
                        ? INACTIVE : ACTIVE;
            days.add(new HabitHistory.Day(date, saved.contains(date), status));
        }

        var weeks = new ArrayList<HabitHistory.Week>();
        int targetIndex = 0;
        Integer target = null;
        for (var monday = firstMonday; !monday.isAfter(lastMonday); monday = monday.plusWeeks(1)) {
            // Writes already normalize midweek target edits to the current Monday.
            while (targetIndex < history.size() && !history.get(targetIndex).getEffectiveFrom().isAfter(monday))
                target = history.get(targetIndex++).getTargetDays();
            var first = start.isAfter(monday) ? start : monday;
            var last = monday.plusDays(6);
            if (end != null && end.isBefore(last)) last = end;
            boolean overlaps = !first.isAfter(last);
            Integer required = !overlaps || target == null ? null
                    : (target * ((int) ChronoUnit.DAYS.between(first, last) + 1) + 6) / 7;
            int count = 0;
            for (var day = first; !day.isAfter(last); day = day.plusDays(1))
                if (saved.contains(day)) count++;
            var status = NEUTRAL;
            if (overlaps && target != null && !first.isAfter(today) && timeline.fullyActive(first, last))
                status = count >= required ? MET : last.isBefore(today) ? MISSED : IN_PROGRESS;
            weeks.add(new HabitHistory.Week(monday, count, target, required, status));
        }
        return new HabitHistory(id, habit.getName(), year, today, days, weeks);
    }
}
