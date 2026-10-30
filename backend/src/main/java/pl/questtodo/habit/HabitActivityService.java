package pl.questtodo.habit;

import java.time.LocalDate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class HabitActivityService {
    private final HabitStatusPeriodRepository periods;
    private final HabitCalendar calendar;

    public HabitActivityService(HabitStatusPeriodRepository periods, HabitCalendar calendar) {
        this.periods = periods; this.calendar = calendar;
    }

    public HabitActivityTimeline timeline(long habitId) {
        return new HabitActivityTimeline(periods.findByHabitIdOrderByStartedAtAscIdAsc(habitId).stream()
                .map(HabitStatusPeriod::toResponse).toList());
    }

    // Caller holds the habit lock, also used by status transitions.
    public void assertCompletionAllowed(HabitEntity habit, LocalDate date, boolean adding, boolean existing) {
        if (adding && existing) return; // Retrying a saved completion cannot change history or award points.
        var activity = timeline(habit.getId());
        boolean allowed = adding && date.equals(calendar.today())
                ? habit.getActivityStatus() == HabitStatus.ACTIVE && activity.isActiveAt(calendar.now())
                : activity.wasActiveOn(date);
        if (!allowed) throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Nie można zmieniać wykonań w okresie, w którym nawyk był zaplanowany lub wstrzymany.");
    }
}
