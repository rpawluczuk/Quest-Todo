package pl.questtodo.habit;

import java.time.LocalDate;
import java.time.Instant;
import java.time.DayOfWeek;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.concurrent.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.user.CurrentUserProvider;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:habit_bonus_configuration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000")
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
class HabitBonusConfigurationTests {
    @Autowired HabitService service;
    @Autowired HabitCompletionBonusService bonuses;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @MockitoBean CurrentUserProvider currentUser;
    @MockitoBean HabitCalendar calendar;
    static final LocalDate TODAY = LocalDate.of(2026, 10, 21);
    static final LocalDate START = TODAY.minusDays(150);

    @BeforeEach void prepare() {
        when(currentUser.getUserId()).thenReturn(1L);
        when(calendar.today()).thenReturn(TODAY);
        when(calendar.now()).thenReturn(Instant.parse("2026-10-21T12:00:00Z"));
        jdbc.update("DELETE FROM habits");
        jdbc.update("UPDATE users SET points=10 WHERE id=1");
    }
    void count(int limit, Integer bonus, int completed) {
        jdbc.update("INSERT INTO habits(id,user_id,name,created_on,start_date,completion_limit,completion_bonus_points,reward_points) VALUES(1001,1,'Original',?,?,?,?,0)", START, START, limit, bonus);
        jdbc.update("INSERT INTO habit_targets(habit_id,target_days,effective_from) VALUES(1001,7,?)", START.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)));
        for (int i=0;i<completed;i++) completion(START.plusDays(i));
    }
    void dated(boolean success) {
        // Monday-Tuesday final partial week; target 7 requires both days.
        var monday = TODAY.minusDays(2);
        jdbc.update("INSERT INTO habits(id,user_id,name,created_on,start_date,end_date,completion_bonus_points,required_success_percent,reward_points) VALUES(1001,1,'Original',?,?,?,20,100,0)", monday, monday, TODAY.minusDays(1));
        jdbc.update("INSERT INTO habit_targets(habit_id,target_days,effective_from) VALUES(1001,7,?)", monday);
        completion(monday);
        if (success) completion(monday.plusDays(1));
    }
    void completion(LocalDate date) { jdbc.update("INSERT INTO habit_completions(habit_id,completion_date) VALUES(1001,?)", date); }
    void pendingEntry(int points) { jdbc.update("INSERT INTO habit_completion_bonus_awards(habit_id,points,active,ever_granted) VALUES(1001,?,false,false)", points); }
    Habit habit() { return service.getHabits(TODAY,true).getFirst(); }
    long balance() { return jdbc.queryForObject("SELECT points FROM users WHERE id=1",Long.class); }
    HabitCompletionResult edit(LocalDate start, LocalDate end, Integer limit, Integer bonus, Integer percent, Integer target) {
        return service.updateHabit(1001,"Edited",target,0,"note",start,end,limit,List.of(),null,bonus,percent,true);
    }
    void conflict(Runnable action) {
        var error=assertThrows(ResponseStatusException.class,action::run);
        assertEquals(409,error.getStatusCode().value());
        assertNotNull(error.getReason());
    }
    void assertLocked(boolean granted) {
        var h=habit();
        assertEquals(granted,h.completionBonusGranted());
        assertTrue(h.completionBonusConditionsLocked());
        assertEquals(Boolean.TRUE,h.completionBonusEverGranted());
    }

    @Test void loweringLimitAwardsImmediatelyAndReturnsFinishedSnapshot() {
        count(150,20,100);
        var result=edit(START,null,100,20,null,7);
        assertEquals(30L,result.balance());
        assertEquals("FINISHED",result.habit().status());
        assertEquals(20,result.habit().completionBonusAwardPoints());
        assertFalse(result.habit().completionBonusTargetLocked());
        assertLocked(true);
        assertNull(edit(START,null,100,20,null,7).balance());
        assertEquals(30,balance());
    }
    @Test void changingUnreachedLimitsDoesNotAward() {
        count(150,20,100);
        assertNull(edit(START,null,120,20,null,7).balance());
        assertEquals("ACTIVE",habit().status());
        assertNull(edit(START,null,200,20,null,7).balance());
        assertEquals(10,balance());
        assertFalse(habit().completionBonusConditionsLocked());
    }
    @Test void removingNeverPaidBonusCannotReactivatePendingEntry() {
        count(2,20,1);
        pendingEntry(20);
        edit(START,null,2,null,null,7);
        var completed=service.setCompletion(1001,START.plusDays(1),true);
        assertNull(completed.balance());
        assertEquals(10,balance());
        assertEquals("FINISHED",completed.habit().status());
        assertFalse(completed.habit().completionBonusGranted());
        assertEquals(Boolean.FALSE,completed.habit().completionBonusEverGranted());
    }
    @Test void firstPaymentUsesNewAmountWithAndWithoutPendingEntry() {
        for(boolean pending:List.of(false,true)) {
            jdbc.update("DELETE FROM habits");
            jdbc.update("UPDATE users SET points=10 WHERE id=1");
            count(3,20,2);
            if(pending) pendingEntry(20);
            assertNull(edit(START,null,3,50,null,7).balance());
            var result=service.setCompletion(1001,START.plusDays(2),true);
            assertEquals(60L,result.balance());
            assertEquals(50,result.habit().completionBonusPoints());
            assertEquals(50,result.habit().completionBonusAwardPoints());
        }
    }
    @Test void unpaidDatedEntryUsesNewAmountBeforeFinalSettlement() {
        dated(false);
        edit(TODAY.minusDays(2),TODAY.plusDays(1),null,20,50,7);
        pendingEntry(20);
        edit(TODAY.minusDays(2),TODAY.plusDays(1),null,50,50,2);
        when(calendar.today()).thenReturn(TODAY.plusDays(2));
        // One completion meets ceil(2*4/7)=2 only after the second completion.
        service.setCompletion(1001,TODAY.minusDays(1),true);
        bonuses.settle(1001);
        assertEquals(60,balance());
        assertEquals(50,habit().completionBonusAwardPoints());
        assertEquals(50,habit().completionBonusPoints());
        assertLocked(true);
    }
    @Test void legacyInactiveRowWithoutConfiguredBonusCannotPay() {
        count(2,null,1);
        jdbc.update("INSERT INTO habit_completion_bonus_awards(habit_id,points,active) VALUES(1001,20,false)");
        service.setCompletion(1001,START.plusDays(1),true);
        assertEquals(10,balance());
        assertFalse(habit().completionBonusGranted());
        assertNull(habit().completionBonusAwardPoints());
        assertNull(habit().completionBonusEverGranted());
    }
    @Test void correctionsAllowDebtAndRestoreOriginalAmountWithoutUnlocking() {
        count(2,30,1);
        service.setCompletion(1001,START.plusDays(1),true);
        jdbc.update("UPDATE users SET points=0 WHERE id=1"); // Points already spent.
        var removed=service.setCompletion(1001,START,false);
        assertEquals(-30L,removed.balance());
        assertEquals("ACTIVE",removed.habit().status());
        assertLocked(false);
        conflict(()->edit(START,null,3,30,null,7));
        conflict(()->edit(START,null,2,50,null,7));
        conflict(()->edit(START,null,2,null,null,7));
        assertEquals(-30,balance());
        var restored=service.setCompletion(1001,START,true);
        assertEquals(0L,restored.balance());
        assertLocked(true);
        assertNull(service.setCompletion(1001,START,true).balance());
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM habit_completion_bonus_awards",Integer.class));
    }
    @Test void paidConditionsRejectAllChangesAndHttpConflictRollsBackEntireEdit() throws Exception {
        count(2,20,1);
        service.setCompletion(1001,START.plusDays(1),true);
        conflict(()->edit(START,null,3,20,null,7));
        conflict(()->edit(START,null,2,50,null,7));
        conflict(()->edit(START,null,2,null,null,7));
        conflict(()->edit(START,null,null,null,null,7));
        conflict(()->edit(START,TODAY,null,20,80,7));
        conflict(()->edit(START.minusDays(1),null,2,20,null,7));
        mvc.perform(put("/api/habits/1001/configuration").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Should rollback\",\"description\":\"changed\",\"rewardPoints\":99,\"completionBonusPoints\":50,\"replaceCompletionBonus\":true}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").isNotEmpty());
        assertEquals("Original",habit().name());
        assertNull(habit().description());
        assertEquals(0,habit().rewardPoints());
        assertEquals(2,habit().totalCompletions());
        assertEquals(30,balance());
    }
    @Test void unrelatedEditsAndCountWeeklyTargetRemainAllowed() {
        count(2,20,1);
        service.setCompletion(1001,START.plusDays(1),true);
        var result=edit(START,null,2,20,null,5);
        assertEquals("Edited",result.habit().name());
        assertEquals("note",result.habit().description());
        assertEquals(5,result.habit().latestTarget().targetDays());
        assertEquals(30,balance());
        assertLocked(true);
    }
    @Test void unpaidEndingModeSwitchAndDisableCannotPayOldAmount() {
        count(2,20,1);
        pendingEntry(20);
        edit(START,TODAY.plusDays(10),null,50,80,7);
        assertEquals(10,balance());
        assertNull(habit().completionBonusSettledOn());
        edit(START,null,null,null,null,7);
        service.setCompletion(1001,START.plusDays(1),true);
        assertEquals(10,balance());
        assertFalse(habit().completionBonusGranted());
        var result=edit(START,null,2,60,null,7);
        assertEquals(70L,result.balance());
        assertEquals(60,result.habit().completionBonusAwardPoints());
    }
    @Test void datedSuccessAndFailureBothPermanentlyLockConditionsAndManualEnding() {
        for(boolean success:List.of(false,true)) {
            jdbc.update("DELETE FROM habits");
            jdbc.update("UPDATE users SET points=10 WHERE id=1");
            dated(success);
            bonuses.settle(1001);
            assertEquals(success ? 30:10,balance());
            assertEquals(Boolean.valueOf(success),habit().completionBonusEverGranted());
            assertTrue(habit().completionBonusConditionsLocked());
            assertTrue(habit().completionBonusTargetLocked());
            conflict(()->edit(TODAY.minusDays(2),TODAY,null,20,100,7));
            conflict(()->edit(TODAY.minusDays(2),TODAY.minusDays(1),null,20,50,7));
            conflict(()->edit(TODAY.minusDays(2),TODAY.minusDays(1),null,50,100,7));
            conflict(()->edit(TODAY.minusDays(2),TODAY.minusDays(1),null,null,null,7));
            conflict(()->edit(TODAY.minusDays(2),null,10,20,null,7));
            conflict(()->edit(TODAY.minusDays(2),TODAY.minusDays(1),null,20,100,2));
            conflict(()->service.endHabit(1001,HabitEndReason.STOPPED));
            assertNull(habit().endedOn());
            assertEquals("FINISHED",habit().status());
            var unchanged=edit(TODAY.minusDays(2),TODAY.minusDays(1),null,20,100,7);
            assertEquals("Edited",unchanged.habit().name());
            assertEquals(success ? 30:10,balance());
        }
    }
    @Test void datedHistoryCorrectionsKeepFinalDateAndOriginalConditions() {
        dated(false);
        bonuses.settle(1001);
        var originalSettlement=habit().completionBonusSettledOn();
        when(calendar.today()).thenReturn(TODAY.plusDays(1));
        var earned=service.setCompletion(1001,TODAY.minusDays(1),true);
        assertEquals(30L,earned.balance());
        assertEquals(originalSettlement,earned.habit().completionBonusSettledOn());
        assertLocked(true);
        var removed=service.setCompletion(1001,TODAY.minusDays(1),false);
        assertEquals(10L,removed.balance());
        assertLocked(false);
        conflict(()->edit(TODAY.minusDays(2),TODAY.minusDays(1),null,20,50,7));
        assertEquals(30L,service.setCompletion(1001,TODAY.minusDays(1),true).balance());
    }
    @Test void manualEarlyEndingNeverPaysEvenAfterLaterHistoryCompletionOrScheduler() {
        dated(false);
        edit(TODAY.minusDays(2),TODAY.plusDays(10),null,20,100,7);
        service.endHabit(1001,HabitEndReason.STOPPED);
        service.setCompletion(1001,TODAY.minusDays(1),true);
        when(calendar.today()).thenReturn(TODAY.plusDays(20));
        bonuses.settle(1001);
        assertEquals(10,balance());
        assertEquals("FINISHED",habit().status());
        assertFalse(habit().completionBonusGranted());
        assertNull(habit().completionBonusSettledOn());
    }
    @Test void legacyManualFlagDoesNotRevokeSettledBonusWhileStillEligible() {
        dated(true);
        jdbc.update("UPDATE habits SET required_success_percent=50 WHERE id=1001");
        jdbc.update("UPDATE habit_targets SET target_days=2 WHERE habit_id=1001");
        bonuses.settle(1001);
        jdbc.update("UPDATE habits SET ended_on=?,end_reason='STOPPED' WHERE id=1001",TODAY);
        service.setCompletion(1001,TODAY.minusDays(1),false); // Remaining day still meets ceil(2*2/7).
        assertEquals(30,balance());
        assertTrue(habit().completionBonusGranted());
    }
    @Test void weeklyTargetOutsideSettledPeriodCanChangeWithoutChangingResult() {
        dated(true);
        bonuses.settle(1001);
        when(calendar.today()).thenReturn(TODAY.plusWeeks(1));
        edit(TODAY.minusDays(2),TODAY.minusDays(1),null,20,100,2);
        assertFalse(habit().completionBonusTargetLocked());
        assertEquals(1,habit().regularity().successfulWeeks());
        assertEquals(30,balance());
    }
    @Test void legacyUnknownPaymentIsNotAssumedUnpaidAndApiSeparatesAmounts() {
        count(2,50,1);
        jdbc.update("INSERT INTO habit_completion_bonus_awards(habit_id,points,active) VALUES(1001,20,false)");
        assertNull(habit().completionBonusEverGranted());
        assertTrue(habit().completionBonusConditionsLocked());
        conflict(()->edit(START,null,2,null,null,7));
        conflict(()->service.setCompletion(1001,START.plusDays(1),true));
        assertEquals(10,balance());
        assertEquals(1,habit().totalCompletions());
        // Already active legacy inconsistencies remain explicit; migration never rewrites money.
        jdbc.update("UPDATE habit_completion_bonus_awards SET active=true,ever_granted=true WHERE habit_id=1001");
        jdbc.update("UPDATE users SET points=30 WHERE id=1");
        assertEquals(50,habit().completionBonusPoints());
        assertEquals(20,habit().completionBonusAwardPoints());
        assertLocked(true);
    }
    @Test void concurrentEditAndCompletionUseOneCommittedConfiguration() throws Exception {
        count(2,20,1);
        var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var edit=pool.submit(()->{start.await();try {edit(START,null,2,50,null,7);return true;}
                catch(ResponseStatusException e){assertEquals(409,e.getStatusCode().value());return false;}});
            var complete=pool.submit(()->{start.await();return service.setCompletion(1001,START.plusDays(1),true);});
            start.countDown();
            boolean edited=edit.get(15,TimeUnit.SECONDS);
            complete.get(15,TimeUnit.SECONDS);
            assertEquals(edited ? 60:30,balance());
            assertEquals(edited ? 50:20,habit().completionBonusAwardPoints());
            assertEquals(habit().completionBonusPoints(),habit().completionBonusAwardPoints());
            assertLocked(true);
        }
    }
    @Test void concurrentEditAndDateSettlementCannotChangeFinalConditions() throws Exception {
        dated(true);
        var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var edit=pool.submit(()->{start.await();try {edit(TODAY.minusDays(2),TODAY.minusDays(1),null,50,100,7);return true;}
                catch(ResponseStatusException e){assertEquals(409,e.getStatusCode().value());return false;}});
            var settle=pool.submit(()->{start.await();bonuses.settle(1001);return null;});
            start.countDown();
            boolean edited=edit.get(15,TimeUnit.SECONDS);
            settle.get(15,TimeUnit.SECONDS);
            assertEquals(edited ? 60:30,balance());
            assertEquals(habit().completionBonusPoints(),habit().completionBonusAwardPoints());
            assertLocked(true);
            assertNotNull(habit().completionBonusSettledOn());
        }
    }
}
