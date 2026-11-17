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
        assertEquals(expected == null ? null : LocalDate.parse(expected),
            jdbc.queryForObject("SELECT next_review_date FROM goals WHERE id=1001", LocalDate.class));
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
        entry(type.name()); date("2026-12-17");
        entry(type.name()); date("2026-12-17");
        assertEquals(37, jdbc.queryForObject("SELECT points FROM users WHERE id=1", Integer.class));
    }
    @ParameterizedTest @CsvSource({"2026-11-18,2026-11-18", "2026-11-17,2026-12-17",
        "2026-11-16,2026-12-17", "2026-01-01,2026-12-17"})
    void entryUsesCreationDateOnlyWhenDue(String due, String expected) throws Exception {
        schedule(due); entry("NOTE"); date(expected);
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
            .content("{\"content\":\"Edited\"}")).andExpect(status().isOk());
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
            start.countDown(); first.get(15, TimeUnit.SECONDS); second.get(15, TimeUnit.SECONDS);
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
}
