package pl.questtodo.habit;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import pl.questtodo.user.CurrentUserProvider;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:habit_completion_bonus_awards;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000")
@Transactional
class HabitCompletionBonusAwardTests {
    @Autowired HabitService service;
    @Autowired JdbcTemplate jdbc;
    @Autowired jakarta.persistence.EntityManager entityManager;
    @MockitoBean CurrentUserProvider currentUser;
    @MockitoBean HabitCalendar calendar;

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 9);

    @BeforeEach
    void prepare() {
        when(currentUser.getUserId()).thenReturn(1L);
        when(calendar.today()).thenReturn(TODAY);
        when(calendar.now()).thenReturn(Instant.parse("2026-10-09T12:00:00Z"));
        jdbc.update("DELETE FROM habits");
        jdbc.update("UPDATE users SET points = 10 WHERE id = 1");
        jdbc.update("INSERT INTO habits(id,user_id,name,created_on,start_date,completion_limit,completion_bonus_points,reward_points) "
                + "VALUES (1001,1,'Reading','2026-10-01','2026-10-01',2,15,3), "
                + "(1002,1,'No bonus','2026-10-01','2026-10-01',2,NULL,3)");
        jdbc.update("INSERT INTO habit_targets(habit_id,target_days,effective_from) "
                + "VALUES (1001,2,'2026-09-28'), (1002,2,'2026-09-28')");
    }

    private long balance() {
        entityManager.flush();
        return jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Long.class);
    }

    private boolean active(long habitId) {
        entityManager.flush();
        return jdbc.queryForObject("SELECT active FROM habit_completion_bonus_awards WHERE habit_id = ?",
                Boolean.class, habitId);
    }

    @Test
    void awardsAtLimitOnceAndReversesAndRestoresWithoutChangingWeeklyAward() {
        assertNull(service.setCompletion(1001, TODAY.minusDays(1), true).balance());
        assertEquals(10, balance());
        var reached = service.setCompletion(1001, TODAY, true);
        assertEquals(28L, reached.balance()); // 10 initial + 3 weekly + 15 completion bonus
        assertEquals(3, reached.award().points());
        assertTrue(active(1001));
        assertEquals(28, balance());

        assertNull(service.setCompletion(1001, TODAY, true).balance());
        assertEquals(28, balance());
        var removed = service.setCompletion(1001, TODAY.minusDays(1), false);
        assertEquals(13L, removed.balance());
        assertFalse(active(1001));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM habit_weekly_awards", Integer.class));

        var restored = service.setCompletion(1001, TODAY.minusDays(1), true);
        assertEquals(28L, restored.balance());
        assertNull(restored.award()); // the weekly award is not paid again
        assertTrue(active(1001));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM habit_completion_bonus_awards", Integer.class));
        assertEquals(15, jdbc.queryForObject("SELECT points FROM habit_completion_bonus_awards WHERE habit_id = 1001", Integer.class));
    }

    @Test
    void noConfiguredBonusPreservesOldBehavior() {
        service.setCompletion(1002, TODAY.minusDays(1), true);
        var reached = service.setCompletion(1002, TODAY, true);
        assertEquals(13L, reached.balance());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM habit_completion_bonus_awards", Integer.class));
        service.setCompletion(1002, TODAY, false);
        assertEquals(13, balance());
    }

    @Test
    void completionBonusDoesNotDependOnWeeklyTarget() {
        jdbc.update("UPDATE habit_targets SET target_days = 7 WHERE habit_id = 1001");
        service.setCompletion(1001, TODAY.minusDays(1), true);
        var reached = service.setCompletion(1001, TODAY, true);
        assertNull(reached.award());
        assertEquals(25L, reached.balance());
        assertTrue(active(1001));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM habit_weekly_awards", Integer.class));
    }

    @Test
    void undoingWeeklyAwardAlsoReversesBonusWhenItRemovesThresholdCompletion() {
        service.setCompletion(1001, TODAY.minusDays(1), true);
        var reached = service.setCompletion(1001, TODAY, true);
        var undone = service.undoAward(1001, reached.award().id());
        assertEquals(10L, undone.balance()); // both awards are reversed
        assertFalse(active(1001));
        assertEquals(1, undone.habit().totalCompletions());
        var again = service.setCompletion(1001, TODAY, true);
        assertEquals(28L, again.balance());
        assertNotNull(again.award());
        assertTrue(active(1001));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void simultaneousFinalCompletionsCannotDuplicateBonus() throws Exception {
        try {
            service.setCompletion(1001, TODAY.minusDays(2), true);
            var ready = new CountDownLatch(2);
            var start = new CountDownLatch(1);
            try (var executor = Executors.newFixedThreadPool(2)) {
                List<Callable<HabitCompletionResult>> actions = List.of(
                        () -> service.setCompletion(1001, TODAY.minusDays(1), true),
                        () -> service.setCompletion(1001, TODAY, true));
                var futures = actions.stream().map(action -> executor.submit(() -> {
                    ready.countDown();
                    assertTrue(start.await(10, TimeUnit.SECONDS));
                    return action.call();
                })).toList();
                assertTrue(ready.await(10, TimeUnit.SECONDS));
                start.countDown();
                int success = 0;
                for (var future : futures) {
                    try { future.get(15, TimeUnit.SECONDS); success++; }
                    catch (java.util.concurrent.ExecutionException e) {
                        assertInstanceOf(org.springframework.web.server.ResponseStatusException.class, e.getCause());
                    }
                }
                assertEquals(1, success);
            }
            assertEquals(28, jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Long.class));
            assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM habit_completion_bonus_awards WHERE active", Integer.class));
        } finally {
            jdbc.update("DELETE FROM habits");
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void overflowingBalanceRollsBackCompletionAndBonus() {
        try {
            jdbc.update("UPDATE habit_targets SET target_days = 7 WHERE habit_id = 1001");
            service.setCompletion(1001, TODAY.minusDays(1), true);
            jdbc.update("UPDATE users SET points = ? WHERE id = 1", Long.MAX_VALUE - 10);
            assertThrows(ArithmeticException.class, () -> service.setCompletion(1001, TODAY, true));
            assertEquals(Long.MAX_VALUE - 10, jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Long.class));
            assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM habit_completions WHERE habit_id = 1001", Integer.class));
            assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM habit_completion_bonus_awards", Integer.class));
        } finally {
            jdbc.update("DELETE FROM habits");
            jdbc.update("UPDATE users SET points = 10 WHERE id = 1");
        }
    }
}
