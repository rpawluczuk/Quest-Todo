package pl.questtodo.reward;

import com.jayway.jsonpath.JsonPath;
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
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
@Sql(scripts = "/reset-tasks.sql", statements = "UPDATE users SET points = 100 WHERE id = 1")
@Sql(statements = {"DELETE FROM purchases", "DELETE FROM rewards WHERE title = 'One-time test'"}, executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
class OneTimeRewardTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    long create(String type) throws Exception {
        var json = mvc.perform(post("/api/rewards").contentType("application/json")
                .content(body(type))).andExpect(status().isCreated())
                .andExpect(jsonPath("$.purchaseType").value(type)).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(json, "$.id")).longValue();
    }

    String body(String type) {
        return "{\"title\":\"One-time test\",\"cost\":20,\"purchaseType\":\"" + type + "\"}";
    }

    void edit(long id, String type) throws Exception {
        mvc.perform(put("/api/rewards/{id}", id).contentType("application/json").content(body(type)))
                .andExpect(status().isOk());
    }

    long buy(long id) throws Exception {
        var json = mvc.perform(post("/api/rewards/{id}/purchases", id)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(json, "$.id")).longValue();
    }

    @Test void oneTimePurchaseDisappearsAndUseDoesNotReopenIt() throws Exception {
        long id = create("ONE_TIME");
        long purchase = buy(id);
        mvc.perform(get("/api/rewards")).andExpect(jsonPath("$[?(@.id == " + id + ")]").isEmpty());
        mvc.perform(post("/api/rewards/{id}/purchases", id)).andExpect(status().isConflict());
        mvc.perform(post("/api/rewards/purchases/{id}/use", purchase)).andExpect(status().isOk());
        mvc.perform(post("/api/rewards/{id}/purchases", id)).andExpect(status().isConflict());
        assertEquals(80, jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Integer.class));
    }

    @Test void switchingToOneTimeIgnoresOldPurchasesAndOrdinaryEditingDoesNotRenewIt() throws Exception {
        long id = create("REPEATABLE");
        buy(id);
        buy(id);
        edit(id, "ONE_TIME");
        mvc.perform(get("/api/rewards")).andExpect(jsonPath("$[?(@.id == " + id + ")]").isNotEmpty());
        buy(id);
        edit(id, "ONE_TIME");
        mvc.perform(post("/api/rewards/{id}/purchases", id)).andExpect(status().isConflict());
        edit(id, "REPEATABLE");
        buy(id);
        edit(id, "ONE_TIME");
        buy(id);
        mvc.perform(post("/api/rewards/{id}/purchases", id)).andExpect(status().isConflict());
        assertEquals(5, jdbc.queryForObject("SELECT count(*) FROM purchases WHERE reward_id = ?", Integer.class, id));
    }

    @Test void insufficientBalanceDoesNotConsumeAvailability() throws Exception {
        long id = create("ONE_TIME");
        jdbc.update("UPDATE users SET points = 0 WHERE id = 1");
        mvc.perform(post("/api/rewards/{id}/purchases", id)).andExpect(status().isConflict());
        jdbc.update("UPDATE users SET points = 100 WHERE id = 1");
        buy(id);
    }

    @Test void simultaneousPurchasesChargeOnlyOnce() throws Exception {
        long id = create("ONE_TIME");
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var calls = java.util.stream.IntStream.range(0, 2).mapToObj(ignored -> executor.submit(() -> {
                start.await(5, TimeUnit.SECONDS);
                return mvc.perform(post("/api/rewards/{id}/purchases", id)).andReturn().getResponse().getStatus();
            })).toList();
            start.countDown();
            var statuses = new java.util.ArrayList<Integer>();
            for (var call : calls) statuses.add(call.get(10, TimeUnit.SECONDS));
            statuses.sort(Integer::compareTo);
            assertEquals(java.util.List.of(201, 409), statuses);
        }
        assertEquals(80, jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM purchases WHERE reward_id = ?", Integer.class, id));
    }

    @Test void omittedTypeDefaultsToRepeatableAndUnknownTypeIsRejected() throws Exception {
        mvc.perform(post("/api/rewards").contentType("application/json")
                .content("{\"title\":\"One-time test\",\"cost\":20}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.purchaseType").value("REPEATABLE"));
        mvc.perform(post("/api/rewards").contentType("application/json").content(body("UNKNOWN")))
                .andExpect(status().isBadRequest());
    }
}
