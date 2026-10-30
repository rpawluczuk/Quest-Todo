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
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.questtodo.habit.dto.HabitRequest;
import pl.questtodo.habit.dto.EndHabitRequest;
import pl.questtodo.habit.dto.HabitStatusRequest;

@RestController
@RequestMapping("/api/habits")
public class HabitController {
    @org.springframework.web.bind.annotation.ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public org.springframework.http.ProblemDetail handleBusinessError(org.springframework.web.server.ResponseStatusException exception) {
        return org.springframework.http.ProblemDetail.forStatusAndDetail(exception.getStatusCode(), exception.getReason());
    }

    private final HabitService habits;
    private final HabitStatusService statuses;

    public HabitController(HabitService habits, HabitStatusService statuses) {
        this.habits = habits;
        this.statuses = statuses;
    }

    @GetMapping
    public List<Habit> getHabits(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(defaultValue = "false") boolean includeInactive) {
        return habits.getHabits(date, includeInactive);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Habit createHabit(@Valid @RequestBody HabitRequest request) {
        return habits.createHabit(request.name().strip(), request.targetDays(), request.rewardPoints(), request.description(),
                request.startDate(), request.endDate(), request.completionLimit(), request.goalIds(), request.categoryId(),
                request.completionBonusPoints(), request.requiredSuccessPercent(), request.activityStatus());
    }

    @PutMapping("/{id}")
    public Habit updateHabit(@PathVariable long id, @Valid @RequestBody HabitRequest request) {
        rejectStatusEdit(request);
        return habits.updateHabit(id, request.name().strip(), request.targetDays(), request.rewardPoints(), request.description(),
                request.startDate(), request.endDate(), request.completionLimit(), request.goalIds(), request.categoryId(),
                request.completionBonusPoints(), request.requiredSuccessPercent(), Boolean.TRUE.equals(request.replaceCompletionBonus())).habit();
    }

    @PutMapping("/{id}/configuration")
    public HabitCompletionResult updateHabitConfiguration(@PathVariable long id,
                                                           @Valid @RequestBody HabitRequest request) {
        rejectStatusEdit(request);
        return habits.updateHabit(id, request.name().strip(), request.targetDays(), request.rewardPoints(), request.description(),
                request.startDate(), request.endDate(), request.completionLimit(), request.goalIds(), request.categoryId(),
                request.completionBonusPoints(), request.requiredSuccessPercent(), Boolean.TRUE.equals(request.replaceCompletionBonus()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteHabit(@PathVariable long id) {
        habits.deleteHabit(id);
    }

    @PutMapping("/{id}/ending")
    public Habit endHabit(@PathVariable long id, @Valid @RequestBody EndHabitRequest request) {
        return habits.endHabit(id, request.reason());
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

    @PatchMapping("/{id}/status")
    public Habit changeStatus(@PathVariable long id, @Valid @RequestBody HabitStatusRequest request) {
        return habits.changeStatus(id, request.status());
    }

    @GetMapping("/{id}/status-history")
    public List<HabitStatusPeriodResponse> statusHistory(@PathVariable long id) {
        return statuses.history(id);
    }

    private void rejectStatusEdit(HabitRequest request) {
        if (request.activityStatus() != null)
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Do zmiany statusu użyj endpointu /status.");
    }
}
