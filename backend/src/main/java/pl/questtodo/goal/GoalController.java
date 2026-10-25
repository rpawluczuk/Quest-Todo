package pl.questtodo.goal;

import java.util.List;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/goals")
public class GoalController {
    private final GoalService goals;

    public GoalController(GoalService goals) { this.goals = goals; }

    @GetMapping
    public List<Goal> getGoals() { return goals.getGoals(); }

    @GetMapping("/{id}")
    public Goal getGoal(@PathVariable long id) { return goals.getGoal(id); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Goal createGoal(@Valid @RequestBody GoalRequest request) {
        return goals.createGoal(request.title().strip(), request.currentState(), request.desiredOutcome());
    }

    @PutMapping("/{id}")
    public Goal updateGoal(@PathVariable long id, @Valid @RequestBody GoalRequest request) {
        return goals.updateGoal(id, request.title().strip(), request.currentState(), request.desiredOutcome());
    }

    @PatchMapping("/{id}/completion")
    public Goal updateCompletion(@PathVariable long id,
                                 @Valid @RequestBody GoalCompletionRequest request) {
        return goals.updateCompletion(id, request.completed());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteGoal(@PathVariable long id) { goals.deleteGoal(id); }
}
