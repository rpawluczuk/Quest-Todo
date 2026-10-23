package pl.questtodo.goal;

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

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:milestones;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
@Transactional
class MilestoneControllerTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired jakarta.persistence.EntityManager entityManager;
    @MockitoBean CurrentUserProvider currentUser;

    @BeforeEach
    void prepare() {
        jdbc.update("DELETE FROM goals");
        jdbc.update("INSERT INTO users(id, name, points) VALUES (2, 'Other user', 0)");
        jdbc.update("INSERT INTO goals(id, user_id, title) VALUES (1001, 1, 'Own'), (2001, 2, 'Other')");
        when(currentUser.getUserId()).thenReturn(1L);
    }

    @Test
    void createsPersistsAndListsInPositionOrderWithoutAwardingPoints() throws Exception {
        long balance = jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Long.class);
        mvc.perform(get("/api/goals/1001/milestones"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        for (int index = 0; index < 3; index++) {
            mvc.perform(post("/api/goals/1001/milestones").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"title\":\"  Result " + index + "  \"}"))
                    .andExpect(status().isCreated()).andExpect(jsonPath("$.id").isNumber())
                    .andExpect(jsonPath("$.title").value("Result " + index))
                    .andExpect(jsonPath("$.completed").value(false))
                    .andExpect(jsonPath("$.position").value(index));
        }
        entityManager.flush();
        entityManager.clear();
        // Ensure retrieval sorts by position rather than insertion ID.
        jdbc.update("UPDATE milestones SET position = 10 WHERE position = 0");
        mvc.perform(get("/api/goals/1001/milestones"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].title").value("Result 1"))
                .andExpect(jsonPath("$[2].title").value("Result 0"));
        mvc.perform(post("/api/goals/1001/milestones").contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Last\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.position").value(11));
        assertEquals(balance, jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Long.class));
    }

    @Test
    void rejectsMissingBlankAndTooLongTitles() throws Exception {
        for (String body : new String[]{"{}", "{\"title\":null}", "{\"title\":\"\"}",
                "{\"title\":\"   \"}", "{\"title\":\"" + "x".repeat(121) + "\"}"}) {
            mvc.perform(post("/api/goals/1001/milestones").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM milestones", Integer.class));
    }

    @Test
    void isolatesUsersAndRejectsMissingGoals() throws Exception {
        jdbc.update("INSERT INTO milestones(goal_id, title, position) VALUES (2001, 'Private', 0)");
        for (long id : new long[]{2001, 9999}) {
            mvc.perform(get("/api/goals/{id}/milestones", id)).andExpect(status().isNotFound());
            mvc.perform(post("/api/goals/{id}/milestones", id).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"title\":\"Forbidden\"}")).andExpect(status().isNotFound());
        }
        when(currentUser.getUserId()).thenReturn(2L);
        mvc.perform(get("/api/goals/2001/milestones"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].title").value("Private"));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM milestones", Integer.class));
    }

    @Test
    void completionIsPersistentReversibleAndIdempotentWithoutChangingGoalOrBalance() throws Exception {
        jdbc.update("INSERT INTO milestones(id, goal_id, title, position) VALUES (8001, 1001, 'First', 0), (8002, 1001, 'Second', 1)");
        long balance = jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Long.class);
        for (boolean completed : new boolean[]{true, true, false, false, true}) {
            mvc.perform(patch("/api/goals/1001/milestones/8002/completion")
                    .contentType(MediaType.APPLICATION_JSON).content("{\"completed\":" + completed + "}"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.completed").value(completed));
            entityManager.flush();
            entityManager.clear();
            mvc.perform(get("/api/goals/1001/milestones"))
                    .andExpect(jsonPath("$[0].id").value(8001))
                    .andExpect(jsonPath("$[0].completed").value(false))
                    .andExpect(jsonPath("$[1].id").value(8002))
                    .andExpect(jsonPath("$[1].completed").value(completed));
        }
        mvc.perform(patch("/api/goals/1001/milestones/8001/completion")
                .contentType(MediaType.APPLICATION_JSON).content("{\"completed\":true}"))
                .andExpect(status().isOk());
        entityManager.flush();
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM milestones WHERE goal_id = 1001 AND completed = true", Integer.class));
        assertEquals("Own", jdbc.queryForObject("SELECT title FROM goals WHERE id = 1001", String.class));
        assertEquals(balance, jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Long.class));
    }

    @Test
    void completionRejectsForeignMissingAndMismatchedMilestonesAndInvalidPayloads() throws Exception {
        jdbc.update("INSERT INTO milestones(id, goal_id, title, position) VALUES (8001, 1001, 'Own', 0), (8002, 2001, 'Private', 0)");
        for (String path : new String[]{"2001/milestones/8002", "1001/milestones/8002", "2001/milestones/8001", "1001/milestones/9999", "9999/milestones/8001"}) {
            mvc.perform(patch("/api/goals/" + path + "/completion").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"completed\":true}")).andExpect(status().isNotFound());
        }
        for (String body : new String[]{"{}", "{\"completed\":null}"}) {
            mvc.perform(patch("/api/goals/1001/milestones/8001/completion").contentType(MediaType.APPLICATION_JSON)
                    .content(body)).andExpect(status().isBadRequest());
        }
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM milestones WHERE completed = true", Integer.class));
    }

    @Test
    void deletingGoalDeletesItsMilestonesOnly() throws Exception {
        jdbc.update("INSERT INTO milestones(goal_id, title, position) VALUES (1001, 'Own', 0), (2001, 'Other', 0)");
        mvc.perform(delete("/api/goals/1001")).andExpect(status().isNoContent());
        entityManager.flush();
        entityManager.clear();
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM milestones WHERE goal_id = 1001", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM milestones WHERE goal_id = 2001", Integer.class));
    }
}
