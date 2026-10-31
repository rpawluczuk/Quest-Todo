package pl.questtodo.goal;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.user.CurrentUserProvider;

@Service
@Transactional
public class GoalEntryService {
    private final GoalRepository goals;
    private final GoalEntryRepository entries;
    private final CurrentUserProvider currentUser;

    public GoalEntryService(GoalRepository goals, GoalEntryRepository entries, CurrentUserProvider currentUser) {
        this.goals = goals;
        this.entries = entries;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public GoalEntries list(long goalId, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nieprawidłowe parametry stronicowania.");
        goals.findByIdAndUserId(goalId, currentUser.getUserId()).orElseThrow(GoalEntryService::goalNotFound);
        var result = entries.findByGoalIdOrderByCreatedAtDescIdDesc(goalId, PageRequest.of(page, size));
        return new GoalEntries(result.stream().map(GoalEntryEntity::toResponse).toList(), result.hasNext(), result.getTotalElements());
    }

    public GoalEntryResponse create(long goalId, CreateGoalEntryRequest request) {
        GoalEntity goal = ownedForUpdate(goalId);
        GoalService.requireActive(goal);
        var entry = new GoalEntryEntity(goal, request.getType(), request.getContent().strip(), now());
        return entries.save(entry).toResponse();
    }

    public GoalEntryResponse update(long goalId, long entryId, UpdateGoalEntryRequest request) {
        GoalEntity goal = ownedForUpdate(goalId);
        GoalEntryEntity entry = findEntry(goalId, entryId);
        GoalService.requireActive(goal);
        entry.update(request.hasType() ? request.getType() : entry.getType(),
                request.hasContent() ? request.getContent().strip() : entry.getContent(), now());
        return entry.toResponse();
    }

    public void delete(long goalId, long entryId) {
        GoalEntity goal = ownedForUpdate(goalId);
        GoalEntryEntity entry = findEntry(goalId, entryId);
        GoalService.requireActive(goal);
        entries.delete(entry);
    }

    private GoalEntity ownedForUpdate(long goalId) {
        return goals.findForUpdate(goalId, currentUser.getUserId()).orElseThrow(GoalEntryService::goalNotFound);
    }

    private GoalEntryEntity findEntry(long goalId, long entryId) {
        return entries.findByIdAndGoalId(entryId, goalId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Wpis dziennika nie istnieje."));
    }

    private static ResponseStatusException goalNotFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Cel nie istnieje.");
    }

    // Match the database's microsecond timestamp precision for stable POST/GET responses.
    private static Instant now() { return Instant.now().truncatedTo(ChronoUnit.MICROS); }
}
