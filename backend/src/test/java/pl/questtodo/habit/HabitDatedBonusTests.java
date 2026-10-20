package pl.questtodo.habit;

import java.time.LocalDate;
import java.time.Instant;
import java.util.concurrent.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import pl.questtodo.user.CurrentUserProvider;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:habit_dated_bonus;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000")
class HabitDatedBonusTests {
    @Autowired HabitCompletionBonusService bonuses;
    @Autowired HabitRepository habits;
    @Autowired HabitService service;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean CurrentUserProvider currentUser;
    @MockitoBean HabitCalendar calendar;
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 5);

    @BeforeEach
    void prepare() {
        when(currentUser.getUserId()).thenReturn(1L);
        when(calendar.today()).thenReturn(TODAY);
        when(calendar.now()).thenReturn(Instant.parse("2026-10-05T10:00:00Z"));
        jdbc.update("DELETE FROM habits");
        jdbc.update("UPDATE users SET points = 10 WHERE id = 1");
    }

    private void seed(int successful, Integer bonus) {
        LocalDate start = TODAY.minusWeeks(10);
        jdbc.update("INSERT INTO habits(id,user_id,name,created_on,start_date,end_date,completion_bonus_points,required_success_percent,reward_points) "
                + "VALUES(1001,1,'Training',?,?,?,?,80,3)", start, start, TODAY.minusDays(1), bonus);
        jdbc.update("INSERT INTO habit_targets(habit_id,target_days,effective_from) VALUES(1001,2,?)", start);
        for (int week = 0; week < successful; week++)
            for (int day = 0; day < 2; day++)
                jdbc.update("INSERT INTO habit_completions(habit_id,completion_date) VALUES(1001,?)",
                        start.plusWeeks(week).plusDays(day));
    }

    private long balance() { return jdbc.queryForObject("SELECT points FROM users WHERE id=1", Long.class); }
    private int records() { return jdbc.queryForObject("SELECT count(*) FROM habit_completion_bonus_awards", Integer.class); }
    private void runJob() { new HabitBonusSettlementJob(habits, calendar, bonuses).settleDueHabits(); }

    @Test
    void exactThresholdSettlesOnceAndSurvivesNewJobInstance() {
        seed(8, 20);
        runJob();
        assertEquals(30, balance());
        assertEquals(1, records());
        runJob();
        bonuses.settle(1001);
        assertEquals(30, balance());
        assertTrue(habits.findUnsettledDatedBonuses(TODAY).isEmpty());
        var habit = service.getHabits(TODAY, true).getFirst();
        assertTrue(habit.completionBonusGranted());
        assertEquals(TODAY, habit.completionBonusSettledOn());
        assertEquals(8, habit.regularity().successfulWeeks());
        assertEquals(10, habit.regularity().totalWeeks());
        assertEquals(80, habit.regularity().successPercent().intValueExact());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM habit_weekly_awards", Integer.class));
    }

    @Test
    void failedAndEmptyHabitsAreAlsoPermanentlySettled() {
        for (int successful : new int[]{7, 0}) {
            jdbc.update("DELETE FROM habits");
            seed(successful, 20);
            runJob();
            assertEquals(10, balance());
            assertEquals(1, records());
            assertTrue(habits.findUnsettledDatedBonuses(TODAY).isEmpty());
            assertFalse(service.getHabits(TODAY, true).getFirst().completionBonusGranted());
            runJob();
            assertEquals(10, balance());
        }
    }

    @Test
    void aboveThresholdAndFullSuccessEarnBonus() {
        for (int successful : new int[]{9, 10}) {
            jdbc.update("DELETE FROM habits");
            jdbc.update("UPDATE users SET points=10 WHERE id=1");
            seed(successful, 20);
            runJob();
            assertEquals(30, balance());
        }
    }

    @Test
    void waitsUntilDayAfterInclusiveEndDateAndCatchesUpAfterDowntime() {
        seed(10, 20);
        when(calendar.today()).thenReturn(TODAY.minusDays(1));
        runJob();
        assertEquals(0, records());
        assertEquals(9, service.getHabits(TODAY.minusDays(1), true).getFirst().regularity().totalWeeks());
        when(calendar.today()).thenReturn(TODAY.plusDays(10));
        runJob();
        assertEquals(30, balance());
    }

    @Test
    void noBonusOrManualEarlyEndingDoesNotAward() {
        seed(10, null);
        runJob();
        assertEquals(0, records());
        jdbc.update("UPDATE habits SET completion_bonus_points=20,ended_on=?,end_reason='STOPPED' WHERE id=1001", TODAY.minusDays(5));
        runJob();
        bonuses.settle(1001);
        assertEquals(0, records());
        assertEquals(10, balance());
    }

    @Test
    void historyCorrectionReversesAndRestoresExistingAward() {
        seed(8, 20);
        runJob();
        var date = TODAY.minusWeeks(10);
        var removed = service.setCompletion(1001, date, false);
        assertEquals(10L, removed.balance());
        assertFalse(removed.habit().completionBonusGranted());
        assertEquals(7, removed.habit().regularity().successfulWeeks());
        var restored = service.setCompletion(1001, date, true);
        assertEquals(33L, restored.balance()); // Existing weekly mechanism awards its independent 3 points.
        assertTrue(restored.habit().completionBonusGranted());
        assertEquals(1, records());
        runJob();
        assertEquals(33, balance());
    }

    @Test
    void concurrentSettlementCreditsOnlyOnce() throws Exception {
        seed(8, 20);
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Callable<Void> action = () -> {
                ready.countDown();
                assertTrue(start.await(10, TimeUnit.SECONDS));
                bonuses.settle(1001);
                return null;
            };
            var first = pool.submit(action);
            var second = pool.submit(action);
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            first.get(15, TimeUnit.SECONDS);
            second.get(15, TimeUnit.SECONDS);
        }
        assertEquals(30, balance());
        assertEquals(1, records());
    }

    @Test
    void balanceFailureRollsBackSettlementAndAllowsRetry() {
        seed(8, 20);
        jdbc.update("UPDATE users SET points=? WHERE id=1", Long.MAX_VALUE);
        assertThrows(ArithmeticException.class, () -> bonuses.settle(1001));
        assertEquals(0, records());
        jdbc.update("UPDATE users SET points=10 WHERE id=1");
        runJob();
        assertEquals(30, balance());
    }

    @Test
    void alreadyActiveBonusIsMarkedSettledWithoutCreditingAgain() {
        seed(8, 20);
        jdbc.update("INSERT INTO habit_completion_bonus_awards(habit_id,points,active) VALUES(1001,20,true)");
        jdbc.update("UPDATE users SET points=30 WHERE id=1");
        runJob();
        assertEquals(30, balance());
        assertNotNull(service.getHabits(TODAY, true).getFirst().completionBonusSettledOn());
    }

    @Test
    void backgroundSettlementCreditsOwnerWithoutUsingSessionUser() {
        seed(8, 20);
        when(currentUser.getUserId()).thenThrow(new IllegalStateException("No session in background job"));
        runJob();
        assertEquals(30, balance());
    }

    @Test
    void differentHabitsSafelyCreditSharedAccount() throws Exception {
        seed(8, 20);
        jdbc.update("INSERT INTO habits(id,user_id,name,created_on,start_date,end_date,completion_bonus_points,required_success_percent) "
                + "SELECT 1002,user_id,'Second',created_on,start_date,end_date,completion_bonus_points,required_success_percent FROM habits WHERE id=1001");
        jdbc.update("INSERT INTO habit_targets(habit_id,target_days,effective_from) "
                + "SELECT 1002,target_days,effective_from FROM habit_targets WHERE habit_id=1001");
        jdbc.update("INSERT INTO habit_completions(habit_id,completion_date) "
                + "SELECT 1002,completion_date FROM habit_completions WHERE habit_id=1001");
        var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var first = pool.submit(() -> { start.await(); bonuses.settle(1001); return null; });
            var second = pool.submit(() -> { start.await(); bonuses.settle(1002); return null; });
            start.countDown();
            first.get(15, TimeUnit.SECONDS);
            second.get(15, TimeUnit.SECONDS);
        }
        assertEquals(50, balance());
        assertEquals(2, records());
    }
}
