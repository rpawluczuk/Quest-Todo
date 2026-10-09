package pl.questtodo.habit;

import java.util.List;
import java.time.LocalDate;
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

    public HabitService(HabitRepository habits, UserService users, CurrentUserProvider currentUser,
                        HabitCompletionRepository completions, HabitCalendar calendar) {
        this.habits = habits;
        this.users = users;
        this.currentUser = currentUser;
        this.completions = completions;
        this.calendar = calendar;
    }

    @Transactional(readOnly = true)
    public List<Habit> getHabits(LocalDate requestedDate) {
        LocalDate date = requestedDate == null ? calendar.today() : requestedDate;
        validateDate(date);
        long userId = currentUser.getUserId();
        var completedIds = completions.findCompletedIds(userId, date);
        return habits.findByUserIdAndCreatedOnLessThanEqualOrderByIdAsc(userId, date).stream()
                .map(habit -> habit.toHabit(completedIds.contains(habit.getId())))
                .toList();
    }

    public Habit createHabit(String name) {
        return habits.save(new HabitEntity(name, users.currentReference(), calendar.today())).toHabit();
    }

    public Habit updateHabit(long id, String name) {
        HabitEntity habit = findForUpdate(id);
        habit.rename(name);
        return habit.toHabit(completions.existsByHabitIdAndDate(id, calendar.today()));
    }

    public void deleteHabit(long id) {
        HabitEntity habit = findForUpdate(id);
        completions.deleteByHabitId(id);
        habits.delete(habit);
    }

    public void setCompletion(long id, LocalDate date, boolean completed) {
        HabitEntity habit = findForUpdate(id);
        validateDate(date);
        if (date.isBefore(habit.getCreatedOn())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nawyk nie istniał w wybranym dniu.");
        }
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
