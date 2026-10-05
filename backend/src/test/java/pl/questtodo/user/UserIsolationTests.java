package pl.questtodo.user;

import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:user_isolation;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
@Transactional
class UserIsolationTests {
    @Autowired private MockMvc mvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private EntityManager entityManager;
    @MockitoBean private CurrentUserProvider currentUser;

    @BeforeEach
    void prepareTwoAccounts() {
        jdbc.update("DELETE FROM purchases");
        jdbc.update("DELETE FROM tasks");
        jdbc.update("DELETE FROM rewards");
        jdbc.update("UPDATE users SET points = 100 WHERE id = 1");
        jdbc.update("INSERT INTO users (id, name, points) VALUES (2, 'Second user', 100)");
        for (long userId : new long[]{1, 2}) {
            long id = userId * 1000;
            jdbc.update("INSERT INTO tasks (id, title, points, user_id) VALUES (?, ?, 10, ?)",
                    id, "Task " + userId, userId);
            jdbc.update("INSERT INTO rewards (id, title, cost, user_id) VALUES (?, ?, 20, ?)",
                    id, "Reward " + userId, userId);
            jdbc.update("INSERT INTO purchases (id, user_id, reward_id, title, cost, purchased_at) VALUES (?, ?, ?, ?, 20, CURRENT_TIMESTAMP)",
                    id, userId, id, "Purchase " + userId);
        }
    }

    @ParameterizedTest
    @ValueSource(longs = {1, 2})
    void readsOnlyCurrentUsersProfileAndLists(long userId) throws Exception {
        when(currentUser.getUserId()).thenReturn(userId);
        mvc.perform(get("/api/users/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(userId))
                .andExpect(jsonPath("$.points").value(100));
        for (String path : new String[]{"/api/tasks", "/api/rewards", "/api/rewards/purchases"}) {
            mvc.perform(get(path))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].id").value(userId * 1000));
        }
    }

    @ParameterizedTest
    @ValueSource(longs = {1, 2})
    void cannotEditCompleteFocusOrDeleteAnotherUsersTask(long userId) throws Exception {
        when(currentUser.getUserId()).thenReturn(userId);
        long otherTaskId = (3 - userId) * 1000;
        var tasksBefore = jdbc.queryForList("SELECT * FROM tasks ORDER BY id");
        mvc.perform(patch("/api/tasks/{id}", otherTaskId).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Changed\",\"points\":50}"))
                .andExpect(status().isNotFound());
        mvc.perform(patch("/api/tasks/{id}/completion", otherTaskId).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"completed\":true}"))
                .andExpect(status().isNotFound());
        mvc.perform(patch("/api/tasks/{id}/focus", otherTaskId).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"inFocus\":true}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/tasks/{id}", otherTaskId)).andExpect(status().isNotFound());
        assertEquals(tasksBefore, jdbc.queryForList("SELECT * FROM tasks ORDER BY id"));
        assertBalance(1, 100);
        assertBalance(2, 100);
    }

    @ParameterizedTest
    @ValueSource(longs = {1, 2})
    void cannotEditDeleteOrBuyAnotherUsersReward(long userId) throws Exception {
        when(currentUser.getUserId()).thenReturn(userId);
        long otherRewardId = (3 - userId) * 1000;
        var rewardsBefore = jdbc.queryForList("SELECT * FROM rewards ORDER BY id");
        var purchasesBefore = jdbc.queryForList("SELECT * FROM purchases ORDER BY id");
        mvc.perform(put("/api/rewards/{id}", otherRewardId).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Changed\",\"cost\":1}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/rewards/{id}", otherRewardId)).andExpect(status().isNotFound());
        mvc.perform(post("/api/rewards/{id}/purchases", otherRewardId)).andExpect(status().isNotFound());
        assertEquals(rewardsBefore, jdbc.queryForList("SELECT * FROM rewards ORDER BY id"));
        assertEquals(purchasesBefore, jdbc.queryForList("SELECT * FROM purchases ORDER BY id"));
        assertBalance(1, 100);
        assertBalance(2, 100);
    }

    @ParameterizedTest
    @ValueSource(longs = {1, 2})
    void cannotUseAnotherUsersPurchase(long userId) throws Exception {
        when(currentUser.getUserId()).thenReturn(userId);
        var purchasesBefore = jdbc.queryForList("SELECT * FROM purchases ORDER BY id");
        mvc.perform(post("/api/rewards/purchases/{id}/use", (3 - userId) * 1000))
                .andExpect(status().isNotFound());
        assertEquals(purchasesBefore, jdbc.queryForList("SELECT * FROM purchases ORDER BY id"));
        assertBalance(1, 100);
        assertBalance(2, 100);
    }

    @ParameterizedTest
    @ValueSource(longs = {1, 2})
    void newTasksRewardsAndPurchasesBelongToCurrentUserAndOnlyChangeTheirBalance(long userId) throws Exception {
        when(currentUser.getUserId()).thenReturn(userId);
        String taskJson = mvc.perform(post("/api/tasks").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"New task\",\"points\":25}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long taskId = ((Number) JsonPath.read(taskJson, "$.id")).longValue();
        assertEquals(userId, jdbc.queryForObject("SELECT user_id FROM tasks WHERE id = ?", Long.class, taskId));
        mvc.perform(patch("/api/tasks/{id}/completion", taskId).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"completed\":true}"))
                .andExpect(status().isOk());
        assertBalance(userId, 125);

        String rewardJson = mvc.perform(post("/api/rewards").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"New reward\",\"cost\":30}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long rewardId = ((Number) JsonPath.read(rewardJson, "$.id")).longValue();
        assertEquals(userId, jdbc.queryForObject("SELECT user_id FROM rewards WHERE id = ?", Long.class, rewardId));
        String purchaseJson = mvc.perform(post("/api/rewards/{id}/purchases", rewardId))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long purchaseId = ((Number) JsonPath.read(purchaseJson, "$.id")).longValue();
        assertEquals(userId, jdbc.queryForObject("SELECT user_id FROM purchases WHERE id = ?", Long.class, purchaseId));
        assertBalance(userId, 95);
        assertBalance(3 - userId, 100);

        mvc.perform(post("/api/rewards/purchases/{id}/use", purchaseId))
                .andExpect(status().isOk()).andExpect(jsonPath("$.usedAt").isNotEmpty());
        mvc.perform(patch("/api/tasks/{id}/completion", taskId).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"completed\":false}"))
                .andExpect(status().isOk());
        assertBalance(userId, 70);
        assertBalance(3 - userId, 100);

        when(currentUser.getUserId()).thenReturn(3 - userId);
        for (String path : new String[]{"/api/tasks", "/api/rewards", "/api/rewards/purchases"}) {
            mvc.perform(get(path)).andExpect(jsonPath("$.length()").value(1));
        }
    }

    @ParameterizedTest
    @ValueSource(longs = {1, 2})
    void canEditAndDeleteOwnRewardWhileKeepingPurchaseHistory(long userId) throws Exception {
        when(currentUser.getUserId()).thenReturn(userId);
        long rewardId = userId * 1000;
        mvc.perform(put("/api/rewards/{id}", rewardId).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Edited reward\",\"cost\":40}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.cost").value(40));
        mvc.perform(delete("/api/rewards/{id}", rewardId)).andExpect(status().isNoContent());
        mvc.perform(get("/api/rewards")).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/rewards/purchases"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Purchase " + userId))
                .andExpect(jsonPath("$[0].cost").value(20));
        mvc.perform(post("/api/rewards/purchases/{id}/use", rewardId)).andExpect(status().isOk());
        assertBalance(1, 100);
        assertBalance(2, 100);
        when(currentUser.getUserId()).thenReturn(3 - userId);
        mvc.perform(get("/api/rewards"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Reward " + (3 - userId)));
    }

    private void assertBalance(long userId, long expected) {
        entityManager.flush();
        assertEquals(expected, jdbc.queryForObject("SELECT points FROM users WHERE id = ?", Long.class, userId));
    }
}
