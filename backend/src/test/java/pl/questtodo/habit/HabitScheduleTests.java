package pl.questtodo.habit;

import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.user.CurrentUserProvider;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:habit_schedule;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
@Transactional
class HabitScheduleTests {
    @Autowired HabitService service;
    @MockitoBean CurrentUserProvider currentUser;
    @MockitoBean HabitCalendar calendar;
    static final LocalDate TODAY = LocalDate.of(2026, 10, 14);

    @BeforeEach void prepare() {
        when(currentUser.getUserId()).thenReturn(1L);
        when(calendar.today()).thenReturn(TODAY);
        when(calendar.now()).thenReturn(Instant.parse("2026-10-14T12:00:00Z"));
    }

    Habit create(LocalDate start, LocalDate end, Integer limit) {
        return service.createHabit("Training", 2, 10, "", start, end, limit);
    }

    @Test void defaultsToTodayWithoutAnEnd() {
        var habit = service.createHabit("Reading", 7);
        assertEquals(TODAY, habit.startDate());
        assertNull(habit.endDate());
        assertNull(habit.completionLimit());
        assertEquals("ACTIVE", habit.status());
    }

    @Test void backdatingCreatesHistoricalTargetAndAllowsHistoricalRewards() {
        var start = TODAY.minusWeeks(3);
        var habit = create(start, null, null);
        assertEquals(TODAY, habit.createdOn());
        assertFalse(service.getHabits(start).isEmpty());
        assertNull(service.setCompletion(habit.id(), start, true).award());
        assertEquals(10, service.setCompletion(habit.id(), start.plusDays(1), true).award().points());
        assertThrows(ResponseStatusException.class, () -> service.setCompletion(habit.id(), start.minusDays(1), true));
    }

    @Test void endDateIsInclusiveAndHistoryStaysAvailable() {
        var habit = create(TODAY.minusDays(2), TODAY.minusDays(1), null);
        assertEquals("FINISHED", habit.status());
        assertEquals("ACTIVE", service.setCompletion(habit.id(), TODAY.minusDays(1), true).habit().status());
        assertEquals("FINISHED", service.getHabits(TODAY).getFirst().status());
        assertThrows(ResponseStatusException.class, () -> service.setCompletion(habit.id(), TODAY, true));
    }

    @Test void futureHabitIsManageableButCannotBeCompleted() {
        var habit = create(TODAY.plusDays(2), null, null);
        assertEquals("UPCOMING", habit.status());
        assertTrue(service.getHabits(TODAY).isEmpty());
        assertEquals(habit.id(), service.getHabits(TODAY, true).getFirst().id());
        assertThrows(ResponseStatusException.class, () -> service.setCompletion(habit.id(), TODAY, true));
    }

    @Test void lifetimeLimitSpansWeeksAndOrdinaryUncheckReopensWithoutRevokingAward() {
        var habit = create(TODAY.minusWeeks(1), null, 3);
        service.setCompletion(habit.id(), TODAY.minusWeeks(1), true);
        service.setCompletion(habit.id(), TODAY.minusDays(1), true);
        var earned = service.setCompletion(habit.id(), TODAY, true);
        assertEquals(3, earned.habit().totalCompletions());
        assertEquals("FINISHED", earned.habit().status());
        assertNotNull(earned.award());
        assertEquals("ACTIVE", service.getHabits(TODAY.minusDays(1)).getFirst().status());
        assertNull(service.setCompletion(habit.id(), TODAY, true).award());
        var reopened = service.setCompletion(habit.id(), TODAY, false);
        assertEquals("ACTIVE", reopened.habit().status());
        assertTrue(reopened.habit().weeklyRewardGranted());
        assertNull(service.setCompletion(habit.id(), TODAY, true).award());
    }

    @Test void limitPreventsAdditionalCompletionsEvenInHistory() {
        var habit = create(TODAY.minusWeeks(1), null, 1);
        service.setCompletion(habit.id(), TODAY, true);
        assertThrows(ResponseStatusException.class, () -> service.setCompletion(habit.id(), TODAY.minusDays(1), true));
    }

    @Test void undoAwardReopensAndAllowsEarningAgain() {
        var habit = create(TODAY.minusDays(1), null, 2);
        service.setCompletion(habit.id(), TODAY.minusDays(1), true);
        var earned = service.setCompletion(habit.id(), TODAY, true);
        var undone = service.undoAward(habit.id(), earned.award().id());
        assertEquals("ACTIVE", undone.habit().status());
        assertEquals(1, undone.habit().totalCompletions());
        assertFalse(undone.habit().weeklyRewardGranted());
        assertNotNull(service.setCompletion(habit.id(), TODAY, true).award());
    }

    @Test void extendingScheduleReopensAndKeepsAwardSnapshot() {
        var habit = create(TODAY.minusDays(1), null, 2);
        service.setCompletion(habit.id(), TODAY.minusDays(1), true);
        service.setCompletion(habit.id(), TODAY, true);
        var changed = service.updateHabit(habit.id(), "Training", 3, 100, "", habit.startDate(), null, 4);
        assertEquals("ACTIVE", changed.habit().status());
        assertTrue(changed.habit().weeklyRewardGranted());
        assertNull(changed.award());
        assertNull(changed.balance());
    }

    @Test void startCanMoveEarlierAndCreatesTargetForEarlierWeeks() {
        var habit = create(TODAY, null, null);
        var start = TODAY.minusWeeks(2);
        service.updateHabit(habit.id(), "Training", 2, 10, "", start, null, null);
        var past = service.setCompletion(habit.id(), start, true).habit();
        assertNotNull(past.target());
        assertEquals(2, past.target().targetDays());
    }

    @Test void cannotExcludeExistingHistoryByEditingStart() {
        var habit = create(TODAY.minusDays(1), null, null);
        service.setCompletion(habit.id(), TODAY.minusDays(1), true);
        assertThrows(ResponseStatusException.class, () -> service.updateHabit(habit.id(), "Training", 2, 10, "", TODAY, null, null));
    }

    @Test void cannotExcludeExistingHistoryByEditingEnd() {
        var habit = create(TODAY.minusDays(1), null, null);
        service.setCompletion(habit.id(), TODAY, true);
        assertThrows(ResponseStatusException.class, () -> service.updateHabit(habit.id(), "Training", 2, 10, "", habit.startDate(), TODAY.minusDays(1), null));
    }

    @Test void rejectsConflictingEndConditions() {
        assertThrows(ResponseStatusException.class, () -> create(TODAY, TODAY, 10));
    }
    @Test void rejectsReversedDates() {
        assertThrows(ResponseStatusException.class, () -> create(TODAY, TODAY.minusDays(1), null));
    }
    @Test void rejectsZeroLimit() {
        assertThrows(ResponseStatusException.class, () -> create(TODAY, null, 0));
    }
    @Test void scheduleCannotBeChangedByAnotherUser() {
        var habit = create(TODAY, null, null);
        when(currentUser.getUserId()).thenReturn(999L);
        assertTrue(service.getHabits(TODAY, true).isEmpty());
        var error = assertThrows(ResponseStatusException.class, () -> service.updateHabit(habit.id(), "Other", 2, 10, "", TODAY, null, 2));
        assertEquals(404, error.getStatusCode().value());
    }
}
