package pl.questtodo.habit;

import java.util.List;
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

    public HabitService(HabitRepository habits, UserService users, CurrentUserProvider currentUser) {
        this.habits = habits;
        this.users = users;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<Habit> getHabits() {
        return habits.findByUserIdOrderByIdAsc(currentUser.getUserId()).stream()
                .map(HabitEntity::toHabit)
                .toList();
    }

    public Habit createHabit(String name) {
        return habits.save(new HabitEntity(name, users.currentReference())).toHabit();
    }

    public Habit updateHabit(long id, String name) {
        HabitEntity habit = findForUpdate(id);
        habit.rename(name);
        return habit.toHabit();
    }

    public void deleteHabit(long id) {
        habits.delete(findForUpdate(id));
    }

    private HabitEntity findForUpdate(long id) {
        return habits.findForUpdate(id, currentUser.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nawyk nie istnieje."));
    }
}
