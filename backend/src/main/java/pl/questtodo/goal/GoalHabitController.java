package pl.questtodo.goal;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/goals/{goalId}/habits")
public class GoalHabitController {
    private final GoalHabitService habits;

    public GoalHabitController(GoalHabitService habits) { this.habits = habits; }

    @GetMapping
    public List<GoalHabit> getHabits(@PathVariable long goalId) { return habits.getHabits(goalId); }

    @GetMapping("/available")
    public AvailableGoalHabits getAvailableHabits(@PathVariable long goalId,
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return habits.getAvailableHabits(goalId, query, page, size);
    }

    @PutMapping("/{habitId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void attach(@PathVariable long goalId, @PathVariable long habitId) { habits.attach(goalId, habitId); }

    @DeleteMapping("/{habitId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void detach(@PathVariable long goalId, @PathVariable long habitId) { habits.detach(goalId, habitId); }
}

