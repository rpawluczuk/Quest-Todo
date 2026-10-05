package pl.questtodo.reward;

import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
@Sql(scripts = "/reset-tasks.sql", statements = "UPDATE users SET points = 100 WHERE id = 1")
@Sql(scripts = "/reset-tasks.sql", executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
class PurchaseLifecycleTests {
    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;

    private long buy() throws Exception {
        String json = mockMvc.perform(post("/api/rewards/1/purchases"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.purchasedAt").isNotEmpty())
                .andExpect(jsonPath("$.usedAt").value(nullValue()))
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(json, "$.id")).longValue();
    }

    @Test
    void usesOneOfTwoPurchasesWithoutSpendingMorePointsOrRemovingTheOffer() throws Exception {
        long first = buy();
        long second = buy();
        String json = mockMvc.perform(post("/api/rewards/purchases/{id}/use", first))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(first))
                .andExpect(jsonPath("$.title").value("Odcinek ulubionego serialu"))
                .andExpect(jsonPath("$.cost").value(20))
                .andExpect(jsonPath("$.purchasedAt").isNotEmpty())
                .andExpect(jsonPath("$.usedAt").isNotEmpty())
                .andReturn().getResponse().getContentAsString();
        String usedAt = JsonPath.read(json, "$.usedAt");
        mockMvc.perform(post("/api/rewards/purchases/{id}/use", first)).andExpect(status().isConflict());
        mockMvc.perform(get("/api/rewards/purchases"))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].usedAt").value(usedAt))
                .andExpect(jsonPath("$[1].id").value(second))
                .andExpect(jsonPath("$[1].usedAt").value(nullValue()));
        mockMvc.perform(get("/api/users/me")).andExpect(jsonPath("$.points").value(60));
        mockMvc.perform(get("/api/rewards")).andExpect(jsonPath("$.length()").value(3));
    }

    @Test
    void legacyPurchaseCanBeUsedEvenWithNegativeBalance() throws Exception {
        jdbc.update("INSERT INTO purchases (user_id, reward_id, title, cost) VALUES (1, 1, 'Stara nagroda', 20)");
        jdbc.update("UPDATE users SET points = -10 WHERE id = 1");
        long id = jdbc.queryForObject("SELECT id FROM purchases WHERE user_id = 1", Long.class);
        mockMvc.perform(post("/api/rewards/purchases/{id}/use", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.purchasedAt").value(nullValue()))
                .andExpect(jsonPath("$.usedAt").isNotEmpty());
        mockMvc.perform(get("/api/users/me")).andExpect(jsonPath("$.points").value(-10));
    }

    @Test
    void missingPurchaseReturnsNotFound() throws Exception {
        mockMvc.perform(post("/api/rewards/purchases/999999/use")).andExpect(status().isNotFound());
    }

    @Test
    void cannotUseAnotherUsersPurchase() throws Exception {
        jdbc.update("INSERT INTO users (id, name, points) VALUES (999, 'Inny gracz', 0)");
        try {
            jdbc.update("INSERT INTO purchases (user_id, reward_id, title, cost) VALUES (999, 1, 'Cudza nagroda', 20)");
            long id = jdbc.queryForObject("SELECT id FROM purchases WHERE user_id = 999", Long.class);
            mockMvc.perform(post("/api/rewards/purchases/{id}/use", id)).andExpect(status().isNotFound());
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM purchases WHERE user_id = 999 AND used_at IS NOT NULL", Integer.class));
        } finally {
            jdbc.update("DELETE FROM purchases WHERE user_id = 999");
            jdbc.update("DELETE FROM users WHERE id = 999");
        }
    }

    @Test
    void concurrentRequestsUseTheSamePurchaseOnlyOnce() throws Exception {
        long id = buy();
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var calls = java.util.stream.IntStream.range(0, 2).mapToObj(ignored -> executor.submit(() -> {
                start.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(post("/api/rewards/purchases/{id}/use", id))
                        .andReturn().getResponse().getStatus();
            })).toList();
            start.countDown();
            var statuses = List.of(calls.get(0).get(10, TimeUnit.SECONDS), calls.get(1).get(10, TimeUnit.SECONDS));
            assertEquals(List.of(200, 409), statuses.stream().sorted().toList());
        }
        mockMvc.perform(get("/api/users/me")).andExpect(jsonPath("$.points").value(80));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM purchases WHERE used_at IS NOT NULL", Integer.class));
    }
}
