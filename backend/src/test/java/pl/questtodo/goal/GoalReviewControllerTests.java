package pl.questtodo.goal;

import java.time.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import pl.questtodo.user.CurrentUserProvider;
import static com.jayway.jsonpath.JsonPath.read;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:goal_reviews;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
class GoalReviewControllerTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired jakarta.persistence.EntityManagerFactory emf;
    @MockitoBean CurrentUserProvider currentUser;
    @MockitoBean Clock clock;

    void time(String instant) {
        Instant now = Instant.parse(instant);
        when(clock.instant()).thenReturn(now);
        when(clock.withZone(GoalReviewTimeConfiguration.ZONE)).thenReturn(Clock.fixed(now, GoalReviewTimeConfiguration.ZONE));
    }
    @BeforeEach void prepare() {
        jdbc.update("DELETE FROM goals");
        jdbc.update("DELETE FROM users WHERE id=2");
        jdbc.update("INSERT INTO users(id,name,points) VALUES(2,'Other',0)");
        jdbc.update("UPDATE users SET points=37 WHERE id=1");
        jdbc.update("INSERT INTO goals(id,user_id,title) VALUES(1001,1,'First'),(2001,2,'Other')");
        when(currentUser.getUserId()).thenReturn(1L);
        time("2026-11-17T12:00:00Z");
    }
    void configure(String frequency) throws Exception {
        mvc.perform(put("/api/goals/1001").contentType(MediaType.APPLICATION_JSON)
            .content("{\"title\":\"Goal\",\"reviewFrequency\":" + frequency + "}"))
            .andExpect(status().isOk());
    }
    void schedule(String date) {
        jdbc.update("UPDATE goals SET review_frequency='MONTHLY',next_review_date=? WHERE id=1001", LocalDate.parse(date));
    }
    void date(String expected) {
        // Inspect the stored DATE without java.sql.Date's JVM-zone conversion.
        assertEquals(expected,
            jdbc.queryForObject("SELECT CAST(next_review_date AS VARCHAR) FROM goals WHERE id=1001", String.class));
    }
    String entry(String type) throws Exception {
        return mvc.perform(post("/api/goals/1001/entries").contentType(MediaType.APPLICATION_JSON)
            .content("{\"type\":\"" + type + "\",\"content\":\"Reflection\"}"))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    }
    void completed(boolean completed) throws Exception {
        mvc.perform(patch("/api/goals/1001/completion").contentType(MediaType.APPLICATION_JSON)
            .content("{\"completed\":" + completed + "}")).andExpect(status().isOk());
    }
    @ParameterizedTest @CsvSource({"WEEKLY,2026-11-24", "BIWEEKLY,2026-12-01",
        "MONTHLY,2026-12-17", "QUARTERLY,2027-02-17"})
    void createsAndEnablesEveryFrequency(String frequency, String expected) throws Exception {
        configure("\"" + frequency + "\"");
        date(expected);
        mvc.perform(post("/api/goals").contentType(MediaType.APPLICATION_JSON)
            .content("{\"title\":\"New\",\"reviewFrequency\":\"" + frequency + "\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.nextReviewDate").value(expected))
            .andExpect(jsonPath("$.reviewFrequency").value(frequency)).andExpect(jsonPath("$.reviewDue").value(false));
    }
    @Test void defaultsDisabledAndIgnoresForgedComputedFields() throws Exception {
        mvc.perform(post("/api/goals").contentType(MediaType.APPLICATION_JSON)
            .content("{\"title\":\"New\",\"nextReviewDate\":\"2000-01-01\",\"reviewDue\":true}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.nextReviewDate").isEmpty())
            .andExpect(jsonPath("$.reviewFrequency").isEmpty()).andExpect(jsonPath("$.reviewDue").value(false));
        schedule("2026-12-01");
        mvc.perform(put("/api/goals/1001").contentType(MediaType.APPLICATION_JSON)
            .content("{\"title\":\"Renamed\",\"nextReviewDate\":\"2000-01-01\",\"reviewDue\":true}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.reviewDue").value(false));
        date("2026-12-01");
        configure("\"MONTHLY\""); date("2026-12-01");
        configure("\"WEEKLY\""); date("2026-11-24");
        configure("null"); date(null);
        configure("\"MONTHLY\""); date("2026-12-17");
    }
    @ParameterizedTest @ValueSource(strings = {"\"DAILY\"", "1", "{}"})
    void rejectsInvalidFrequency(String value) throws Exception {
        mvc.perform(put("/api/goals/1001").contentType(MediaType.APPLICATION_JSON)
            .content("{\"title\":\"Goal\",\"reviewFrequency\":" + value + "}"))
            .andExpect(status().isBadRequest());
        date(null);
    }
    @ParameterizedTest @EnumSource(GoalEntryType.class)
    void everyEntryTypeCompletesDueReviewOnlyOnce(GoalEntryType type) throws Exception {
        schedule("2026-11-17");
        assertEquals(Boolean.TRUE, read(entry(type.name()), "$.reviewCompleted")); date("2026-12-17");
        assertEquals(Boolean.FALSE, read(entry(type.name()), "$.reviewCompleted")); date("2026-12-17");
        assertEquals(37, jdbc.queryForObject("SELECT points FROM users WHERE id=1", Integer.class));
    }
    @ParameterizedTest @CsvSource({"2026-11-18,2026-11-18", "2026-11-17,2026-12-17",
        "2026-11-16,2026-12-17", "2026-01-01,2026-12-17"})
    void entryUsesCreationDateOnlyWhenDue(String due, String expected) throws Exception {
        schedule(due);
        assertEquals(!due.equals(expected), (Boolean) read(entry("NOTE"), "$.reviewCompleted"));
        date(expected);
    }
    @Test void warsawMidnightControlsDueAndEntryDate() throws Exception {
        schedule("2026-11-18");
        time("2026-11-17T22:59:59Z");
        mvc.perform(get("/api/goals/1001")).andExpect(jsonPath("$.reviewDue").value(false));
        time("2026-11-17T23:00:00Z");
        mvc.perform(get("/api/goals/1001")).andExpect(jsonPath("$.reviewDue").value(true));
        entry("NOTE"); date("2026-12-18");
    }
    @Test void editsAndDeletesDoNotChangeSchedule() throws Exception {
        schedule("2026-11-17");
        long id = ((Number) read(entry("NOTE"), "$.id")).longValue();
        time("2027-01-01T12:00:00Z");
        mvc.perform(patch("/api/goals/1001/entries/{id}", id).contentType(MediaType.APPLICATION_JSON)
            .content("{\"content\":\"Edited\",\"type\":\"SUCCESS\"}")).andExpect(status().isOk())
            .andExpect(jsonPath("$.reviewCompleted").doesNotExist());
        date("2026-12-17");
        mvc.perform(delete("/api/goals/1001/entries/{id}", id)).andExpect(status().isNoContent());
        date("2026-12-17");
    }
    @Test void completionPreservesConfigurationAndJournalAndResumeRestarts() throws Exception {
        schedule("2026-11-17"); entry("NOTE");
        completed(true); date(null);
        mvc.perform(get("/api/goals/1001")).andExpect(jsonPath("$.reviewDue").value(false))
            .andExpect(jsonPath("$.reviewFrequency").value("MONTHLY"));
        mvc.perform(put("/api/goals/1001").contentType(MediaType.APPLICATION_JSON)
            .content("{\"title\":\"Goal\",\"reviewFrequency\":null}")).andExpect(status().isConflict());
        time("2027-03-15T12:00:00Z"); completed(false); date("2027-04-15");
        completed(false); date("2027-04-15");
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM goal_entries WHERE goal_id=1001", Integer.class));
        configure("null"); completed(true); completed(false); date(null);
    }
    @Test void invalidUnauthorizedAndMissingGoalRequestsLeaveScheduleUnchanged() throws Exception {
        schedule("2026-11-17");
        mvc.perform(post("/api/goals/1001/entries").contentType(MediaType.APPLICATION_JSON)
            .content("{\"content\":\" \"}")).andExpect(status().isBadRequest());
        for (long goal : new long[]{2001, 9999}) {
            mvc.perform(post("/api/goals/{id}/entries", goal).contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Entry\"}")).andExpect(status().isNotFound());
            mvc.perform(put("/api/goals/{id}", goal).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Goal\",\"reviewFrequency\":\"WEEKLY\"}")).andExpect(status().isNotFound());
        }
        date("2026-11-17");
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM goal_entries", Integer.class));
    }
    @Test void concurrentEntriesSerializeAndPreserveBothEntries() throws Exception {
        schedule("2026-11-17");
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<String> action = () -> { start.await(); return entry("NOTE"); };
            var first = executor.submit(action); var second = executor.submit(action);
            start.countDown();
            String a = first.get(15, TimeUnit.SECONDS), b = second.get(15, TimeUnit.SECONDS);
            assertNotEquals((Number) read(a, "$.id"), (Number) read(b, "$.id"));
            assertNotEquals((Boolean) read(a, "$.reviewCompleted"), (Boolean) read(b, "$.reviewCompleted"),
                "Exactly one transaction must confirm completing the review");
        }
        date("2026-12-17");
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM goal_entries", Integer.class));
    }
    @Test void listingGoalsDoesNotLoadJournalOrIssueQueriesPerGoal() throws Exception {
        schedule("2026-11-17");
        jdbc.update("INSERT INTO goals(user_id,title,review_frequency,next_review_date) VALUES(1,'Another','WEEKLY',DATE '2026-11-16')");
        var statistics = emf.unwrap(org.hibernate.SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        statistics.clear();
        try {
            mvc.perform(get("/api/goals")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].reviewDue").value(true))
                .andExpect(jsonPath("$[1].reviewDue").value(true));
            assertEquals(1, statistics.getPrepareStatementCount());
        } finally { statistics.setStatisticsEnabled(false); }
    }
    @Test void failedScheduleUpdateRollsBackEntry() {
        schedule("2026-11-17");
        jdbc.execute("ALTER TABLE goals ADD CONSTRAINT test_reject_schedule CHECK (next_review_date <= DATE '2026-11-17')");
        try {
            assertThrows(Exception.class, () -> entry("NOTE"));
            date("2026-11-17");
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM goal_entries", Integer.class));
        } finally { jdbc.execute("ALTER TABLE goals DROP CONSTRAINT test_reject_schedule"); }
    }
    @Test void failedEntryInsertDoesNotCompleteReview() {
        schedule("2026-11-17");
        jdbc.execute("ALTER TABLE goal_entries ADD CONSTRAINT test_reject_entry CHECK (content <> 'Reflection')");
        try {
            assertThrows(Exception.class, () -> entry("NOTE"));
            date("2026-11-17");
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM goal_entries", Integer.class));
        } finally { jdbc.execute("ALTER TABLE goal_entries DROP CONSTRAINT test_reject_entry"); }
    }

    @ParameterizedTest
    @CsvSource({"UTC,2026-03-28T23:00:00Z,2026-03-29,2026-04-29",
        "Pacific/Honolulu,2026-10-24T22:00:00Z,2026-10-25,2026-11-25",
        "Pacific/Kiritimati,2026-12-31T23:00:00Z,2027-01-01,2027-02-01"})
    void businessDateIsIndependentOfServerZone(String zone, String instant, String due, String expected) throws Exception {
        // Keep the JVM/database zone stable for their entire lifecycle. Separate Maven forks
        // exercise server defaults with -Dtest.timezone; this checks clocks from other zones.
        Clock source = Clock.fixed(Instant.parse(instant), ZoneId.of(zone));
        when(clock.instant()).thenReturn(source.instant());
        when(clock.getZone()).thenReturn(source.getZone());
        when(clock.withZone(org.mockito.ArgumentMatchers.any(ZoneId.class)))
            .thenAnswer(invocation -> source.withZone(invocation.getArgument(0)));
        schedule(due);
        mvc.perform(get("/api/goals/1001")).andExpect(jsonPath("$.reviewDue").value(true));
        assertEquals(Boolean.TRUE, read(entry("INSIGHT"), "$.reviewCompleted"));
        date(expected);
        mvc.perform(get("/api/goals/1001")).andExpect(jsonPath("$.nextReviewDate").value(expected));
    }

    @Test void anotherOwnersScheduleCannotBeReadDisabledCompletedOrResumed() throws Exception {
        jdbc.update("UPDATE goals SET review_frequency='MONTHLY',next_review_date=DATE '2026-01-01' WHERE id=2001");
        mvc.perform(get("/api/goals/2001")).andExpect(status().isNotFound());
        mvc.perform(put("/api/goals/2001").contentType(MediaType.APPLICATION_JSON)
            .content("{\"title\":\"Foreign\",\"reviewFrequency\":null}")).andExpect(status().isNotFound());
        for (boolean completed : new boolean[]{true, false}) {
            mvc.perform(patch("/api/goals/2001/completion").contentType(MediaType.APPLICATION_JSON)
                .content("{\"completed\":" + completed + "}")).andExpect(status().isNotFound());
        }
        mvc.perform(post("/api/goals/2001/entries").contentType(MediaType.APPLICATION_JSON)
            .content("{\"content\":\"Foreign review\"}")).andExpect(status().isNotFound());
        assertEquals(LocalDate.of(2026, 1, 1), jdbc.queryForObject(
            "SELECT next_review_date FROM goals WHERE id=2001", LocalDate.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM goal_entries", Integer.class));
    }

    @Test void fullLifecycleUsesRealApiAndDatabaseWithControlledTime() throws Exception {
        time("2025-12-01T12:00:00Z");
        String created = mvc.perform(post("/api/goals").contentType(MediaType.APPLICATION_JSON)
            .content("{\"title\":\"Lifecycle\",\"reviewFrequency\":\"MONTHLY\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.nextReviewDate").value("2026-01-01"))
            .andExpect(jsonPath("$.reviewDue").value(false)).andReturn().getResponse().getContentAsString();
        long id = ((Number) read(created, "$.id")).longValue();
        time("2026-04-15T12:00:00Z");
        mvc.perform(get("/api/goals/{id}", id)).andExpect(jsonPath("$.reviewDue").value(true));
        for (boolean expected : new boolean[]{true, false}) {
            mvc.perform(post("/api/goals/{id}/entries", id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Reflection\"}")).andExpect(status().isCreated())
                .andExpect(jsonPath("$.reviewCompleted").value(expected));
            mvc.perform(get("/api/goals/{id}", id)).andExpect(jsonPath("$.nextReviewDate").value("2026-05-15"))
                .andExpect(jsonPath("$.reviewDue").value(false));
        }
        for (String frequency : new String[]{"WEEKLY", "QUARTERLY"}) {
            mvc.perform(put("/api/goals/{id}", id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Lifecycle\",\"reviewFrequency\":\"" + frequency + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.nextReviewDate").value(
                    frequency.equals("WEEKLY") ? "2026-04-22" : "2026-07-15"));
        }
        mvc.perform(patch("/api/goals/{id}/completion", id).contentType(MediaType.APPLICATION_JSON)
            .content("{\"completed\":true}")).andExpect(status().isOk())
            .andExpect(jsonPath("$.nextReviewDate").isEmpty()).andExpect(jsonPath("$.reviewDue").value(false));
        time("2027-03-17T12:00:00Z");
        mvc.perform(post("/api/goals/{id}/entries", id).contentType(MediaType.APPLICATION_JSON)
            .content("{\"content\":\"Read only\"}")).andExpect(status().isConflict());
        mvc.perform(patch("/api/goals/{id}/completion", id).contentType(MediaType.APPLICATION_JSON)
            .content("{\"completed\":false}")).andExpect(status().isOk())
            .andExpect(jsonPath("$.nextReviewDate").value("2027-06-17"));
        mvc.perform(get("/api/goals/{id}/entries", id)).andExpect(jsonPath("$.totalElements").value(2))
            .andExpect(jsonPath("$.entries[0].reviewCompleted").doesNotExist());
        assertEquals(37, jdbc.queryForObject("SELECT points FROM users WHERE id=1", Integer.class));
    }
}
