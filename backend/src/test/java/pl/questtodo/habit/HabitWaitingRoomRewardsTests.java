package pl.questtodo.habit;

import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.user.CurrentUserProvider;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:habit_waiting_room_rewards;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
    "app.habits.waiting-room-enabled=true"
})
class HabitWaitingRoomRewardsTests {
    @Autowired HabitService service;
    @Autowired HabitCompletionBonusService bonuses;
    @Autowired HabitStatusService statuses;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean CurrentUserProvider currentUser;
    @MockitoBean HabitCalendar calendar;
    private static final LocalDate MONDAY = LocalDate.of(2026, 8, 31);
    private LocalDate today;
    @BeforeEach void prepare() {
        when(currentUser.getUserId()).thenReturn(1L);
        jdbc.update("DELETE FROM habits");
        jdbc.update("UPDATE users SET points=0 WHERE id=1");
        at(MONDAY);
    }
    private void at(LocalDate date) { at(date.atTime(12, 0).atZone(HabitCalendar.ZONE).toInstant()); }
    private void at(Instant instant) {
        today = instant.atZone(HabitCalendar.ZONE).toLocalDate();
        when(calendar.today()).thenReturn(today); when(calendar.now()).thenReturn(instant);
    }
    private long create(int target) { return create(target, null, null, null, null, null); }
    private long create(int target, Integer limit, Integer bonus, LocalDate end, Integer percent, HabitStatus status) {
        return service.createHabit("Training", target, 3, null, MONDAY, end, limit,
                List.of(), null, bonus, percent, status).id();
    }
    private HabitCompletionResult complete(long id, LocalDate day) { return service.setCompletion(id, day, true); }
    private Habit snapshot(long id) {
        return service.getHabits(today, true).stream().filter(h -> h.id() == id).findFirst().orElseThrow();
    }
    private long balance() { return jdbc.queryForObject("SELECT points FROM users WHERE id=1", Long.class); }
    private long awards(long id) { return jdbc.queryForObject("SELECT COUNT(*) FROM habit_weekly_awards WHERE habit_id=?", Long.class, id); }
    private void change(long id, HabitStatus status) { service.changeStatus(id, status); }
    private void conflict(Runnable action) {
        assertEquals(409, assertThrows(ResponseStatusException.class, action::run).getStatusCode().value());
    }

    @Test void fullActiveWeekRetainsStandardAwardAndIdempotence() {
        long id = create(3);
        for (int day = 0; day < 3; day++) { at(MONDAY.plusDays(day)); complete(id, today); }
        assertEquals(3, balance()); assertEquals(1, awards(id));
        assertNull(complete(id, today).award());
        assertEquals(3, snapshot(id).weeklyCompletedDays()); assertEquals(3, balance());
    }
    @Test void pauseBeforeThresholdPreservesProgressAndNoPointsAreGeneratedByTransitions() {
        long id = create(3);
        complete(id, MONDAY); at(MONDAY.plusDays(1)); complete(id, today);
        at(MONDAY.plusDays(2)); change(id, HabitStatus.PAUSED);
        assertEquals(2, snapshot(id).totalCompletions()); assertEquals(0, balance());
        conflict(() -> complete(id, today));
        at(MONDAY.plusDays(3)); conflict(() -> complete(id, today));
        assertEquals(0, awards(id)); assertEquals(2, snapshot(id).weeklyCompletedDays());
    }
    @Test void pauseAfterThresholdAndMultipleResumesNeverDuplicateWeeklyAward() {
        long id = create(3);
        for (int day = 0; day < 3; day++) { at(MONDAY.plusDays(day)); complete(id, today); }
        for (int day = 3; day < 6; day++) {
            at(MONDAY.plusDays(day)); change(id, HabitStatus.PAUSED);
            assertEquals(3, balance()); change(id, HabitStatus.ACTIVE); complete(id, today);
        }
        assertEquals(3, balance()); assertEquals(1, awards(id)); assertEquals(6, snapshot(id).totalCompletions());
    }
    @Test void resumeInSameWeekCombinesEarlierAndLaterCompletionsForFullAward() {
        long id = create(3);
        complete(id, MONDAY); at(MONDAY.plusDays(1)); change(id, HabitStatus.PAUSED);
        at(MONDAY.plusDays(4)); change(id, HabitStatus.ACTIVE);
        at(MONDAY.plusDays(5)); complete(id, today);
        at(MONDAY.plusDays(6)); assertEquals(3, complete(id, today).award().points());
        assertEquals(3, balance()); assertEquals(3, snapshot(id).weeklyCompletedDays());
    }
    @Test void wholePausedWeekRejectsWritesEvenAfterResumeAndTargetEditCannotCreateAward() {
        long id = create(3); change(id, HabitStatus.PAUSED);
        at(MONDAY.plusWeeks(1));
        for (int day = 0; day < 7; day++) {
            LocalDate date = MONDAY.plusDays(day);
            if (day == 0) continue; // Creation day had a real active interval before pause.
            conflict(() -> complete(id, date));
        }
        service.updateHabit(id, "Changed target", 1);
        assertEquals(0, balance()); assertEquals(0, awards(id));
        change(id, HabitStatus.ACTIVE);
        conflict(() -> complete(id, MONDAY.plusDays(2)));
        complete(id, today); assertEquals(3, balance());
    }
    @Test void plannedPeriodCannotBeBackfilledAfterStartAndNeverGeneratesProgress() {
        long id = create(1, null, null, null, null, HabitStatus.PLANNED);
        conflict(() -> complete(id, MONDAY));
        at(MONDAY.plusWeeks(2)); change(id, HabitStatus.ACTIVE);
        conflict(() -> complete(id, MONDAY.plusDays(3)));
        conflict(() -> complete(id, MONDAY.minusDays(1)));
        assertEquals(0, snapshot(id).totalCompletions()); assertEquals(0, balance());
        complete(id, today); assertEquals(3, balance());
    }
    @Test void plannedStartOnFridayRequiresFullWeeklyTargetAndLeavesStartWeekNeutral() {
        long id = create(3, null, 20, MONDAY.plusDays(20), 80, HabitStatus.PLANNED);
        at(MONDAY.plusDays(4)); change(id, HabitStatus.ACTIVE);
        conflict(() -> complete(id, MONDAY.plusDays(3)));
        at(MONDAY.plusDays(5)); complete(id, today);
        at(MONDAY.plusDays(6)); complete(id, today);
        assertEquals(2, snapshot(id).weeklyCompletedDays());
        assertEquals(0, balance()); assertEquals(0, awards(id));
        at(MONDAY.plusWeeks(1));
        assertEquals(0, snapshot(id).regularity().totalWeeks());
        for (int day = 0; day < 3; day++) { at(MONDAY.plusWeeks(1).plusDays(day)); complete(id, today); }
        assertEquals(3, balance()); assertEquals(1, awards(id));
        at(MONDAY.plusWeeks(2));
        assertEquals(1, snapshot(id).regularity().totalWeeks());
        assertEquals(1, snapshot(id).regularity().successfulWeeks());
    }
    @Test void pastActiveDaysRemainCorrectableDuringPauseWithoutAwardingForPausedDates() {
        long id = create(2);
        complete(id, MONDAY); at(MONDAY.plusDays(2)); change(id, HabitStatus.PAUSED);
        // Current day is blocked despite an earlier active interval on that date.
        conflict(() -> complete(id, today));
        assertNotNull(complete(id, MONDAY.plusDays(1)).award());
        assertEquals(3, balance());
        service.setCompletion(id, MONDAY, false);
        assertEquals(1, snapshot(id).totalCompletions());
        assertEquals(3, balance()); // Ordinary correction preserves an already earned weekly award.
        at(MONDAY.plusDays(4));
        conflict(() -> complete(id, MONDAY.plusDays(3)));
        complete(id, MONDAY); assertEquals(3, balance()); assertEquals(1, awards(id));
    }
    @Test void sameDayStatusChangesUseExactCurrentStatusButPastDatesUseAnyActiveInterval() {
        long id = create(7);
        var noon = MONDAY.atTime(12, 0).atZone(HabitCalendar.ZONE).toInstant();
        at(noon.plusSeconds(1)); change(id, HabitStatus.PAUSED); conflict(() -> complete(id, MONDAY));
        at(noon.plusSeconds(2)); change(id, HabitStatus.ACTIVE); complete(id, MONDAY);
        at(noon.plusSeconds(3)); change(id, HabitStatus.PAUSED);
        assertNull(complete(id, MONDAY).award()); // A retry is not a new execution.
        service.setCompletion(id, MONDAY, false);
        conflict(() -> complete(id, MONDAY));
        at(MONDAY.plusDays(1));
        complete(id, MONDAY); // Historical correction to the date with actual active time.
        assertEquals(1, snapshot(id).totalCompletions());
    }
    @Test void weeklyUndoDuringPauseKeepsExistingUndoWindowAndDoesNotGrantAnAwardOnResume() {
        long id = create(1);
        var result = complete(id, MONDAY);
        var now = calendar.now();
        at(now.plusSeconds(1)); change(id, HabitStatus.PAUSED);
        assertEquals(0, service.undoAward(id, result.award().id()).balance());
        change(id, HabitStatus.ACTIVE);
        assertEquals(0, balance()); assertEquals(0, snapshot(id).totalCompletions());
        complete(id, MONDAY); assertEquals(3, balance()); // Explicit undo still permits re-earning, as before.
    }
    @Test void countBonusAndLongTermProgressSurvivePauseAndReconcileOnlyOnExplicitCorrections() {
        long id = create(7, 3, 10, null, null, null);
        complete(id, MONDAY); at(MONDAY.plusDays(1)); complete(id, today);
        change(id, HabitStatus.PAUSED); assertEquals(2, snapshot(id).totalCompletions());
        at(MONDAY.plusWeeks(4)); change(id, HabitStatus.ACTIVE); complete(id, today);
        assertEquals(10, balance()); assertTrue(snapshot(id).completionBonusGranted());
        at(today.plusDays(1)); change(id, HabitStatus.PAUSED); change(id, HabitStatus.ACTIVE); change(id, HabitStatus.PAUSED);
        assertEquals(10, balance()); assertEquals(3, snapshot(id).totalCompletions());
        LocalDate trigger = MONDAY.plusWeeks(4);
        service.setCompletion(id, trigger, false); assertEquals(0, balance());
        assertFalse(snapshot(id).completionBonusGranted()); assertTrue(snapshot(id).completionBonusConditionsLocked());
        complete(id, trigger); complete(id, trigger);
        assertEquals(10, balance()); assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM habit_completion_bonus_awards WHERE habit_id=?", Integer.class, id));
        conflict(() -> service.updateHabit(id, "Changed", 7, 3, null, MONDAY, null, 4, List.of(), null, 11, null, true));
    }
    @Test void regularityAndDatedBonusIgnoreNeutralWeeksAndSettleOnlyAfterEndOnce() {
        LocalDate end = MONDAY.plusDays(13);
        long id = create(3, null, 20, end, 80, null);
        for (int day = 0; day < 3; day++) { at(MONDAY.plusDays(day)); complete(id, today); }
        at(MONDAY.plusWeeks(1).atStartOfDay(HabitCalendar.ZONE).toInstant()); change(id, HabitStatus.PAUSED);
        assertEquals(3, balance()); assertFalse(snapshot(id).completionBonusGranted());
        assertEquals(1, snapshot(id).regularity().totalWeeks());
        at(end); bonuses.settle(id); assertEquals(3, balance());
        at(end.plusDays(1)); bonuses.settle(id); bonuses.settle(id);
        assertEquals(23, balance()); assertTrue(snapshot(id).completionBonusGranted());
        assertEquals(1, snapshot(id).regularity().successfulWeeks()); assertEquals(1, snapshot(id).regularity().totalWeeks());
        change(id, HabitStatus.ACTIVE); change(id, HabitStatus.PAUSED); bonuses.settle(id);
        assertEquals(23, balance());
        // Explicit corrections still reconcile the same dated award; pausing itself does not.
        service.setCompletion(id, MONDAY, false);
        assertEquals(3, balance()); assertFalse(snapshot(id).completionBonusGranted());
        complete(id, MONDAY); complete(id, MONDAY); bonuses.settle(id);
        assertEquals(23, balance()); assertTrue(snapshot(id).completionBonusGranted());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM habit_completion_bonus_awards WHERE habit_id=?", Integer.class, id));
    }
    @Test void onlyNeutralWeeksNeverMeetEvenOnePercentAndDoNotGenerateFreeBonus() {
        LocalDate end = MONDAY.plusDays(13);
        long id = create(3, null, 20, end, 1, HabitStatus.PLANNED);
        at(end.plusDays(1)); bonuses.settle(id);
        assertEquals(0, balance()); assertEquals(0, snapshot(id).regularity().totalWeeks());
        assertNull(snapshot(id).regularity().successPercent()); assertFalse(snapshot(id).completionBonusGranted());
        assertNotNull(snapshot(id).completionBonusSettledOn());
        change(id, HabitStatus.ACTIVE); bonuses.settle(id); assertEquals(0, balance());
    }
    @Test void sixWeekRegularityIsTwoOfThreeWithNoPenaltyForPauseOrCompensationFromPartialWeek() {
        long id = create(3, null, 20, MONDAY.plusDays(41), 80, null);
        for (int day = 0; day < 3; day++) { at(MONDAY.plusDays(day)); complete(id, today); }
        at(MONDAY.plusWeeks(1)); complete(id, today); // Failed full week.
        at(MONDAY.plusWeeks(2).atStartOfDay(HabitCalendar.ZONE).toInstant()); change(id, HabitStatus.PAUSED);
        at(MONDAY.plusWeeks(4).plusDays(2)); change(id, HabitStatus.ACTIVE);
        for (int day = 3; day < 6; day++) { at(MONDAY.plusWeeks(4).plusDays(day)); complete(id, today); }
        for (int day = 0; day < 3; day++) { at(MONDAY.plusWeeks(5).plusDays(day)); complete(id, today); }
        at(MONDAY.plusWeeks(6)); bonuses.settle(id);
        var regularity = snapshot(id).regularity();
        assertEquals(3, regularity.totalWeeks()); assertEquals(2, regularity.successfulWeeks());
        assertEquals(new java.math.BigDecimal("66.67"), regularity.successPercent());
        assertEquals(9, balance()); assertFalse(snapshot(id).completionBonusGranted());
    }
    @Test void legacyHistoryPrefixPreservesOldResultsAndExistingBonusSettlement() {
        // Simulate a migrated record whose first known status starts after historical weeks.
        long id = create(1, null, 20, MONDAY.plusDays(13), 80, null);
        complete(id, MONDAY); at(MONDAY.plusWeeks(1)); complete(id, today);
        at(MONDAY.plusWeeks(2));
        jdbc.update("UPDATE habit_status_periods SET started_at=? WHERE habit_id=?", java.sql.Timestamp.from(calendar.now()), id);
        bonuses.settle(id); assertEquals(26, balance()); assertEquals(2, snapshot(id).regularity().successfulWeeks());
        change(id, HabitStatus.PAUSED); bonuses.settle(id); assertEquals(26, balance());
    }
    @Test void editingThresholdInWhollyPlannedPeriodCannotAwardAndTargetHistoryStillAdvancesAcrossNeutralWeeks() {
        long id = create(3, null, null, MONDAY.plusDays(27), null, HabitStatus.PLANNED);
        at(MONDAY.plusWeeks(1)); service.updateHabit(id, "Target changed", 1);
        assertEquals(0, balance()); assertEquals(0, awards(id));
        at(MONDAY.plusWeeks(2).atStartOfDay(HabitCalendar.ZONE).toInstant()); change(id, HabitStatus.ACTIVE);
        complete(id, today); at(MONDAY.plusWeeks(4));
        assertEquals(2, snapshot(id).regularity().totalWeeks());
        assertEquals(1, snapshot(id).regularity().successfulWeeks()); assertEquals(3, balance());
    }
    @Test void concurrentPauseAndCompletionAreSerializedAndCannotWriteAfterPauseWins() throws Exception {
        long id = create(1);
        var ready = new CountDownLatch(2); var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var pause = pool.submit(() -> { ready.countDown(); assertTrue(start.await(10, TimeUnit.SECONDS)); change(id, HabitStatus.PAUSED); return null; });
            var completion = pool.submit(() -> {
                ready.countDown(); assertTrue(start.await(10, TimeUnit.SECONDS));
                try { complete(id, MONDAY); return true; }
                catch (ResponseStatusException failure) { assertEquals(409, failure.getStatusCode().value()); return false; }
            });
            assertTrue(ready.await(10, TimeUnit.SECONDS)); start.countDown(); pause.get(15, TimeUnit.SECONDS);
            boolean saved = completion.get(15, TimeUnit.SECONDS);
            assertEquals(saved ? 1 : 0, snapshot(id).totalCompletions());
            assertEquals(saved ? 3 : 0, balance()); assertEquals(saved ? 1 : 0, awards(id));
        }
        if (snapshot(id).totalCompletions() == 1) service.setCompletion(id, MONDAY, false);
        conflict(() -> complete(id, MONDAY));
    }
    @Test void concurrentCompletionsAwardOnlyOnceAndResumeDoesNotReplayIt() throws Exception {
        long id = create(1); at(MONDAY.plusDays(6));
        var ready = new CountDownLatch(2); var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            List<Future<?>> futures = new ArrayList<>();
            for (LocalDate day : List.of(MONDAY.plusDays(5), MONDAY.plusDays(6))) futures.add(pool.submit(() -> {
                ready.countDown(); assertTrue(start.await(10, TimeUnit.SECONDS)); complete(id, day); return null;
            }));
            assertTrue(ready.await(10, TimeUnit.SECONDS)); start.countDown();
            for (var future : futures) future.get(15, TimeUnit.SECONDS);
        }
        assertEquals(3, balance()); assertEquals(1, awards(id)); assertEquals(2, snapshot(id).totalCompletions());
        change(id, HabitStatus.PAUSED); change(id, HabitStatus.ACTIVE); assertEquals(3, balance());
    }
}
