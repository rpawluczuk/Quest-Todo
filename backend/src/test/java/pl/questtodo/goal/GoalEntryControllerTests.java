package pl.questtodo.goal;

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

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:goal_entries;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
class GoalEntryControllerTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired jakarta.persistence.EntityManagerFactory emf;
    @MockitoBean CurrentUserProvider currentUser;
    private final ObjectMapper json = new ObjectMapper();

    @BeforeEach void prepare() {
        jdbc.update("DELETE FROM goals");
        jdbc.update("DELETE FROM users WHERE id=2");
        jdbc.update("INSERT INTO users(id,name,points) VALUES(2,'Other',0)");
        jdbc.update("UPDATE users SET points=37 WHERE id=1");
        jdbc.update("INSERT INTO goals(id,user_id,title) VALUES(1001,1,'First'),(1002,1,'Second'),(2001,2,'Other')");
        when(currentUser.getUserId()).thenReturn(1L);
    }

    private String create(long goal, String body) throws Exception {
        return mvc.perform(post("/api/goals/{goal}/entries", goal).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    }
    private long create(long goal) throws Exception { return id(create(goal, "{\"content\":\"Entry\"}")); }
    private long id(String body) { return ((Number) read(body, "$.id")).longValue(); }
    private String update(long goal, long id, String body) throws Exception {
        return mvc.perform(patch("/api/goals/{goal}/entries/{id}", goal, id)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }
    private void complete(boolean value) throws Exception {
        mvc.perform(patch("/api/goals/1001/completion").contentType(MediaType.APPLICATION_JSON)
                .content("{\"completed\":" + value + "}")).andExpect(status().isOk());
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
        assertEquals(type.name(), jdbc.queryForObject("SELECT type FROM goal_entries WHERE id=?", String.class, id));
        mvc.perform(get("/api/goals/1001/entries")).andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[0].id").value(id))
                .andExpect(jsonPath("$.entries[0].createdAt").value(created))
                .andExpect(jsonPath("$.entries[0].goal").doesNotExist())
                .andExpect(jsonPath("$.hasMore").value(false));
        assertEquals(37, jdbc.queryForObject("SELECT points FROM users WHERE id=1", Integer.class));
        assertFalse(jdbc.queryForObject("SELECT completed FROM goals WHERE id=1001", Boolean.class));
    }

    @Test void defaultsToNoteAndDoesNotAllowClientToWriteOwnershipGoalOrDates() throws Exception {
        String forged = "{\"content\":\"Entry\",\"goalId\":2001,\"userId\":2,\"id\":999,"
                + "\"createdAt\":\"2000-01-01T00:00:00Z\",\"updatedAt\":\"2000-01-01T00:00:00Z\"}";
        String body = create(1001, forged);
        assertEquals("NOTE", read(body, "$.type"));
        long id = id(body);
        assertNotEquals(999L, id);
        assertEquals(1001L, jdbc.queryForObject("SELECT goal_id FROM goal_entries WHERE id=?", Long.class, id));
        assertNotEquals("2000-01-01T00:00:00Z", read(body, "$.createdAt"));
        String result = update(1001, id, forged);
        assertEquals((String) read(body, "$.createdAt"), read(result, "$.createdAt"));
        assertEquals((String) read(body, "$.updatedAt"), read(result, "$.updatedAt"));
    }

    @ParameterizedTest @ValueSource(strings = {"{}", "{\"content\":null}", "{\"content\":\"\"}",
            "{\"content\":\" \\n\\t \"}", "{\"content\":\"x\",\"type\":null}",
            "{\"content\":\"x\",\"type\":\"OTHER\"}", "{\"content\":\"x\",\"type\":1}"})
    void rejectsInvalidCreate(String body) throws Exception {
        mvc.perform(post("/api/goals/1001/entries").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM goal_entries", Integer.class));
    }

    @Test void enforcesLengthLimitForCreateAndUpdate() throws Exception {
        String body = create(1001, json.writeValueAsString(Map.of("content", "x".repeat(5000))));
        String tooLong = json.writeValueAsString(Map.of("content", "x".repeat(5001)));
        mvc.perform(post("/api/goals/1001/entries").contentType(MediaType.APPLICATION_JSON).content(tooLong))
                .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/goals/1001/entries/{id}", id(body)).contentType(MediaType.APPLICATION_JSON).content(tooLong))
                .andExpect(status().isBadRequest());
        assertEquals(5000, jdbc.queryForObject("SELECT CHAR_LENGTH(content) FROM goal_entries WHERE id=?", Integer.class, id(body)));
    }

    @Test void listsOnlyThisGoalsEntriesInStableCreatedOrderWithBoundedPages() throws Exception {
        long first = create(1001), second = create(1001), third = create(1001);
        create(1002);
        jdbc.update("UPDATE goal_entries SET created_at=? WHERE goal_id=1001", Timestamp.from(Instant.parse("2026-01-02T00:00:00Z")));
        jdbc.update("UPDATE goal_entries SET created_at=? WHERE id=?", Timestamp.from(Instant.parse("2026-01-01T00:00:00Z")), second);
        update(1001, first, "{\"content\":\"Edited later\"}");
        mvc.perform(get("/api/goals/1001/entries").param("size", "2"))
                .andExpect(jsonPath("$.entries.length()").value(2))
                .andExpect(jsonPath("$.entries[0].id").value(third))
                .andExpect(jsonPath("$.entries[1].id").value(first))
                .andExpect(jsonPath("$.hasMore").value(true));
        mvc.perform(get("/api/goals/1001/entries").param("size", "2").param("page", "1"))
                .andExpect(jsonPath("$.entries.length()").value(1)).andExpect(jsonPath("$.entries[0].id").value(second))
                .andExpect(jsonPath("$.hasMore").value(false));
        mvc.perform(get("/api/goals/1001/entries").param("page", "100"))
                .andExpect(jsonPath("$.entries.length()").value(0)).andExpect(jsonPath("$.hasMore").value(false));
    }

    @Test void returnsEmptyListAndDefaultPageIsLimitedToTwenty() throws Exception {
        mvc.perform(get("/api/goals/1001/entries")).andExpect(status().isOk())
                .andExpect(jsonPath("$.entries.length()").value(0)).andExpect(jsonPath("$.hasMore").value(false));
        for (int i = 0; i < 21; i++) create(1001);
        mvc.perform(get("/api/goals/1001/entries")).andExpect(jsonPath("$.entries.length()").value(20))
                .andExpect(jsonPath("$.hasMore").value(true));
    }

    @ParameterizedTest @CsvSource({"-1,20", "0,0", "0,-1", "0,101", "2147483647,100"})
    void rejectsInvalidPagination(int page, int size) throws Exception {
        mvc.perform(get("/api/goals/1001/entries").param("page", "" + page).param("size", "" + size))
                .andExpect(status().isBadRequest());
    }

    @Test void patchesOneOrBothFieldsPreservingCreationDate() throws Exception {
        long id = create(1001);
        String past = "2020-01-01T00:00:00Z";
        jdbc.update("UPDATE goal_entries SET created_at=?, updated_at=? WHERE id=?",
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
        mvc.perform(patch("/api/goals/1001/entries/{id}", id).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        assertEquals("Entry", jdbc.queryForObject("SELECT content FROM goal_entries WHERE id=?", String.class, id));
        assertEquals("NOTE", jdbc.queryForObject("SELECT type FROM goal_entries WHERE id=?", String.class, id));
    }

    @Test void checksOwnershipAndEntryGoalMatchForAllOperations() throws Exception {
        long own = create(1001);
        when(currentUser.getUserId()).thenReturn(2L);
        long other = create(2001);
        when(currentUser.getUserId()).thenReturn(1L);
        for (long goal : new long[]{2001, 9999}) {
            mvc.perform(get("/api/goals/{goal}/entries", goal)).andExpect(status().isNotFound());
            mvc.perform(post("/api/goals/{goal}/entries", goal).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"content\":\"Valid\"}")).andExpect(status().isNotFound());
            mvc.perform(patch("/api/goals/{goal}/entries/{id}", goal, other).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"content\":\"Changed\"}")).andExpect(status().isNotFound());
            mvc.perform(delete("/api/goals/{goal}/entries/{id}", goal, other)).andExpect(status().isNotFound());
        }
        for (long id : new long[]{own, other, 99999}) {
            long goal = id == own ? 1002 : 1001;
            mvc.perform(patch("/api/goals/{goal}/entries/{id}", goal, id).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"type\":\"SUCCESS\"}")).andExpect(status().isNotFound());
            mvc.perform(delete("/api/goals/{goal}/entries/{id}", goal, id)).andExpect(status().isNotFound());
        }
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM goal_entries", Integer.class));
    }

    @Test void achievedGoalsAreReadOnlyAndReopeningRestoresAllWrites() throws Exception {
        long id = create(1001);
        complete(true);
        mvc.perform(get("/api/goals/1001/entries")).andExpect(status().isOk()).andExpect(jsonPath("$.entries.length()").value(1));
        mvc.perform(post("/api/goals/1001/entries").contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"New\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.detail").isNotEmpty());
        mvc.perform(patch("/api/goals/1001/entries/{id}", id).contentType(MediaType.APPLICATION_JSON).content("{\"type\":\"SUCCESS\"}"))
                .andExpect(status().isConflict());
        mvc.perform(delete("/api/goals/1001/entries/{id}", id)).andExpect(status().isConflict());
        assertEquals("NOTE", jdbc.queryForObject("SELECT type FROM goal_entries WHERE id=?", String.class, id));
        complete(false);
        update(1001, id, "{\"type\":\"SUCCESS\"}");
        create(1001);
        mvc.perform(delete("/api/goals/1001/entries/{id}", id)).andExpect(status().isNoContent());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM goal_entries WHERE goal_id=1001", Integer.class));
    }

    @Test void deleteDoesNotAffectOtherEntriesAndDeletingGoalCascades() throws Exception {
        long first = create(1001), second = create(1001), other = create(1002);
        mvc.perform(delete("/api/goals/1001/entries/{id}", first)).andExpect(status().isNoContent());
        mvc.perform(delete("/api/goals/1001/entries/{id}", first)).andExpect(status().isNotFound());
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM goals WHERE user_id=1", Integer.class));
        mvc.perform(delete("/api/goals/1001")).andExpect(status().isNoContent());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM goal_entries WHERE id=?", Integer.class, second));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM goal_entries WHERE id=?", Integer.class, other));
    }

    @Test void journalCrudDoesNotChangeGoalDetailsStatusPointsMilestonesTasksOrHabits() throws Exception {
        jdbc.update("INSERT INTO milestones(goal_id,title,position) VALUES(1001,'Milestone',0)");
        jdbc.update("INSERT INTO tasks(id,user_id,title,points,goal_id) VALUES(901,1,'Task',3,1001)");
        jdbc.update("INSERT INTO habits(id,user_id,name,created_on,reward_points) VALUES(901,1,'Habit',CURRENT_DATE,3)");
        jdbc.update("INSERT INTO goal_habits(goal_id,habit_id) VALUES(1001,901)");
        var goal = jdbc.queryForMap("SELECT * FROM goals WHERE id=1001");
        var milestones = jdbc.queryForList("SELECT * FROM milestones WHERE goal_id=1001");
        var tasks = jdbc.queryForList("SELECT * FROM tasks WHERE id=901");
        var habits = jdbc.queryForList("SELECT * FROM habits WHERE id=901");
        long id = id(create(1001, "{\"type\":\"SUCCESS\",\"content\":\"Success\"}"));
        update(1001, id, "{\"content\":\"Updated\"}");
        mvc.perform(delete("/api/goals/1001/entries/{id}", id)).andExpect(status().isNoContent());
        assertEquals(goal, jdbc.queryForMap("SELECT * FROM goals WHERE id=1001"));
        assertEquals(milestones, jdbc.queryForList("SELECT * FROM milestones WHERE goal_id=1001"));
        assertEquals(tasks, jdbc.queryForList("SELECT * FROM tasks WHERE id=901"));
        assertEquals(habits, jdbc.queryForList("SELECT * FROM habits WHERE id=901"));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM goal_habits WHERE goal_id=1001", Integer.class));
        assertEquals(37, jdbc.queryForObject("SELECT points FROM users WHERE id=1", Integer.class));
        jdbc.update("DELETE FROM tasks WHERE id=901");
        jdbc.update("DELETE FROM habits WHERE id=901");
    }
}
