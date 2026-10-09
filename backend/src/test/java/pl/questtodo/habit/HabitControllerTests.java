package pl.questtodo.habit;

import java.time.LocalDate;
import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import pl.questtodo.user.CurrentUserProvider;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:habits;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
@Transactional
class HabitControllerTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager entityManager;
    @Autowired HabitService service;
    @MockitoBean CurrentUserProvider currentUser;
    @MockitoBean HabitCalendar calendar;
    static final LocalDate TODAY = LocalDate.of(2026, 10, 9);

    @BeforeEach
    void prepare() {
        when(calendar.today()).thenReturn(TODAY);
        when(calendar.now()).thenReturn(java.time.Instant.parse("2026-10-09T12:00:00Z"));
        jdbc.update("DELETE FROM habits");
        jdbc.update("DELETE FROM users WHERE id = 2");
        jdbc.update("INSERT INTO users(id, name, points) VALUES (2, 'Second user', 0)");
    }

    @Test
    void createsReadsUpdatesAndDeletesHabit() throws Exception {
        when(currentUser.getUserId()).thenReturn(1L);
        mvc.perform(post("/api/habits").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  Poranny spacer  \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.createdOn").value("2026-10-09"))
                .andExpect(jsonPath("$.completed").value(false))
                .andExpect(jsonPath("$.name").value("Poranny spacer"));
        long id = jdbc.queryForObject("SELECT id FROM habits WHERE user_id = 1", Long.class);
        mvc.perform(get("/api/habits"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(id))
                .andExpect(jsonPath("$[0].name").value("Poranny spacer"));
        mvc.perform(put("/api/habits/{id}", id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  Czytanie  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Czytanie"));
        mvc.perform(delete("/api/habits/{id}", id)).andExpect(status().isNoContent());
        mvc.perform(get("/api/habits")).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void validatesAndPersistsRewardConfiguration() throws Exception {
        when(currentUser.getUserId()).thenReturn(1L);
        mvc.perform(post("/api/habits").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Points\",\"targetDays\":2,\"rewardPoints\":-1}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/habits").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Points\",\"targetDays\":2,\"rewardPoints\":100}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.rewardPoints").value(100));
        long id = jdbc.queryForObject("SELECT id FROM habits WHERE user_id = 1", Long.class);
        mvc.perform(put("/api/habits/{id}", id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Updated\",\"targetDays\":2,\"rewardPoints\":200}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.rewardPoints").value(200));
        mvc.perform(put("/api/habits/{id}", id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Renamed\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.rewardPoints").value(200));
    }

    @Test
    void countsTheWholeDisplayedWeekSeparatelyFromSelectedDayAndOtherUsers() throws Exception {
        seedDatedHabits();
        jdbc.update("INSERT INTO habit_targets(habit_id, target_days, effective_from) VALUES (1001, 2, '2026-09-28'), (1001, 7, '2026-10-05')");
        jdbc.update("INSERT INTO habit_completions(habit_id, completion_date) VALUES "
                + "(1001, '2026-09-28'), (1001, '2026-10-04'), (1001, '2026-10-05'), (1001, '2026-10-09'), (2001, '2026-10-05')");
        mvc.perform(get("/api/habits?date=2026-10-06"))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].completed").value(false))
                .andExpect(jsonPath("$[0].weeklyCompletedDays").value(2))
                .andExpect(jsonPath("$[0].target.targetDays").value(7))
                .andExpect(jsonPath("$[1].weeklyCompletedDays").value(0));
        mvc.perform(get("/api/habits?date=2026-10-09"))
                .andExpect(jsonPath("$[0].completed").value(true))
                .andExpect(jsonPath("$[0].weeklyCompletedDays").value(2));
        mvc.perform(get("/api/habits?date=2026-10-04"))
                .andExpect(jsonPath("$[0].weeklyCompletedDays").value(2))
                .andExpect(jsonPath("$[0].target.targetDays").value(2));
        mvc.perform(get("/api/habits?date=2026-09-27"))
                .andExpect(jsonPath("$[0].weeklyCompletedDays").value(0))
                .andExpect(jsonPath("$[0].target").doesNotExist());
    }

    @Test
    void weeklyProgressCanExceedTargetAndDecreaseWithoutChangingPoints() throws Exception {
        seedDatedHabits();
        jdbc.update("INSERT INTO habit_targets(habit_id, target_days, effective_from) VALUES (1001, 2, '2026-10-05')");
        int points = jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Integer.class);
        for (int day = 5; day <= 8; day++) {
            for (int attempt = 0; attempt < 2; attempt++) {
                mvc.perform(put("/api/habits/1001/completions/2026-10-0" + day)).andExpect(status().isOk());
            }
        }
        mvc.perform(get("/api/habits?date=2026-10-09"))
                .andExpect(jsonPath("$[0].completed").value(false))
                .andExpect(jsonPath("$[0].weeklyCompletedDays").value(4));
        for (int day = 5; day <= 7; day++) {
            mvc.perform(delete("/api/habits/1001/completions/2026-10-0" + day)).andExpect(status().isOk());
        }
        mvc.perform(get("/api/habits?date=2026-10-08"))
                .andExpect(jsonPath("$[0].completed").value(true))
                .andExpect(jsonPath("$[0].weeklyCompletedDays").value(1));
        assertEquals(points, jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Integer.class));
    }

    @Test
    void validatesNameWithoutSaving() throws Exception {
        when(currentUser.getUserId()).thenReturn(1L);
        for (String name : new String[]{"", "   ", "x".repeat(121)}) {
            mvc.perform(post("/api/habits").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"" + name + "\"}"))
                    .andExpect(status().isBadRequest());
        }
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM habits", Integer.class));
    }

    @Test
    void isolatesHabitsBetweenUsers() throws Exception {
        jdbc.update("INSERT INTO habits(id, user_id, name, created_on) VALUES (1001, 1, 'Owner habit', '2026-10-08'), (2001, 2, 'Other habit', '2026-10-08')");
        when(currentUser.getUserId()).thenReturn(1L);
        mvc.perform(get("/api/habits"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(1001));
        mvc.perform(put("/api/habits/2001").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Changed\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/habits/2001")).andExpect(status().isNotFound());
        assertEquals("Other habit", jdbc.queryForObject("SELECT name FROM habits WHERE id = 2001", String.class));
    }

    void seedDatedHabits() {
        when(currentUser.getUserId()).thenReturn(1L);
        jdbc.update("INSERT INTO habits(id, user_id, name, created_on) VALUES (1001, 1, 'Older', '2026-10-08'), (1002, 1, 'New', '2026-10-09'), (2001, 2, 'Other', '2026-10-08')");
    }

    @Test
    void createsDailyDefaultAndAllWeeklyTargets() throws Exception {
        when(currentUser.getUserId()).thenReturn(1L);
        mvc.perform(post("/api/habits").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Daily\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.target.targetDays").value(7))
                .andExpect(jsonPath("$.target.effectiveFrom").value("2026-10-05"));
        for (int days = 1; days <= 7; days++) {
            mvc.perform(post("/api/habits").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"Target\",\"targetDays\":" + days + "}"))
                    .andExpect(status().isCreated()).andExpect(jsonPath("$.target.targetDays").value(days));
        }
        mvc.perform(get("/api/habits").param("date", TODAY.minusWeeks(3).toString()))
                .andExpect(jsonPath("$.length()").value(8))
                .andExpect(jsonPath("$[0].target").isEmpty())
                .andExpect(jsonPath("$[0].latestTarget.targetDays").value(7));
    }

    @Test
    void rejectsInvalidTargetsAndRollsBackNameChanges() throws Exception {
        seedDatedHabits();
        for (int days : new int[]{-1, 0, 8, 100}) {
            String body = "{\"name\":\"Changed\",\"targetDays\":" + days + "}";
            mvc.perform(post("/api/habits").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
            mvc.perform(put("/api/habits/1001").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        assertEquals("Older", jdbc.queryForObject("SELECT name FROM habits WHERE id = 1001", String.class));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM habit_targets", Integer.class));
    }

    @Test
    void changesTargetFromCurrentMondayAndPreservesEarlierWeeks() throws Exception {
        seedDatedHabits();
        jdbc.update("INSERT INTO habit_targets(habit_id, target_days, effective_from) VALUES (1001, 7, '2026-09-28')");
        mvc.perform(put("/api/habits/1001").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Older\",\"targetDays\":3}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.target.targetDays").value(3))
                .andExpect(jsonPath("$.latestTarget.targetDays").value(3))
                .andExpect(jsonPath("$.latestTarget.effectiveFrom").value("2026-10-05"));
        // Repeated edits replace the current week target.
        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(put("/api/habits/1001").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"Renamed\",\"targetDays\":4}"))
                    .andExpect(status().isOk());
        }
        entityManager.flush();
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM habit_targets WHERE habit_id = 1001", Integer.class));
        // Older clients may rename without changing the configured target.
        mvc.perform(put("/api/habits/1001").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Renamed\"}"))
                .andExpect(jsonPath("$.latestTarget.targetDays").value(4));
        when(calendar.today()).thenReturn(LocalDate.of(2026, 10, 12));
        mvc.perform(get("/api/habits")).andExpect(jsonPath("$[0].target.targetDays").value(4));
        mvc.perform(get("/api/habits?date=2026-10-09")).andExpect(jsonPath("$[0].target.targetDays").value(4));
        mvc.perform(get("/api/habits?date=2026-09-28")).andExpect(jsonPath("$[0].target.targetDays").value(7));
        // Viewing a past date does not change the effective week of an edit.
        mvc.perform(put("/api/habits/1001").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Renamed\",\"targetDays\":2}"))
                .andExpect(jsonPath("$.latestTarget.effectiveFrom").value("2026-10-12"));
        mvc.perform(get("/api/habits?date=2026-10-09")).andExpect(jsonPath("$[0].target.targetDays").value(4));
    }

    @Test
    void sundayEditStartsOnMondayAcrossYearBoundary() throws Exception {
        when(currentUser.getUserId()).thenReturn(1L);
        when(calendar.today()).thenReturn(LocalDate.of(2027, 1, 3));
        mvc.perform(post("/api/habits").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Boundary\",\"targetDays\":2}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.target.effectiveFrom").value("2026-12-28"));
    }

    @Test
    void canCancelPendingTargetWithoutDeletingActiveHistory() throws Exception {
        seedDatedHabits();
        jdbc.update("INSERT INTO habit_targets(habit_id, target_days, effective_from) VALUES (1001, 7, '2026-10-05'), (1001, 3, '2026-10-12')");
        mvc.perform(put("/api/habits/1001").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Older\",\"targetDays\":7}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.latestTarget.effectiveFrom").value("2026-10-05"));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM habit_targets WHERE habit_id = 1001", Integer.class));
    }

    @Test
    void targetsArePrivateAndDoNotLimitCompletionsOrAwardPoints() throws Exception {
        seedDatedHabits();
        jdbc.update("INSERT INTO habit_targets(habit_id, target_days, effective_from) VALUES (1001, 1, '2026-10-05'), (2001, 6, '2026-10-05')");
        int pointsBefore = jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Integer.class);
        mvc.perform(put("/api/habits/2001").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Other\",\"targetDays\":2}"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/habits")).andExpect(jsonPath("$[0].target.targetDays").value(1));
        mvc.perform(put("/api/habits/1001/completions/2026-10-08")).andExpect(status().isOk());
        mvc.perform(put("/api/habits/1001/completions/2026-10-09")).andExpect(status().isOk());
        entityManager.flush();
        assertEquals(pointsBefore, jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Integer.class));
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM habit_completions WHERE habit_id = 1001", Integer.class));
        mvc.perform(delete("/api/habits/1001")).andExpect(status().isNoContent());
        entityManager.flush();
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM habit_targets WHERE habit_id = 1001", Integer.class));
        assertEquals(6, jdbc.queryForObject("SELECT target_days FROM habit_targets WHERE habit_id = 2001", Integer.class));
    }

    @Test
    void showsAllOwnHabitsRegardlessOfCreationDateAndKeepsDailyCompletionsIndependent() throws Exception {
        seedDatedHabits();
        mvc.perform(get("/api/habits?date=2026-10-07")).andExpect(jsonPath("$.length()").value(2));
        mvc.perform(get("/api/habits?date=2026-10-08"))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].completed").value(false));
        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(put("/api/habits/1001/completions/2026-10-08")).andExpect(status().isOk());
        }
        entityManager.flush();
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM habit_completions", Integer.class));
        mvc.perform(get("/api/habits?date=2026-10-08")).andExpect(jsonPath("$[0].completed").value(true));
        mvc.perform(get("/api/habits?date=2026-10-09"))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].completed").value(false));
        mvc.perform(put("/api/habits/1001/completions/2026-10-09")).andExpect(status().isOk());
        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(delete("/api/habits/1001/completions/2026-10-08")).andExpect(status().isOk());
        }
        mvc.perform(get("/api/habits?date=2026-10-08")).andExpect(jsonPath("$[0].completed").value(false));
        mvc.perform(get("/api/habits")).andExpect(jsonPath("$[0].completed").value(true));
    }

    @Test
    void rejectsFutureAndInvalidDates() throws Exception {
        seedDatedHabits();
        for (String date : new String[]{"2026-10-10", "not-a-date", "2026-02-30"}) {
            mvc.perform(put("/api/habits/1001/completions/" + date)).andExpect(status().isBadRequest());
            mvc.perform(delete("/api/habits/1001/completions/" + date)).andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/habits?date=2026-10-10")).andExpect(status().isBadRequest());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM habit_completions", Integer.class));
    }

    @Test
    void newlyCreatedHabitCanBeCompletedAndUncompletedWeeksBeforeCreation() throws Exception {
        when(currentUser.getUserId()).thenReturn(1L);
        mvc.perform(post("/api/habits").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Reading\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.createdOn").value("2026-10-09"));
        long id = jdbc.queryForObject("SELECT id FROM habits WHERE user_id = 1", Long.class);
        String pastDate = TODAY.minusWeeks(3).toString();
        mvc.perform(get("/api/habits").param("date", pastDate))
                .andExpect(jsonPath("$[0].id").value(id)).andExpect(jsonPath("$[0].completed").value(false));
        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(put("/api/habits/{id}/completions/{date}", id, pastDate)).andExpect(status().isOk());
        }
        mvc.perform(get("/api/habits").param("date", pastDate)).andExpect(jsonPath("$[0].completed").value(true));
        mvc.perform(get("/api/habits")).andExpect(jsonPath("$[0].completed").value(false));
        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(delete("/api/habits/{id}/completions/{date}", id, pastDate)).andExpect(status().isOk());
        }
        mvc.perform(get("/api/habits").param("date", pastDate)).andExpect(jsonPath("$[0].completed").value(false));
        entityManager.flush();
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM habit_completions", Integer.class));
    }

    @Test
    void cannotReadOrModifyAnotherUsersCompletions() throws Exception {
        seedDatedHabits();
        when(currentUser.getUserId()).thenReturn(2L);
        mvc.perform(put("/api/habits/2001/completions/2026-10-09")).andExpect(status().isOk());
        when(currentUser.getUserId()).thenReturn(1L);
        mvc.perform(put("/api/habits/2001/completions/2026-10-09")).andExpect(status().isNotFound());
        mvc.perform(delete("/api/habits/2001/completions/2026-10-09")).andExpect(status().isNotFound());
        mvc.perform(get("/api/habits?date=2026-10-09"))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].completed").value(false))
                .andExpect(jsonPath("$[1].completed").value(false));
        when(currentUser.getUserId()).thenReturn(2L);
        mvc.perform(get("/api/habits")).andExpect(jsonPath("$[0].completed").value(true));
    }

    @Test
    void renamingPreservesCompletionsAndDeletingHabitRemovesThem() throws Exception {
        seedDatedHabits();
        mvc.perform(put("/api/habits/1001/completions/2026-10-09")).andExpect(status().isOk());
        mvc.perform(put("/api/habits/1001").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Renamed\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.createdOn").value("2026-10-08"));
        mvc.perform(get("/api/habits")).andExpect(jsonPath("$[0].completed").value(true));
        mvc.perform(delete("/api/habits/1001")).andExpect(status().isNoContent());
        entityManager.flush();
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM habit_completions", Integer.class));
    }

    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void simultaneousRequestsCreateOnlyOneCompletion() throws Exception {
        seedDatedHabits();
        var ready = new java.util.concurrent.CountDownLatch(2);
        var start = new java.util.concurrent.CountDownLatch(1);
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<Void> mark = () -> {
                ready.countDown();
                if (!start.await(10, java.util.concurrent.TimeUnit.SECONDS)) throw new IllegalStateException("Start timeout");
                service.setCompletion(1001, TODAY, true);
                return null;
            };
            var first = executor.submit(mark);
            var second = executor.submit(mark);
            org.junit.jupiter.api.Assertions.assertTrue(ready.await(10, java.util.concurrent.TimeUnit.SECONDS));
            start.countDown();
            first.get(10, java.util.concurrent.TimeUnit.SECONDS);
            second.get(10, java.util.concurrent.TimeUnit.SECONDS);
        }
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM habit_completions WHERE habit_id = 1001", Integer.class));
    }
}
