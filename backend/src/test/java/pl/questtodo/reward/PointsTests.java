package pl.questtodo.reward;

import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Sql("/reset-tasks.sql")
@Sql(scripts = "/reset-tasks.sql", executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
class PointsTests {
    @Autowired MockMvc mvc;

    private void complete(boolean completed) throws Exception {
        mvc.perform(patch("/api/tasks/1/completion").contentType(MediaType.APPLICATION_JSON)
                .content("{\"completed\":" + completed + "}")).andExpect(status().isOk());
    }

    private void balance(long points) throws Exception {
        mvc.perform(get("/api/users/me")).andExpect(status().isOk())
                .andExpect(jsonPath("$.points").value(points));
    }

    @Test void completionIsIdempotentAndDeletionPreservesEarnings() throws Exception {
        complete(true);
        complete(true);
        balance(20);
        complete(false);
        complete(false);
        balance(0);
        complete(true);
        mvc.perform(delete("/api/tasks/1")).andExpect(status().isNoContent());
        balance(20);
    }

    @Test void purchasePersistsAndUndoCanCreateDebt() throws Exception {
        complete(true);
        mvc.perform(post("/api/rewards/1/purchases")).andExpect(status().isCreated())
                .andExpect(jsonPath("$.cost").value(20));
        balance(0);
        mvc.perform(get("/api/rewards/purchases")).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].rewardId").value(1));
        complete(false);
        balance(-20);
        mvc.perform(post("/api/rewards/1/purchases")).andExpect(status().isConflict());
        mvc.perform(post("/api/rewards/999/purchases")).andExpect(status().isNotFound());
        balance(-20);
        mvc.perform(get("/api/rewards/purchases")).andExpect(jsonPath("$.length()").value(1));
    }

    @Test void concurrentCompletionRequestsAwardPointsOnce() throws Exception {
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Void> finish = () -> { complete(true); return null; };
            for (var result : executor.invokeAll(List.of(finish, finish))) result.get();
        }
        balance(20);
    }

    @Test void concurrentPurchasesCannotOverspend() throws Exception {
        complete(true);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Integer> buy = () -> mvc.perform(post("/api/rewards/1/purchases"))
                    .andReturn().getResponse().getStatus();
            var results = executor.invokeAll(List.of(buy, buy));
            var statuses = List.of(results.get(0).get(), results.get(1).get()).stream().sorted().toList();
            assertEquals(List.of(201, 409), statuses);
        }
        balance(0);
        mvc.perform(get("/api/rewards/purchases")).andExpect(jsonPath("$.length()").value(1));
    }
}
