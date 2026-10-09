package pl.questtodo.habit;

import java.util.List;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.RequestParam;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.questtodo.habit.dto.HabitRequest;

@RestController
@RequestMapping("/api/habits")
public class HabitController {
    private final HabitService habits;

    public HabitController(HabitService habits) {
        this.habits = habits;
    }

    @GetMapping
    public List<Habit> getHabits(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return habits.getHabits(date);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Habit createHabit(@Valid @RequestBody HabitRequest request) {
        return habits.createHabit(request.name().strip(), request.targetDays(), request.rewardPoints());
    }

    @PutMapping("/{id}")
    public Habit updateHabit(@PathVariable long id, @Valid @RequestBody HabitRequest request) {
        return habits.updateHabit(id, request.name().strip(), request.targetDays(), request.rewardPoints());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteHabit(@PathVariable long id) {
        habits.deleteHabit(id);
    }

    @PutMapping("/{id}/completions/{date}")
    public HabitCompletionResult complete(@PathVariable long id, @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return habits.setCompletion(id, date, true);
    }

    @DeleteMapping("/{id}/completions/{date}")
    public HabitCompletionResult uncomplete(@PathVariable long id, @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return habits.setCompletion(id, date, false);
    }

    @PostMapping("/{id}/awards/{awardId}/undo")
    public HabitCompletionResult undo(@PathVariable long id, @PathVariable java.util.UUID awardId) {
        return habits.undoAward(id, awardId);
    }
}
