package pl.questtodo.habit;

import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.user.CurrentUserProvider;

@Service
@Transactional
public class HabitStatusService {
    private final HabitRepository habits;
    private final HabitStatusPeriodRepository periods;
    private final CurrentUserProvider currentUser;
    private final HabitCalendar calendar;
    private final boolean waitingRoomEnabled;

    public HabitStatusService(HabitRepository habits, HabitStatusPeriodRepository periods,
            CurrentUserProvider currentUser, HabitCalendar calendar,
            @Value("${app.habits.waiting-room-enabled:false}") boolean waitingRoomEnabled) {
        this.habits = habits; this.periods = periods; this.currentUser = currentUser;
        this.calendar = calendar; this.waitingRoomEnabled = waitingRoomEnabled;
    }

    public void initialize(HabitEntity habit, HabitStatus requested) {
        var status = requested == null ? HabitStatus.ACTIVE : requested;
        if (status == HabitStatus.PAUSED)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nowy nawyk może być aktywny albo zaplanowany.");
        if (status != HabitStatus.ACTIVE) requireEnabled();
        habit.changeActivityStatus(status);
        periods.save(new HabitStatusPeriod(habit, status, calendar.now().truncatedTo(ChronoUnit.MICROS)));
    }

    public HabitEntity change(long id, HabitStatus next) {
        var habit = habits.findForUpdate(id, currentUser.getUserId()).orElseThrow(HabitStatusService::notFound);
        if (next == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Wybierz status nawyku.");
        if (!habit.getActivityStatus().canChangeTo(next))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Niedozwolona zmiana statusu nawyku.");
        if (habit.getActivityStatus() == next) return habit;
        requireEnabled();
        var previous = periods.findByHabitIdAndEndedAtIsNull(id)
                .orElseThrow(() -> new IllegalStateException("Habit has no current status period: " + id));
        if (previous.getStatus() != habit.getActivityStatus())
            throw new IllegalStateException("Habit status differs from its current period: " + id);
        var at = calendar.now().truncatedTo(ChronoUnit.MICROS);
        // A clock correction cannot reverse the order of persisted periods.
        if (at.isBefore(previous.getStartedAt())) at = previous.getStartedAt();
        previous.close(at);
        periods.flush(); // Release the unique open slot before inserting the next period.
        habit.changeActivityStatus(next);
        periods.save(new HabitStatusPeriod(habit, next, at));
        return habit;
    }

    @Transactional(readOnly = true)
    public List<HabitStatusPeriodResponse> history(long id) {
        if (!habits.existsByIdAndUserId(id, currentUser.getUserId())) throw notFound();
        return periods.findByHabitIdOrderByStartedAtAscIdAsc(id).stream().map(HabitStatusPeriod::toResponse).toList();
    }

    // Parent deletion already holds the habit lock. Remove managed children as well
    // as relying on the database cascade for direct parent/account deletions.
    public void deleteHistory(long habitId) {
        periods.deleteByHabitId(habitId);
    }

    private void requireEnabled() {
        if (!waitingRoomEnabled) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Poczekalnia nawyków nie została jeszcze udostępniona.");
    }
    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Nawyk nie istnieje.");
    }
}
