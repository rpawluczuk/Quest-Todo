package pl.questtodo.goal;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import pl.questtodo.user.CurrentUserProvider;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:goalhabits;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
@Transactional
class GoalHabitControllerTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired jakarta.persistence.EntityManager entityManager;
    @MockitoBean CurrentUserProvider currentUser;

    @BeforeEach
    void prepare() {
        jdbc.update("DELETE FROM goals");
        jdbc.update("DELETE FROM habits");
        jdbc.update("DELETE FROM users WHERE id = 2");
        jdbc.update("INSERT INTO users(id, name, points) VALUES (2, 'Other', 0)");
        jdbc.update("INSERT INTO goals(id, user_id, title) VALUES (1001,1,'First'),(1002,1,'Second'),(2001,2,'Other')");
        jdbc.update("INSERT INTO habits(id, user_id, name, created_on, reward_points) VALUES "
                + "(1001,1,'Training',CURRENT_DATE,10),(1002,1,'Reading',CURRENT_DATE,20),"
                + "(2001,2,'Other',CURRENT_DATE,30)");
        when(currentUser.getUserId()).thenReturn(1L);
    }

    @Test
    void attachesIdempotentlyToMultipleGoalsAndDetachesWithoutChangingHabitOrPoints() throws Exception {
        long points = jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Long.class);
        for (long goal : new long[]{1001, 1001, 1002}) {
            mvc.perform(put("/api/goals/{id}/habits/1001", goal)).andExpect(status().isNoContent());
        }
        entityManager.flush();
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM goal_habits", Integer.class));
        jdbc.update("INSERT INTO goal_habits(goal_id, habit_id) VALUES (2001, 2001)");
        mvc.perform(get("/api/habits").param("includeInactive", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1001))
                .andExpect(jsonPath("$[0].goalIds[0]").value(1001))
                .andExpect(jsonPath("$[0].goalIds[1]").value(1002))
                .andExpect(jsonPath("$[0].goalTitles.length()").value(2))
                .andExpect(jsonPath("$[0].goalTitles[0]").value("First"))
                .andExpect(jsonPath("$[0].goalTitles[1]").value("Second"))
                .andExpect(jsonPath("$[1].goalTitles.length()").value(0));
        mvc.perform(get("/api/goals/1001/habits")).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].name").value("Training"));
        for (int i = 0; i < 2; i++) {
            mvc.perform(delete("/api/goals/1001/habits/1001")).andExpect(status().isNoContent());
        }
        mvc.perform(get("/api/goals/1001/habits")).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/goals/1002/habits")).andExpect(jsonPath("$.length()").value(1));
        entityManager.flush();
        assertEquals(points, jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Long.class));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM habits WHERE id = 1001", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM habit_completions WHERE habit_id = 1001", Integer.class));
    }

    @Test
    void waitingHabitsCanBeListedAttachedAndDetachedWithoutChangingStatusOrOtherGoals() throws Exception {
        jdbc.update("UPDATE habits SET activity_status='PLANNED' WHERE id=1001");
        jdbc.update("UPDATE habits SET activity_status='PAUSED' WHERE id=1002");
        long points = jdbc.queryForObject("SELECT points FROM users WHERE id=1", Long.class);
        mvc.perform(get("/api/goals/1001/habits/available"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.habits.length()").value(2));
        mvc.perform(put("/api/goals/1001/habits/1001")).andExpect(status().isNoContent());
        mvc.perform(put("/api/goals/1001/habits/1002")).andExpect(status().isNoContent());
        mvc.perform(put("/api/goals/1002/habits/1001")).andExpect(status().isNoContent());
        mvc.perform(get("/api/goals/1001/habits"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
        mvc.perform(delete("/api/goals/1001/habits/1001")).andExpect(status().isNoContent());
        mvc.perform(get("/api/goals/1002/habits"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        assertEquals("PLANNED", jdbc.queryForObject("SELECT activity_status FROM habits WHERE id=1001", String.class));
        assertEquals("PAUSED", jdbc.queryForObject("SELECT activity_status FROM habits WHERE id=1002", String.class));
        assertEquals(points, jdbc.queryForObject("SELECT points FROM users WHERE id=1", Long.class));
    }

    @Test
    void protectsOwnershipAndMissingResources() throws Exception {
        for (String path : new String[]{"/api/goals/2001/habits", "/api/goals/9999/habits"}) {
            mvc.perform(get(path)).andExpect(status().isNotFound());
            mvc.perform(get(path + "/available")).andExpect(status().isNotFound());
        }
        for (String path : new String[]{"/api/goals/2001/habits/1001", "/api/goals/1001/habits/2001",
                "/api/goals/9999/habits/1001", "/api/goals/1001/habits/9999"}) {
            mvc.perform(put(path)).andExpect(status().isNotFound());
            mvc.perform(delete(path)).andExpect(status().isNotFound());
        }
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM goal_habits", Integer.class));
    }

    @Test
    void pagesSearchesAndExcludesAlreadyAttachedAndOtherUsersHabits() throws Exception {
        mvc.perform(get("/api/goals/1001/habits/available").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.habits[0].id").value(1002))
                .andExpect(jsonPath("$.hasMore").value(true));
        mvc.perform(get("/api/goals/1001/habits/available").param("size", "1").param("page", "1"))
                .andExpect(jsonPath("$.habits[0].id").value(1001)).andExpect(jsonPath("$.hasMore").value(false));
        mvc.perform(get("/api/goals/1001/habits/available").param("query", " TRAIN "))
                .andExpect(jsonPath("$.habits.length()").value(1)).andExpect(jsonPath("$.habits[0].id").value(1001));
        mvc.perform(put("/api/goals/1001/habits/1001")).andExpect(status().isNoContent());
        mvc.perform(get("/api/goals/1001/habits/available"))
                .andExpect(jsonPath("$.habits.length()").value(1)).andExpect(jsonPath("$.habits[0].id").value(1002));
        mvc.perform(get("/api/goals/1001/habits/available").param("page", "-1")).andExpect(status().isBadRequest());
        for (String size : new String[]{"0", "21"}) {
            mvc.perform(get("/api/goals/1001/habits/available").param("size", size)).andExpect(status().isBadRequest());
        }
    }

    @Test
    void deletingGoalPreservesHabitAndDeletingHabitCascadesLinks() throws Exception {
        mvc.perform(put("/api/goals/1001/habits/1001")).andExpect(status().isNoContent());
        mvc.perform(put("/api/goals/1002/habits/1001")).andExpect(status().isNoContent());
        entityManager.flush();
        entityManager.clear();
        mvc.perform(delete("/api/goals/1001")).andExpect(status().isNoContent());
        entityManager.flush();
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM habits WHERE id = 1001", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM goal_habits", Integer.class));
        mvc.perform(delete("/api/habits/1001")).andExpect(status().isNoContent());
        entityManager.flush();
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM goal_habits", Integer.class));
        mvc.perform(get("/api/goals/1002")).andExpect(status().isOk());
    }

    @Test
    void createsAndEditsHabitGoalLinksAtomicallyFromHabitForm() throws Exception {
        String created = mvc.perform(post("/api/habits").contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"New habit\",\"targetDays\":3,\"rewardPoints\":10,"
                                + "\"goalIds\":[1002,1001,1001]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.goalIds[0]").value(1001))
                .andExpect(jsonPath("$.goalIds[1]").value(1002))
                .andExpect(jsonPath("$.goalTitles[0]").value("First"))
                .andExpect(jsonPath("$.goalTitles[1]").value("Second"))
                .andReturn().getResponse().getContentAsString();
        int habitId = com.jayway.jsonpath.JsonPath.read(created, "$.id");
        entityManager.flush();
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM goal_habits WHERE habit_id = ?", Integer.class, habitId));

        mvc.perform(put("/api/habits/{id}/configuration", habitId)
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Edited habit\",\"targetDays\":3,\"rewardPoints\":10,\"goalIds\":[1002]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.habit.goalIds.length()").value(1))
                .andExpect(jsonPath("$.habit.goalIds[0]").value(1002))
                .andExpect(jsonPath("$.habit.goalTitles[0]").value("Second"));
        mvc.perform(put("/api/habits/{id}/configuration", habitId)
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Keep links\",\"targetDays\":3,\"rewardPoints\":10}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.habit.goalIds[0]").value(1002));
        mvc.perform(put("/api/habits/{id}/configuration", habitId)
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"No goals\",\"targetDays\":3,\"rewardPoints\":10,\"goalIds\":[]}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.habit.goalIds.length()").value(0));

        mvc.perform(post("/api/habits").contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Must roll back\",\"targetDays\":3,\"rewardPoints\":10,\"goalIds\":[2001]}"))
                .andExpect(status().isNotFound());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM habits WHERE name = 'Must roll back'", Integer.class));
        mvc.perform(put("/api/habits/{id}/configuration", habitId)
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Must also roll back\",\"targetDays\":3,\"rewardPoints\":10,\"goalIds\":[2001]}"))
                .andExpect(status().isNotFound());
        assertEquals("No goals", jdbc.queryForObject("SELECT name FROM habits WHERE id = ?", String.class, habitId));
    }
}
