package pl.questtodo.habit;
import pl.questtodo.goal.GoalEntryType;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import pl.questtodo.user.CurrentUserProvider;
import tools.jackson.databind.ObjectMapper;
import static com.jayway.jsonpath.JsonPath.read;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:habit_entries;MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "app.habits.waiting-room-enabled=true"})
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
class HabitEntryControllerTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired jakarta.persistence.EntityManagerFactory emf;
    @MockitoBean CurrentUserProvider currentUser;
    private final ObjectMapper json = new ObjectMapper();

    @BeforeEach void prepare() {
        jdbc.update("DELETE FROM goals");
        jdbc.update("DELETE FROM habits");
        jdbc.update("DELETE FROM users WHERE id=2");
        jdbc.update("INSERT INTO users(id,name,points) VALUES(2,'Other',0)");
        jdbc.update("UPDATE users SET points=37 WHERE id=1");
        jdbc.update("INSERT INTO habits(id,user_id,name) VALUES(1001,1,'First'),(1002,1,'Second'),(2001,2,'Other')");
        when(currentUser.getUserId()).thenReturn(1L);
    }

    private String create(long habit, String body) throws Exception {
        return mvc.perform(post("/api/habits/{habit}/entries", habit).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    }
    private long create(long habit) throws Exception { return id(create(habit, "{\"content\":\"Entry\"}")); }
    private long id(String body) { return ((Number) read(body, "$.id")).longValue(); }
    private String update(long habit, long id, String body) throws Exception {
        return mvc.perform(patch("/api/habits/{habit}/entries/{id}", habit, id)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }
    @ParameterizedTest @EnumSource(GoalEntryType.class)
    void createsEveryTypeWithNormalizedMultilineContentAndPersistedUtcDates(GoalEntryType type) throws Exception {
        Instant before = Instant.now().minusSeconds(1);
        String body = create(1001, json.writeValueAsString(Map.of("type", type.name(), "content", " \nFirst\nSecond\t ")));
        long id = id(body);
        assertEquals(type.name(), read(body, "$.type"));
        assertEquals("First\nSecond", read(body, "$.content"));
        String created = read(body, "$.createdAt");
        assertEquals(created, read(body, "$.updatedAt"));
        assertFalse(Instant.parse(created).isBefore(before));
        assertFalse(Instant.parse(created).isAfter(Instant.now()));
        assertEquals(type.name(), jdbc.queryForObject("SELECT type FROM habit_entries WHERE id=?", String.class, id));
        mvc.perform(get("/api/habits/1001/entries")).andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[0].id").value(id))
                .andExpect(jsonPath("$.entries[0].createdAt").value(created))
                .andExpect(jsonPath("$.entries[0].habit").doesNotExist())
                .andExpect(jsonPath("$.hasMore").value(false));
        assertEquals(37, jdbc.queryForObject("SELECT points FROM users WHERE id=1", Integer.class));
        assertNull(jdbc.queryForObject("SELECT ended_on FROM habits WHERE id=1001", java.sql.Date.class));
    }

    @Test void defaultsToNoteAndDoesNotAllowClientToWriteOwnershipHabitOrDates() throws Exception {
        String forged = "{\"content\":\"Entry\",\"habitId\":2001,\"userId\":2,\"id\":999,"
                + "\"createdAt\":\"2000-01-01T00:00:00Z\",\"updatedAt\":\"2000-01-01T00:00:00Z\"}";
        String body = create(1001, forged);
        assertEquals("NOTE", read(body, "$.type"));
        long id = id(body);
        assertNotEquals(999L, id);
        assertEquals(1001L, jdbc.queryForObject("SELECT habit_id FROM habit_entries WHERE id=?", Long.class, id));
        assertNotEquals("2000-01-01T00:00:00Z", read(body, "$.createdAt"));
        String result = update(1001, id, forged);
        assertEquals((String) read(body, "$.createdAt"), read(result, "$.createdAt"));
        assertEquals((String) read(body, "$.updatedAt"), read(result, "$.updatedAt"));
    }

    @ParameterizedTest @ValueSource(strings = {"{}", "{\"content\":null}", "{\"content\":\"\"}",
            "{\"content\":\" \\n\\t \"}", "{\"content\":\"x\",\"type\":null}",
            "{\"content\":\"x\",\"type\":\"OTHER\"}", "{\"content\":\"x\",\"type\":1}"})
    void rejectsInvalidCreate(String body) throws Exception {
        mvc.perform(post("/api/habits/1001/entries").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM habit_entries", Integer.class));
    }

    @Test void enforcesLengthLimitForCreateAndUpdate() throws Exception {
        String body = create(1001, json.writeValueAsString(Map.of("content", "x".repeat(5000))));
        String tooLong = json.writeValueAsString(Map.of("content", "x".repeat(5001)));
        mvc.perform(post("/api/habits/1001/entries").contentType(MediaType.APPLICATION_JSON).content(tooLong))
                .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/habits/1001/entries/{id}", id(body)).contentType(MediaType.APPLICATION_JSON).content(tooLong))
                .andExpect(status().isBadRequest());
        assertEquals(5000, jdbc.queryForObject("SELECT CHAR_LENGTH(content) FROM habit_entries WHERE id=?", Integer.class, id(body)));
    }

    @Test void listsOnlyThisHabitsEntriesInStableCreatedOrderWithBoundedPages() throws Exception {
        long first = create(1001), second = create(1001), third = create(1001);
        create(1002);
        jdbc.update("UPDATE habit_entries SET created_at=? WHERE habit_id=1001", Timestamp.from(Instant.parse("2026-01-02T00:00:00Z")));
        jdbc.update("UPDATE habit_entries SET created_at=? WHERE id=?", Timestamp.from(Instant.parse("2026-01-01T00:00:00Z")), second);
        update(1001, first, "{\"content\":\"Edited later\"}");
        mvc.perform(get("/api/habits/1001/entries").param("size", "2"))
                .andExpect(jsonPath("$.entries.length()").value(2))
                .andExpect(jsonPath("$.entries[0].id").value(third))
                .andExpect(jsonPath("$.entries[1].id").value(first))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.hasMore").value(true));
        mvc.perform(get("/api/habits/1001/entries").param("size", "2").param("page", "1"))
                .andExpect(jsonPath("$.entries.length()").value(1)).andExpect(jsonPath("$.entries[0].id").value(second))
                .andExpect(jsonPath("$.hasMore").value(false));
        mvc.perform(get("/api/habits/1001/entries").param("page", "100"))
                .andExpect(jsonPath("$.entries.length()").value(0)).andExpect(jsonPath("$.hasMore").value(false));
    }

    @Test void returnsEmptyListAndDefaultPageIsLimitedToTwenty() throws Exception {
        mvc.perform(get("/api/habits/1001/entries")).andExpect(status().isOk())
                .andExpect(jsonPath("$.entries.length()").value(0)).andExpect(jsonPath("$.hasMore").value(false))
                .andExpect(jsonPath("$.totalElements").value(0));
        for (int i = 0; i < 21; i++) create(1001);
        mvc.perform(get("/api/habits/1001/entries")).andExpect(jsonPath("$.entries.length()").value(20))
                .andExpect(jsonPath("$.hasMore").value(true)).andExpect(jsonPath("$.totalElements").value(21));
        mvc.perform(get("/api/habits/1001/entries").param("size", "3"))
                .andExpect(jsonPath("$.entries.length()").value(3)).andExpect(jsonPath("$.totalElements").value(21));
    }

    @ParameterizedTest @CsvSource({"-1,20", "0,0", "0,-1", "0,101", "2147483647,100"})
    void rejectsInvalidPagination(int page, int size) throws Exception {
        mvc.perform(get("/api/habits/1001/entries").param("page", "" + page).param("size", "" + size))
                .andExpect(status().isBadRequest());
    }

    @Test void patchesOneOrBothFieldsPreservingCreationDate() throws Exception {
        long id = create(1001);
        String past = "2020-01-01T00:00:00Z";
        jdbc.update("UPDATE habit_entries SET created_at=?, updated_at=? WHERE id=?",
                Timestamp.from(Instant.parse(past)), Timestamp.from(Instant.parse(past)), id);
        String contentChanged = update(1001, id, "{\"content\":\"  New\\nnotes  \"}");
        assertEquals("New\nnotes", read(contentChanged, "$.content"));
        assertEquals("NOTE", read(contentChanged, "$.type"));
        assertEquals(past, read(contentChanged, "$.createdAt"));
        assertTrue(Instant.parse(read(contentChanged, "$.updatedAt")).isAfter(Instant.parse(past)));
        String typeChanged = update(1001, id, "{\"type\":\"INSIGHT\"}");
        assertEquals("New\nnotes", read(typeChanged, "$.content"));
        assertEquals("INSIGHT", read(typeChanged, "$.type"));
        String both = update(1001, id, "{\"type\":\"DIFFICULTY\",\"content\":\"Changed\"}");
        assertEquals("DIFFICULTY", read(both, "$.type"));
        assertEquals("Changed", read(both, "$.content"));
    }

    @ParameterizedTest @ValueSource(strings = {"{}", "{\"type\":\"NOTE\"}", "{\"content\":\"  Entry  \"}"})
    void unchangedPatchDoesNotTouchAuditDatesOrIssueAnUpdate(String patch) throws Exception {
        String initial = create(1001, "{\"content\":\"Entry\"}");
        var stats = emf.unwrap(SessionFactory.class).getStatistics();
        boolean enabled = stats.isStatisticsEnabled();
        stats.setStatisticsEnabled(true); stats.clear();
        try {
            String result = update(1001, id(initial), patch);
            assertEquals((String) read(initial, "$.createdAt"), read(result, "$.createdAt"));
            assertEquals((String) read(initial, "$.updatedAt"), read(result, "$.updatedAt"));
            assertEquals(0, stats.getEntityUpdateCount());
        } finally { stats.setStatisticsEnabled(enabled); }
    }

    @ParameterizedTest @ValueSource(strings = {"{\"content\":null}", "{\"content\":\"\"}",
            "{\"content\":\" \\t\\n \"}", "{\"type\":null}", "{\"type\":\"UNKNOWN\"}", "{\"type\":2}"})
    void rejectsInvalidPatchWithoutChangingEntry(String body) throws Exception {
        long id = create(1001);
        mvc.perform(patch("/api/habits/1001/entries/{id}", id).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        assertEquals("Entry", jdbc.queryForObject("SELECT content FROM habit_entries WHERE id=?", String.class, id));
        assertEquals("NOTE", jdbc.queryForObject("SELECT type FROM habit_entries WHERE id=?", String.class, id));
    }

    @Test void checksOwnershipAndEntryHabitMatchForAllOperations() throws Exception {
        long own = create(1001);
        when(currentUser.getUserId()).thenReturn(2L);
        long other = create(2001);
        when(currentUser.getUserId()).thenReturn(1L);
        for (long habit : new long[]{2001, 9999}) {
            mvc.perform(get("/api/habits/{habit}/entries", habit)).andExpect(status().isNotFound());
            mvc.perform(post("/api/habits/{habit}/entries", habit).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"content\":\"Valid\"}")).andExpect(status().isNotFound());
            mvc.perform(patch("/api/habits/{habit}/entries/{id}", habit, other).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"content\":\"Changed\"}")).andExpect(status().isNotFound());
            mvc.perform(delete("/api/habits/{habit}/entries/{id}", habit, other)).andExpect(status().isNotFound());
        }
        for (long id : new long[]{own, other, 99999}) {
            long habit = id == own ? 1002 : 1001;
            mvc.perform(patch("/api/habits/{habit}/entries/{id}", habit, id).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"type\":\"SUCCESS\"}")).andExpect(status().isNotFound());
            mvc.perform(delete("/api/habits/{habit}/entries/{id}", habit, id)).andExpect(status().isNotFound());
        }
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM habit_entries", Integer.class));
    }

    @Test void manuallyEndedHabitsAreReadOnly() throws Exception {
        long id = create(1001);
        mvc.perform(put("/api/habits/1001/ending").contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"ACHIEVED\"}")).andExpect(status().isOk());
        mvc.perform(get("/api/habits/1001/entries")).andExpect(status().isOk()).andExpect(jsonPath("$.entries.length()").value(1));
        mvc.perform(post("/api/habits/1001/entries").contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"New\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.detail").isNotEmpty());
        mvc.perform(patch("/api/habits/1001/entries/{id}", id).contentType(MediaType.APPLICATION_JSON).content("{\"type\":\"SUCCESS\"}"))
                .andExpect(status().isConflict());
        mvc.perform(delete("/api/habits/1001/entries/{id}", id)).andExpect(status().isConflict());
        assertEquals("NOTE", jdbc.queryForObject("SELECT type FROM habit_entries WHERE id=?", String.class, id));

    }

    @Test void deleteDoesNotAffectOtherEntriesAndDeletingHabitCascades() throws Exception {
        long first = create(1001), second = create(1001), other = create(1002);
        mvc.perform(delete("/api/habits/1001/entries/{id}", first)).andExpect(status().isNoContent());
        mvc.perform(delete("/api/habits/1001/entries/{id}", first)).andExpect(status().isNotFound());
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM habits WHERE user_id=1", Integer.class));
        mvc.perform(delete("/api/habits/1001")).andExpect(status().isNoContent());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM habit_entries WHERE id=?", Integer.class, second));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM habit_entries WHERE id=?", Integer.class, other));
    }


    @ParameterizedTest @EnumSource(HabitStatus.class)
    void everyActivityStatusAllowsJournalCrud(HabitStatus status) throws Exception {
        jdbc.update("UPDATE habits SET activity_status=? WHERE id=1001", status.name());
        long id = create(1001);
        update(1001, id, "{\"type\":\"INSIGHT\"}");
        mvc.perform(get("/api/habits/1001/entries")).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(delete("/api/habits/1001/entries/{id}", id)).andExpect(status().isNoContent());
        assertEquals(status.name(), jdbc.queryForObject("SELECT activity_status FROM habits WHERE id=1001", String.class));
    }

    @ParameterizedTest @ValueSource(strings = {"date", "limit"})
    void automaticallyFinishedHabitsAreReadOnlyAndScheduleReactivationRestoresWrites(String ending) throws Exception {
        long id = create(1001);
        var today = java.time.LocalDate.now(HabitCalendar.ZONE);
        jdbc.update("UPDATE habits SET start_date=? WHERE id=1001", today.minusDays(10));
        if (ending.equals("date")) jdbc.update("UPDATE habits SET end_date=? WHERE id=1001", today.minusDays(1));
        else {
            jdbc.update("UPDATE habits SET completion_limit=1 WHERE id=1001");
            jdbc.update("INSERT INTO habit_completions(habit_id,completion_date) VALUES(1001,?)", today);
        }
        mvc.perform(get("/api/habits/1001/entries")).andExpect(status().isOk());
        mvc.perform(post("/api/habits/1001/entries").contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"New\"}")).andExpect(status().isConflict());
        mvc.perform(patch("/api/habits/1001/entries/{id}", id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"type\":\"SUCCESS\"}")).andExpect(status().isConflict());
        mvc.perform(delete("/api/habits/1001/entries/{id}", id)).andExpect(status().isConflict());
        // Existing configuration API can extend an automatically finished habit.
        mvc.perform(put("/api/habits/1001").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"First\",\"targetDays\":3,\"rewardPoints\":0,\"startDate\":\"" + today.minusDays(10)
                        + "\",\"completionLimit\":10}" )).andExpect(status().isOk());
        update(1001, id, "{\"type\":\"SUCCESS\"}");
        create(1001);
        mvc.perform(delete("/api/habits/1001/entries/{id}", id)).andExpect(status().isNoContent());
    }

    @Test void pauseResumeAndGoalLinksPreserveIndependentJournals() throws Exception {
        long id = create(1001);
        jdbc.update("INSERT INTO habit_status_periods(habit_id,status,started_at,open_slot) VALUES(1001,'ACTIVE',CURRENT_TIMESTAMP,1)");
        for (String state : new String[]{"PAUSED", "ACTIVE"}) {
            mvc.perform(patch("/api/habits/1001/status").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"status\":\"" + state + "\"}")).andExpect(status().isOk());
            mvc.perform(get("/api/habits/1001/entries")).andExpect(jsonPath("$.entries[0].id").value(id));
        }
        jdbc.update("INSERT INTO goals(id,user_id,title) VALUES(3001,1,'Goal'),(3002,1,'Other goal')");
        for (long goal : new long[]{3001, 3002}) {
            mvc.perform(put("/api/goals/{goal}/habits/1001", goal)).andExpect(status().isNoContent());
            mvc.perform(get("/api/goals/{goal}/entries", goal)).andExpect(jsonPath("$.totalElements").value(0));
        }
        mvc.perform(delete("/api/goals/3001/habits/1001")).andExpect(status().isNoContent());
        mvc.perform(delete("/api/goals/3002")).andExpect(status().isNoContent());
        mvc.perform(get("/api/habits/1001/entries")).andExpect(jsonPath("$.entries[0].id").value(id));
    }

    @Test void journalCrudDoesNotChangeCompletionsProgressPointsBonusesOrRegularity() throws Exception {
        jdbc.update("INSERT INTO habit_completions(habit_id,completion_date) VALUES(1001,CURRENT_DATE)");
        jdbc.update("INSERT INTO habit_targets(habit_id,target_days,effective_from) VALUES(1001,3,CURRENT_DATE)");
        var habit = jdbc.queryForMap("SELECT * FROM habits WHERE id=1001");
        var completions = jdbc.queryForList("SELECT * FROM habit_completions");
        var targets = jdbc.queryForList("SELECT * FROM habit_targets");
        var awards = jdbc.queryForList("SELECT * FROM habit_weekly_awards");
        var bonuses = jdbc.queryForList("SELECT * FROM habit_completion_bonus_awards");
        String before = mvc.perform(get("/api/habits")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long id = create(1001);
        update(1001, id, "{\"content\":\"Updated\"}");
        mvc.perform(delete("/api/habits/1001/entries/{id}", id)).andExpect(status().isNoContent());
        String after = mvc.perform(get("/api/habits")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertEquals(json.readTree(before), json.readTree(after));
        assertEquals(habit, jdbc.queryForMap("SELECT * FROM habits WHERE id=1001"));
        assertEquals(completions, jdbc.queryForList("SELECT * FROM habit_completions"));
        assertEquals(targets, jdbc.queryForList("SELECT * FROM habit_targets"));
        assertEquals(awards, jdbc.queryForList("SELECT * FROM habit_weekly_awards"));
        assertEquals(bonuses, jdbc.queryForList("SELECT * FROM habit_completion_bonus_awards"));
        assertEquals(37, jdbc.queryForObject("SELECT points FROM users WHERE id=1", Integer.class));
    }
}
