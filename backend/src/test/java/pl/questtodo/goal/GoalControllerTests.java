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

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:goals;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
@Transactional
class GoalControllerTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired jakarta.persistence.EntityManager entityManager;
    @MockitoBean CurrentUserProvider currentUser;

    @BeforeEach
    void prepare() {
        jdbc.update("DELETE FROM goals");
        jdbc.update("DELETE FROM users WHERE id = 2");
        jdbc.update("INSERT INTO users(id, name, points) VALUES (2, 'Second user', 0)");
        when(currentUser.getUserId()).thenReturn(1L);
    }

    @Test
    void createsListsUpdatesAndDeletesOwnGoal() throws Exception {
        mvc.perform(post("/api/goals").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"  Przebiec 5 km  \",\"currentState\":\"  Biegam kilometr  \","
                                + "\"desiredOutcome\":\"  Przebiegam pięć kilometrów  \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Przebiec 5 km"))
                .andExpect(jsonPath("$.currentState").value("Biegam kilometr"))
                .andExpect(jsonPath("$.desiredOutcome").value("Przebiegam pięć kilometrów"));
        long id = jdbc.queryForObject("SELECT id FROM goals WHERE user_id = 1", Long.class);
        mvc.perform(get("/api/goals"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(id));
        mvc.perform(get("/api/goals/{id}", id))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Przebiec 5 km"));
        mvc.perform(put("/api/goals/{id}", id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"  Nowy cel  \",\"currentState\":\"   \","
                                + "\"desiredOutcome\":\"Nowy efekt\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Nowy cel"))
                .andExpect(jsonPath("$.currentState").doesNotExist())
                .andExpect(jsonPath("$.desiredOutcome").value("Nowy efekt"));
        mvc.perform(delete("/api/goals/{id}", id)).andExpect(status().isNoContent());
        mvc.perform(get("/api/goals")).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void rejectsInvalidTitlesWithoutChangingData() throws Exception {
        for (String title : new String[]{"", "   ", "x".repeat(121)}) {
            mvc.perform(post("/api/goals").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"" + title + "\"}"))
                    .andExpect(status().isBadRequest());
        }
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM goals", Integer.class));
    }

    @Test
    void rejectsGoalDefinitionFieldsLongerThanLimit() throws Exception {
        String tooLong = "x".repeat(2001);
        for (String field : new String[]{"currentState", "desiredOutcome"}) {
            mvc.perform(post("/api/goals").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"Cel\",\"" + field + "\":\"" + tooLong + "\"}"))
                    .andExpect(status().isBadRequest());
        }
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM goals", Integer.class));
    }

    @Test
    void otherUsersGoalsAreInvisibleAndCannotBeModified() throws Exception {
        jdbc.update("INSERT INTO goals(id, user_id, title) VALUES (1001, 1, 'Own goal'), (2001, 2, 'Other goal')");
        mvc.perform(get("/api/goals"))
                .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].title").value("Own goal"));
        mvc.perform(get("/api/goals/2001")).andExpect(status().isNotFound());
        mvc.perform(put("/api/goals/2001").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Changed\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/goals/2001")).andExpect(status().isNotFound());
        assertEquals("Other goal", jdbc.queryForObject("SELECT title FROM goals WHERE id = 2001", String.class));
        when(currentUser.getUserId()).thenReturn(2L);
        mvc.perform(get("/api/goals"))
                .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].title").value("Other goal"));
    }

    @Test
    void movingTaskBetweenGoalsKeepsStateAndDoesNotAddPoints() throws Exception {
        seedLinks();
        long points = jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Long.class);
        for (long goalId : new long[]{1001, 1001, 1002}) {
            mvc.perform(put("/api/goals/{id}/tasks/1001", goalId)).andExpect(status().isNoContent());
        }
        entityManager.flush();
        assertEquals(1002L, jdbc.queryForObject("SELECT goal_id FROM tasks WHERE id = 1001", Long.class));
        assertEquals(points, jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Long.class));
        mvc.perform(patch("/api/tasks/1001/completion").contentType(MediaType.APPLICATION_JSON)
                .content("{\"completed\":true}")).andExpect(status().isOk());
        mvc.perform(get("/api/goals/1001/tasks"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/goals/1002/tasks"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].completed").value(true));
        mvc.perform(delete("/api/goals/1001/tasks/1001")).andExpect(status().isNoContent());
        assertEquals(1002L, jdbc.queryForObject("SELECT goal_id FROM tasks WHERE id = 1001", Long.class));
        mvc.perform(delete("/api/goals/1002/tasks/1001")).andExpect(status().isNoContent());
        entityManager.flush();
        assertEquals(points + 10, jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Long.class));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM tasks WHERE id = 1001", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM tasks WHERE id = 1001 AND goal_id IS NOT NULL", Integer.class));
    }

    @Test
    void taskResponseContainsItsSingleGoalWithoutLeakingAnotherUsersData() throws Exception {
        seedLinks();
        mvc.perform(put("/api/goals/1002/tasks/1001")).andExpect(status().isNoContent());
        jdbc.update("UPDATE tasks SET goal_id = 2001 WHERE id = 2001");

        mvc.perform(get("/api/tasks/1001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1001))
                .andExpect(jsonPath("$.goalId").value(1002))
                .andExpect(jsonPath("$.goalTitle").value("Second"));
    }

    @Test
    void createsAndEditsTaskGoalLinksAtomicallyFromTaskForm() throws Exception {
        seedLinks();
        String created = mvc.perform(post("/api/tasks").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"New task\",\"points\":10,\"goalId\":1001}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.goalId").value(1001))
                .andExpect(jsonPath("$.goalTitle").value("First"))
                .andReturn().getResponse().getContentAsString();
        int taskId = com.jayway.jsonpath.JsonPath.read(created, "$.id");
        entityManager.flush();
        assertEquals(1001L, jdbc.queryForObject("SELECT goal_id FROM tasks WHERE id = ?", Long.class, taskId));

        mvc.perform(patch("/api/tasks/{id}", taskId).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Edited task\",\"points\":20,\"goalId\":1002}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goalId").value(1002))
                .andExpect(jsonPath("$.goalTitle").value("Second"));
        mvc.perform(patch("/api/tasks/{id}", taskId).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Keep links\",\"points\":20}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.goalId").value(1002));
        mvc.perform(patch("/api/tasks/{id}", taskId).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"No goal\",\"points\":20,\"clearGoal\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.goalId").doesNotExist());

        mvc.perform(post("/api/tasks").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Must roll back\",\"points\":10,\"goalId\":2001}"))
                .andExpect(status().isNotFound());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM tasks WHERE title = 'Must roll back'", Integer.class));
        mvc.perform(patch("/api/tasks/{id}", taskId).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Must also roll back\",\"points\":20,\"goalId\":2001}"))
                .andExpect(status().isNotFound());
        assertEquals("No goal", jdbc.queryForObject("SELECT title FROM tasks WHERE id = ?", String.class, taskId));
    }

    @Test
    void cannotReadOrChangeLinksForAnotherUsersGoalOrTask() throws Exception {
        seedLinks();
        mvc.perform(get("/api/goals/2001/tasks")).andExpect(status().isNotFound());
        for (String path : new String[]{"/api/goals/2001/tasks/1001", "/api/goals/1001/tasks/2001",
                "/api/goals/9999/tasks/1001", "/api/goals/1001/tasks/9999"}) {
            mvc.perform(put(path)).andExpect(status().isNotFound());
            mvc.perform(delete(path)).andExpect(status().isNotFound());
        }
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM tasks WHERE goal_id IS NOT NULL", Integer.class));
    }

    @Test
    void deletingGoalPreservesAndDetachesTask() throws Exception {
        seedLinks();
        mvc.perform(put("/api/goals/1001/tasks/1001")).andExpect(status().isNoContent());
        entityManager.flush();
        entityManager.clear();
        mvc.perform(delete("/api/goals/1001")).andExpect(status().isNoContent());
        entityManager.flush();
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM tasks WHERE id = 1001", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM tasks WHERE id = 1001 AND goal_id IS NOT NULL", Integer.class));
        mvc.perform(delete("/api/tasks/1001")).andExpect(status().isNoContent());
        entityManager.flush();
        mvc.perform(get("/api/goals/1002")).andExpect(status().isOk());
    }

    @Test
    void listsAvailableTasksLazilyWithActivePrioritiesFirstAndCompletedOnRequest() throws Exception {
        seedLinks();
        jdbc.update("INSERT INTO tasks(id, user_id, title, points, in_focus, completed) VALUES "
                + "(1002, 1, 'Picker backlog task', 10, false, false), "
                + "(1003, 1, 'Picker priority task', 10, true, false), "
                + "(1004, 1, 'Picker finished matching task', 10, false, true), "
                + "(2002, 2, 'Other priority task', 10, true, false)");
        mvc.perform(put("/api/goals/1001/tasks/1001")).andExpect(status().isNoContent());

        mvc.perform(get("/api/goals/1001/tasks/available").param("size", "1").param("query", "picker"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tasks.length()").value(1))
                .andExpect(jsonPath("$.tasks[0].title").value("Picker priority task"))
                .andExpect(jsonPath("$.hasMore").value(true));
        mvc.perform(get("/api/goals/1001/tasks/available").param("size", "1").param("page", "1")
                        .param("query", "picker"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tasks.length()").value(1))
                .andExpect(jsonPath("$.tasks[0].title").value("Picker backlog task"))
                .andExpect(jsonPath("$.hasMore").value(false));
        mvc.perform(get("/api/goals/1001/tasks/available")
                        .param("completed", "true").param("query", "matching"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tasks.length()").value(1))
                .andExpect(jsonPath("$.tasks[0].title").value("Picker finished matching task"));
    }

    @Test
    void validatesAvailableTaskPagingAndGoalOwnership() throws Exception {
        seedLinks();
        mvc.perform(get("/api/goals/1001/tasks/available").param("page", "-1"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/goals/1001/tasks/available").param("size", "21"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/goals/2001/tasks/available"))
                .andExpect(status().isNotFound());
    }

    private void seedLinks() {
        jdbc.update("INSERT INTO goals(id, user_id, title) VALUES (1001, 1, 'First'), (1002, 1, 'Second'), (2001, 2, 'Other')");
        jdbc.update("INSERT INTO tasks(id, user_id, title, points) VALUES (1001, 1, 'Task', 10), (2001, 2, 'Other task', 10)");
    }
}
