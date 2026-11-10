package pl.questtodo.habit;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/habits/{habitId}/entries")
public class HabitEntryController {
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public org.springframework.http.ProblemDetail handleBusinessError(org.springframework.web.server.ResponseStatusException exception) {
        return org.springframework.http.ProblemDetail.forStatusAndDetail(exception.getStatusCode(), exception.getReason());
    }

    private final HabitEntryService entries;
    public HabitEntryController(HabitEntryService entries) { this.entries = entries; }

    @GetMapping
    public HabitEntries list(@PathVariable long habitId, @RequestParam(defaultValue = "0") int page,
                            @RequestParam(defaultValue = "20") int size) {
        return entries.list(habitId, page, size);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HabitEntryResponse create(@PathVariable long habitId, @Valid @RequestBody CreateHabitEntryRequest request) {
        return entries.create(habitId, request);
    }

    @PatchMapping("/{entryId}")
    public HabitEntryResponse update(@PathVariable long habitId, @PathVariable long entryId,
                                    @Valid @RequestBody UpdateHabitEntryRequest request) {
        return entries.update(habitId, entryId, request);
    }

    @DeleteMapping("/{entryId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long habitId, @PathVariable long entryId) { entries.delete(habitId, entryId); }
}
