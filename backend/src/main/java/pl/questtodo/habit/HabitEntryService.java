package pl.questtodo.habit;

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
public class HabitEntryService {
    private final HabitRepository habits;
    private final HabitEntryRepository entries;
    private final CurrentUserProvider currentUser;
    private final HabitCompletionRepository completions;
    private final HabitCalendar calendar;

    public HabitEntryService(HabitRepository habits, HabitEntryRepository entries, CurrentUserProvider currentUser, HabitCompletionRepository completions, HabitCalendar calendar) {
        this.habits = habits;
        this.entries = entries;
        this.currentUser = currentUser;
        this.completions = completions;
        this.calendar = calendar;
    }

    @Transactional(readOnly = true)
    public HabitEntries list(long habitId, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nieprawidłowe parametry stronicowania.");
        if (!habits.existsByIdAndUserId(habitId, currentUser.getUserId())) throw habitNotFound();
        var result = entries.findByHabitIdOrderByCreatedAtDescIdDesc(habitId, PageRequest.of(page, size));
        return new HabitEntries(result.stream().map(HabitEntryEntity::toResponse).toList(), result.hasNext(), result.getTotalElements());
    }

    public HabitEntryResponse create(long habitId, CreateHabitEntryRequest request) {
        HabitEntity habit = ownedForUpdate(habitId);
        requireWritable(habit);
        var entry = new HabitEntryEntity(habit, request.getType(), request.getContent().strip(), now());
        return entries.save(entry).toResponse();
    }

    public HabitEntryResponse update(long habitId, long entryId, UpdateHabitEntryRequest request) {
        HabitEntity habit = ownedForUpdate(habitId);
        HabitEntryEntity entry = findEntry(habitId, entryId);
        requireWritable(habit);
        entry.update(request.hasType() ? request.getType() : entry.getType(),
                request.hasContent() ? request.getContent().strip() : entry.getContent(), now());
        return entry.toResponse();
    }

    public void delete(long habitId, long entryId) {
        HabitEntity habit = ownedForUpdate(habitId);
        HabitEntryEntity entry = findEntry(habitId, entryId);
        requireWritable(habit);
        entries.delete(entry);
    }

    private void requireWritable(HabitEntity habit) {
        var today = calendar.today();
        boolean finished = habit.getEndedOn() != null && !today.isBefore(habit.getEndedOn());
        if (!today.isBefore(habit.getStartDate())) {
            finished |= habit.getEndDate() != null && today.isAfter(habit.getEndDate());
            finished |= habit.getCompletionLimit() != null
                    && completions.countByHabitIdAndDateLessThanEqual(habit.getId(), today) >= habit.getCompletionLimit();
        }
        if (finished) throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Dziennik zakończonego nawyku jest dostępny tylko do odczytu.");
    }

    private HabitEntity ownedForUpdate(long habitId) {
        return habits.findForUpdate(habitId, currentUser.getUserId()).orElseThrow(HabitEntryService::habitNotFound);
    }

    private HabitEntryEntity findEntry(long habitId, long entryId) {
        return entries.findByIdAndHabitId(entryId, habitId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Wpis dziennika nie istnieje."));
    }

    private static ResponseStatusException habitNotFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Nawyk nie istnieje.");
    }

    // Match the database's microsecond timestamp precision for stable POST/GET responses.
    private static Instant now() { return Instant.now().truncatedTo(ChronoUnit.MICROS); }
}
