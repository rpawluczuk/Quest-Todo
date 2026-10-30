package pl.questtodo.habit;

import java.time.Instant;
import java.time.LocalDate;
import java.util.concurrent.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.user.CurrentUserProvider;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:habit_status;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
    "app.habits.waiting-room-enabled=true"
})
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
class HabitStatusTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired HabitService habits;
    @Autowired HabitStatusService statuses;
    @MockitoSpyBean HabitStatusPeriodRepository periods;
    @MockitoBean CurrentUserProvider currentUser;
    @MockitoBean HabitCalendar calendar;
    static final Instant NOW = Instant.parse("2026-10-30T12:00:00Z");
    static final LocalDate TODAY = LocalDate.of(2026, 10, 30);

    @BeforeEach void prepare() {
        when(currentUser.getUserId()).thenReturn(1L);
        when(calendar.today()).thenReturn(TODAY);
        when(calendar.now()).thenReturn(NOW);
        jdbc.update("DELETE FROM habits");
        jdbc.update("DELETE FROM goals");
        jdbc.update("UPDATE users SET points = 0 WHERE id = 1");
    }
    private long create(HabitStatus status) throws Exception {
        mvc.perform(post("/api/habits").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Habit\",\"targetDays\":1,\"rewardPoints\":3"
                        + (status == null ? "" : ",\"activityStatus\":\"" + status + "\"") + "}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.activityStatus").value(status == null ? "ACTIVE" : status.name()));
        return jdbc.queryForObject("SELECT MAX(id) FROM habits", Long.class);
    }
    private void change(long id, String status) throws Exception {
        mvc.perform(patch("/api/habits/{id}/status", id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"" + status + "\",\"startedAt\":\"2000-01-01T00:00:00Z\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.activityStatus").value(status));
    }
    private int periodCount(long id) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM habit_status_periods WHERE habit_id=?", Integer.class, id);
    }
    @Test void defaultActiveAndPlannedHavePersistedInitialHistoryAndStableLegacyStatus() throws Exception {
        long active = create(null);
        mvc.perform(get("/api/habits/{id}/status-history", active)).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$[0].startedAt").value(NOW.toString()))
                .andExpect(jsonPath("$[0].endedAt").value(org.hamcrest.Matchers.nullValue()));
        long planned = create(HabitStatus.PLANNED);
        mvc.perform(get("/api/habits")).andExpect(status().isOk())
                .andExpect(jsonPath("$[1].activityStatus").value("PLANNED"))
                .andExpect(jsonPath("$[0].status").value("ACTIVE"));
        assertEquals(HabitStatus.PLANNED, statuses.history(planned).getFirst().status());
    }
    @Test void cyclesAreContiguousChronologicalAndIdempotent() throws Exception {
        long id = create(HabitStatus.PLANNED);
        String[] sequence = {"ACTIVE", "PAUSED", "ACTIVE", "PAUSED", "ACTIVE"};
        for (int i = 0; i < sequence.length; i++) {
            when(calendar.now()).thenReturn(NOW.plusSeconds(i + 1));
            change(id, sequence[i]);
            change(id, sequence[i]);
            assertEquals(i + 2, periodCount(id));
        }
        var history = statuses.history(id);
        assertEquals(6, history.size());
        for (int i = 0; i < history.size() - 1; i++) {
            assertEquals(history.get(i + 1).startedAt(), history.get(i).endedAt());
            assertTrue(history.get(i).endedAt().isAfter(history.get(i).startedAt()));
        }
        assertNull(history.getLast().endedAt());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM habit_status_periods WHERE habit_id=? AND ended_at IS NULL", Integer.class, id));
        mvc.perform(get("/api/habits/{id}/status-history", id)).andExpect(jsonPath("$.length()").value(6));
    }
    @ParameterizedTest @CsvSource({"ACTIVE,PLANNED", "PLANNED,PAUSED", "PAUSED,PLANNED"})
    void rejectsIllegalTransitionsWithoutTouchingHistory(String from, String to) throws Exception {
        long id = create(from.equals("PLANNED") ? HabitStatus.PLANNED : null);
        if (from.equals("PAUSED")) change(id, "PAUSED");
        var before = statuses.history(id);
        mvc.perform(patch("/api/habits/{id}/status", id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"" + to + "\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.detail").isNotEmpty());
        assertEquals(before, statuses.history(id));
    }
    @Test void validatesInputAndOrdinaryEditsCannotChangeStatus() throws Exception {
        long id = create(HabitStatus.PLANNED);
        for (String body : new String[]{"{}", "{\"status\":null}", "{\"status\":\"UNKNOWN\"}"})
            mvc.perform(patch("/api/habits/{id}/status", id).contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        mvc.perform(post("/api/habits").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Bad\",\"activityStatus\":\"PAUSED\"}")).andExpect(status().isBadRequest());
        for (String path : new String[]{"/api/habits/" + id, "/api/habits/" + id + "/configuration"})
            mvc.perform(put(path).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Changed\",\"activityStatus\":\"ACTIVE\"}"))
                    .andExpect(status().isBadRequest());
        mvc.perform(put("/api/habits/{id}", id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Renamed\",\"description\":\"Notes\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.activityStatus").value("PLANNED"));
        assertEquals(1, periodCount(id));
    }
    @Test void pausesPreserveCompletionsAwardsGoalsBonusTargetsAndBalance() throws Exception {
        long id = create(null);
        jdbc.update("INSERT INTO goals(id,user_id,title) VALUES(9001,1,'Goal')");
        jdbc.update("INSERT INTO goal_habits(goal_id,habit_id) VALUES(9001,?)", id);
        jdbc.update("UPDATE habits SET start_date=?, completion_limit=2, completion_bonus_points=10 WHERE id=?", TODAY.minusDays(1), id);
        habits.setCompletion(id, TODAY.minusDays(1), true);
        habits.setCompletion(id, TODAY, true);
        long balance = jdbc.queryForObject("SELECT points FROM users WHERE id=1", Long.class);
        assertEquals(13, balance);
        var targets = jdbc.queryForList("SELECT * FROM habit_targets WHERE habit_id=?", id);
        var bonus = jdbc.queryForList("SELECT * FROM habit_completion_bonus_awards WHERE habit_id=?", id);
        change(id, "PAUSED"); change(id, "ACTIVE");
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM habit_completions WHERE habit_id=?", Integer.class, id));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM habit_weekly_awards WHERE habit_id=?", Integer.class, id));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM goal_habits WHERE habit_id=?", Integer.class, id));
        assertEquals(targets, jdbc.queryForList("SELECT * FROM habit_targets WHERE habit_id=?", id));
        assertEquals(bonus, jdbc.queryForList("SELECT * FROM habit_completion_bonus_awards WHERE habit_id=?", id));
        assertEquals(balance, jdbc.queryForObject("SELECT points FROM users WHERE id=1", Long.class));
    }
    @Test void nonActiveHabitsRejectNewCompletionsButKeepExistingRecords() throws Exception {
        long id = create(HabitStatus.PLANNED);
        mvc.perform(put("/api/habits/{id}/completions/{date}", id, TODAY)).andExpect(status().isConflict());
        change(id, "ACTIVE");
        habits.setCompletion(id, TODAY, true);
        change(id, "PAUSED");
        mvc.perform(put("/api/habits/{id}/completions/{date}", id, TODAY.minusDays(1))).andExpect(status().isConflict());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM habit_completions WHERE habit_id=?", Integer.class, id));
    }
    @Test void ownershipIsCheckedForChangesAndHistory() throws Exception {
        long id = create(null);
        when(currentUser.getUserId()).thenReturn(98765L);
        for (long requested : new long[]{id, 999999}) {
            mvc.perform(get("/api/habits/{id}/status-history", requested)).andExpect(status().isNotFound());
            mvc.perform(patch("/api/habits/{id}/status", requested).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"status\":\"PAUSED\"}")).andExpect(status().isNotFound());
        }
        assertEquals(1, periodCount(id));
    }
    @Test void failedHistoryInsertRollsBackClosedPeriodAndHabitStatus() throws Exception {
        long id = create(null);
        doThrow(new IllegalStateException("Simulated write failure")).when(periods)
                .save(argThat(period -> period != null && period.getStatus() == HabitStatus.PAUSED));
        assertThrows(IllegalStateException.class, () -> habits.changeStatus(id, HabitStatus.PAUSED));
        assertEquals("ACTIVE", jdbc.queryForObject("SELECT activity_status FROM habits WHERE id=?", String.class, id));
        assertEquals(1, periodCount(id));
        assertNull(statuses.history(id).getFirst().endedAt());
    }
    @Test void concurrentPauseRequestsCreateOnlyOnePeriod() throws Exception {
        long id = create(null);
        var ready = new CountDownLatch(2); var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Callable<Void> request = () -> {
                ready.countDown(); assertTrue(start.await(10, TimeUnit.SECONDS));
                habits.changeStatus(id, HabitStatus.PAUSED); return null;
            };
            var first = pool.submit(request); var second = pool.submit(request);
            assertTrue(ready.await(10, TimeUnit.SECONDS)); start.countDown();
            first.get(15, TimeUnit.SECONDS); second.get(15, TimeUnit.SECONDS);
        }
        assertEquals(2, periodCount(id));
        assertEquals(HabitStatus.PAUSED, statuses.history(id).getLast().status());
        assertNull(statuses.history(id).getLast().endedAt());
    }
    @Test void sameInstantAndClockRegressionCannotProduceOverlappingPeriods() throws Exception {
        long id = create(null);
        change(id, "PAUSED");
        when(calendar.now()).thenReturn(NOW.minusSeconds(30));
        change(id, "ACTIVE");
        var history = statuses.history(id);
        assertEquals(NOW, history.get(0).endedAt());
        assertEquals(NOW, history.get(1).startedAt());
        assertEquals(NOW, history.get(1).endedAt());
        assertEquals(NOW, history.get(2).startedAt());
    }
    @Test void deletingHabitCascadesToStatusHistory() throws Exception {
        long id = create(null); change(id, "PAUSED");
        mvc.perform(delete("/api/habits/{id}", id)).andExpect(status().isNoContent());
        assertEquals(0, periodCount(id));
    }
}
