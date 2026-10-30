package pl.questtodo.goal;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/goals/{goalId}/entries")
public class GoalEntryController {
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public org.springframework.http.ProblemDetail handleBusinessError(org.springframework.web.server.ResponseStatusException exception) {
        return org.springframework.http.ProblemDetail.forStatusAndDetail(exception.getStatusCode(), exception.getReason());
    }

    private final GoalEntryService entries;
    public GoalEntryController(GoalEntryService entries) { this.entries = entries; }

    @GetMapping
    public GoalEntries list(@PathVariable long goalId, @RequestParam(defaultValue = "0") int page,
                            @RequestParam(defaultValue = "20") int size) {
        return entries.list(goalId, page, size);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GoalEntryResponse create(@PathVariable long goalId, @Valid @RequestBody CreateGoalEntryRequest request) {
        return entries.create(goalId, request);
    }

    @PatchMapping("/{entryId}")
    public GoalEntryResponse update(@PathVariable long goalId, @PathVariable long entryId,
                                    @Valid @RequestBody UpdateGoalEntryRequest request) {
        return entries.update(goalId, entryId, request);
    }

    @DeleteMapping("/{entryId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long goalId, @PathVariable long entryId) { entries.delete(goalId, entryId); }
}
