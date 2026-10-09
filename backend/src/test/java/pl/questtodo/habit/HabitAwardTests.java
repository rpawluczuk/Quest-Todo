package pl.questtodo.habit;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.user.CurrentUserProvider;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:habit_awards;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000")
@Transactional
class HabitAwardTests {
    @Autowired HabitService service;
    @Autowired JdbcTemplate jdbc;
    @Autowired jakarta.persistence.EntityManager entityManager;
    @MockitoBean CurrentUserProvider currentUser;
    @MockitoBean HabitCalendar calendar;
    static final LocalDate TODAY = LocalDate.of(2026, 10, 9);
    static final Instant NOW = Instant.parse("2026-10-09T12:00:00Z");

    @BeforeEach
    void prepare() {
        when(currentUser.getUserId()).thenReturn(1L);
        when(calendar.today()).thenReturn(TODAY);
        when(calendar.now()).thenReturn(NOW);
        jdbc.update("DELETE FROM habits");
        jdbc.update("UPDATE users SET points = 10 WHERE id = 1");
        jdbc.update("DELETE FROM users WHERE id = 2");
        jdbc.update("INSERT INTO users(id, name, points) VALUES (2, 'Other', 0)");
        jdbc.update("INSERT INTO habits(id, user_id, name, created_on, reward_points) VALUES (1001, 1, 'Training', '2026-10-01', 100), (1002, 1, 'Reading', '2026-10-01', 30), (2001, 2, 'Private', '2026-10-01', 500)");
        jdbc.update("INSERT INTO habit_targets(habit_id, target_days, effective_from) VALUES (1001, 2, '2026-09-28'), (1002, 1, '2026-09-28'), (2001, 1, '2026-09-28')");
    }

    long balance() {
        if (org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()) entityManager.flush();
        return jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Long.class);
    }
    long awards() { return jdbc.queryForObject("SELECT count(*) FROM habit_weekly_awards", Long.class); }
    HabitCompletionResult earn() {
        assertNull(service.setCompletion(1001, TODAY.minusDays(1), true).award());
        return service.setCompletion(1001, TODAY, true);
    }

    @Test void awardsOnceDespiteExtraCompletionsUncheckingAndRepeatedRequests() {
        var result = earn();
        assertEquals(100, result.award().points());
        assertEquals(NOW.plusSeconds(8), result.award().undoUntil());
        assertEquals(110L, result.balance());
        assertNull(service.setCompletion(1001, TODAY, true).award());
        assertNull(service.setCompletion(1001, TODAY.minusDays(2), true).award());
        service.setCompletion(1001, TODAY, false);
        service.setCompletion(1001, TODAY.minusDays(1), false);
        assertNull(service.setCompletion(1001, TODAY, true).award());
        assertEquals(110, balance());
        assertEquals(1, awards());
    }

    @Test void undoRemovesOnlyTriggeringCompletionAndAllowsEarningAgain() {
        var result = earn();
        service.setCompletion(1001, TODAY.minusDays(2), true);
        when(calendar.now()).thenReturn(NOW.plusSeconds(7));
        var undone = service.undoAward(1001, result.award().id());
        assertEquals(10L, undone.balance());
        assertFalse(undone.habit().completed());
        assertEquals(2, undone.habit().weeklyCompletedDays());
        assertEquals(0, awards());
        var again = service.setCompletion(1001, TODAY, true);
        assertNotNull(again.award());
        assertNotEquals(result.award().id(), again.award().id());
        assertThrows(ResponseStatusException.class, () -> service.undoAward(1001, result.award().id()));
        assertEquals(110, balance());
    }

    @Test void rejectsUndoAtDeadlineAndKeepsPointsAfterOrdinaryUncheck() {
        var result = earn();
        when(calendar.now()).thenReturn(NOW.plusSeconds(8));
        var error = assertThrows(ResponseStatusException.class, () -> service.undoAward(1001, result.award().id()));
        assertEquals(409, error.getStatusCode().value());
        service.setCompletion(1001, TODAY, false);
        assertEquals(110, balance());
        assertEquals(1, awards());
    }

    @Test void undoUsesHistoricalAmountAndCannotBeRepeated() {
        var result = earn();
        service.updateHabit(1001, "New name", 2, 999);
        assertEquals(100, jdbc.queryForObject("SELECT points FROM habit_weekly_awards WHERE habit_id = 1001", Integer.class));
        service.undoAward(1001, result.award().id());
        assertEquals(10, balance());
        assertThrows(ResponseStatusException.class, () -> service.undoAward(1001, result.award().id()));
        var again = service.setCompletion(1001, TODAY, true);
        assertEquals(999, again.award().points());
        assertEquals(1009, balance());
    }

    @Test void staleUndoCannotRemoveARecreatedCompletion() {
        var result = earn();
        service.setCompletion(1001, TODAY, false);
        service.setCompletion(1001, TODAY, true);
        assertThrows(ResponseStatusException.class, () -> service.undoAward(1001, result.award().id()));
        assertEquals(110, balance());
        assertTrue(service.getHabits(TODAY).getFirst().completed());
    }

    @Test void ownerIsolationAndSeparateWeeks() {
        assertThrows(ResponseStatusException.class, () -> service.setCompletion(2001, TODAY, true));
        var result = earn();
        when(currentUser.getUserId()).thenReturn(2L);
        assertThrows(ResponseStatusException.class, () -> service.undoAward(1001, result.award().id()));
        when(currentUser.getUserId()).thenReturn(1L);
        service.setCompletion(1001, TODAY.minusWeeks(1), true);
        var previous = service.setCompletion(1001, TODAY.minusWeeks(1).minusDays(1), true);
        assertNotNull(previous.award());
        assertEquals(210, balance());
        assertEquals(2, awards());
        assertThrows(ResponseStatusException.class,
                () -> service.setCompletion(1001, LocalDate.of(2026, 9, 20), true));
    }

    @Test void zeroPointRewardIsStillRecordedOnce() {
        service.updateHabit(1001, "Training", 2, 0);
        assertEquals(0, earn().award().points());
        service.updateHabit(1001, "Training", 2, 100);
        service.setCompletion(1001, TODAY, false);
        assertNull(service.setCompletion(1001, TODAY, true).award());
        assertEquals(10, balance());
    }

    @Test void loweringCurrentGoalAwardsImmediatelyAndUndoRemovesLatestCompletion() {
        jdbc.update("UPDATE habit_targets SET target_days = 3 WHERE habit_id = 1001");
        service.setCompletion(1001, TODAY.minusDays(2), true);
        service.setCompletion(1001, TODAY.minusDays(1), true);
        var result = service.updateHabit(1001, "Training", 2, 100);
        assertNotNull(result.award());
        assertEquals(100, result.award().points());
        assertEquals(110, result.balance());
        assertTrue(result.habit().weeklyRewardGranted());
        var undone = service.undoAward(1001, result.award().id());
        assertEquals(1, undone.habit().weeklyCompletedDays());
        assertFalse(undone.habit().weeklyRewardGranted());
        assertFalse(service.getHabits(TODAY.minusDays(1)).getFirst().completed());
    }

    @Test void raisingGoalAfterAwardKeepsHistoricalPointsAndShowsAwardedStatus() {
        var earned = earn();
        assertTrue(earned.habit().weeklyRewardGranted());
        var changed = service.updateHabit(1001, "Training", 5, 999);
        assertNull(changed.award());
        assertEquals(110, balance());
        assertFalse(changed.habit().weeklyCompletedDays() >= changed.habit().target().targetDays());
        assertTrue(changed.habit().weeklyRewardGranted());
        assertEquals(100, jdbc.queryForObject("SELECT points FROM habit_weekly_awards WHERE habit_id = 1001", Integer.class));
        for (int offset = 2; offset <= 4; offset++)
            assertNull(service.setCompletion(1001, TODAY.minusDays(offset), true).award());
        var reachedAgain = service.getHabits(TODAY).getFirst();
        assertEquals(5, reachedAgain.weeklyCompletedDays());
        assertTrue(reachedAgain.weeklyRewardGranted());
        assertEquals(110, balance());
        service.updateHabit(1001, "Training", 1, 500);
        assertEquals(110, balance());
        assertEquals(1, awards());
    }

    @Test void increasingOrKeepingGoalBeforeAwardDoesNotGrantPoints() {
        jdbc.update("UPDATE habit_targets SET target_days = 3 WHERE habit_id = 1001");
        service.setCompletion(1001, TODAY.minusDays(1), true);
        service.setCompletion(1001, TODAY, true);
        assertNull(service.updateHabit(1001, "Training", 5, 100).award());
        assertNull(service.updateHabit(1001, "Renamed", 5, 200).award());
        assertEquals(10, balance());
        assertEquals(0, awards());
    }

    @Test void awardedStatusIsScopedToTheViewedWeek() {
        earn();
        assertTrue(service.getHabits(TODAY).getFirst().weeklyRewardGranted());
        assertFalse(service.getHabits(TODAY.minusWeeks(1)).getFirst().weeklyRewardGranted());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void simultaneousCompletionsAndUndosCannotDuplicatePoints() throws Exception {
        try {
            service.setCompletion(1001, TODAY.minusDays(1), true);
            var results = concurrently(() -> service.setCompletion(1001, TODAY, true),
                    () -> service.setCompletion(1001, TODAY.minusDays(2), true));
            assertEquals(1, results.stream().filter(r -> r.award() != null).count());
            assertEquals(110, balance());
            assertEquals(1, awards());
            UUID id = results.stream().filter(r -> r.award() != null).findFirst().orElseThrow().award().id();
            Callable<Boolean> undo = () -> {
                try { service.undoAward(1001, id); return true; }
                catch (ResponseStatusException e) { return false; }
            };
            assertEquals(1, concurrently(undo, undo).stream().filter(Boolean::booleanValue).count());
            assertEquals(10, balance());
            assertEquals(0, awards());
        } finally { jdbc.update("DELETE FROM habits"); }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void differentHabitsUpdateSharedBalanceWithoutLostUpdates() throws Exception {
        try {
            service.setCompletion(1001, TODAY.minusDays(1), true);
            concurrently(() -> service.setCompletion(1001, TODAY, true), () -> service.setCompletion(1002, TODAY, true));
            assertEquals(140, balance());
            assertEquals(2, awards());
        } finally { jdbc.update("DELETE FROM habits"); }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void failedBalanceUpdateRollsBackCompletionAndAward() {
        try {
            jdbc.update("UPDATE users SET points = ? WHERE id = 1", Long.MAX_VALUE);
            assertThrows(ArithmeticException.class, () -> service.setCompletion(1002, TODAY, true));
            assertEquals(Long.MAX_VALUE, balance());
            assertEquals(0, awards());
            assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM habit_completions", Integer.class));
        } finally {
            jdbc.update("DELETE FROM habits");
            jdbc.update("UPDATE users SET points = 10 WHERE id = 1");
        }
    }

    private <T> java.util.List<T> concurrently(Callable<T> a, Callable<T> b) throws Exception {
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var futures = java.util.List.of(a, b).stream().map(action -> executor.submit(() -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Timeout");
                return action.call();
            })).toList();
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            return java.util.List.of(futures.get(0).get(15, TimeUnit.SECONDS), futures.get(1).get(15, TimeUnit.SECONDS));
        }
    }
}
