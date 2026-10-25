package pl.questtodo.task;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import java.util.concurrent.*;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
@Sql("/reset-tasks.sql")
class SubtaskControllerTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    private String path(long task) { return "/api/tasks/" + task + "/subtasks"; }

    private long create(long task, String title) throws Exception {
        String json = mvc.perform(post(path(task)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"" + title + "\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.completed").value(false))
                .andExpect(jsonPath("$.title").value(title.strip()))
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(json, "$.id")).longValue();
    }

    @Test
    void orderedListUsesAllRowsAndAppendsAfterDeletionIndependentlyForEachTask() throws Exception {
        mvc.perform(get(path(1))).andExpect(status().isOk()).andExpect(content().json("[]"));
        long first = create(1, " First ");
        long second = create(1, "Second");
        long third = create(1, "Third");
        create(2, "Other task");
        mvc.perform(delete(path(1) + "/" + second)).andExpect(status().isNoContent());
        long fourth = create(1, "Fourth");
        mvc.perform(get(path(1))).andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].id").value(first)).andExpect(jsonPath("$[0].position").value(0))
                .andExpect(jsonPath("$[1].id").value(third)).andExpect(jsonPath("$[1].position").value(2))
                .andExpect(jsonPath("$[2].id").value(fourth)).andExpect(jsonPath("$[2].position").value(3));
        mvc.perform(get(path(2))).andExpect(jsonPath("$[0].position").value(0));
        // Equal positions remain deterministic for future reordering/imports.
        jdbc.update("UPDATE subtasks SET position = 0 WHERE task_id = 1");
        mvc.perform(get(path(1))).andExpect(jsonPath("$[0].id").value(first))
                .andExpect(jsonPath("$[1].id").value(third)).andExpect(jsonPath("$[2].id").value(fourth));
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"title\":null}", "{\"title\":\"\"}", "{\"title\":\"   \"}"})
    void rejectsInvalidCreation(String body) throws Exception {
        mvc.perform(post(path(1)).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void enforcesTitleLengthForCreateAndPatch() throws Exception {
        long id = create(1, "a".repeat(120));
        String body = "{\"title\":\"" + "a".repeat(121) + "\"}";
        mvc.perform(post(path(1)).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        mvc.perform(patch(path(1) + "/" + id).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"title\":null}", "{\"title\":\"\"}", "{\"title\":\"   \"}",
            "{\"completed\":null}", "{\"title\":\"Valid\",\"completed\":null}"})
    void rejectsExplicitNullAndBlankPatchWithoutChangingData(String body) throws Exception {
        long id = create(1, "Original");
        mvc.perform(patch(path(1) + "/" + id).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        mvc.perform(get(path(1))).andExpect(jsonPath("$[0].title").value("Original"))
                .andExpect(jsonPath("$[0].completed").value(false));
    }

    @Test
    void partialUpdatesAreIndependentAndNeverAwardPointsOrCompleteParent() throws Exception {
        long id = create(1, "Original");
        String url = path(1) + "/" + id;
        mvc.perform(patch(url).contentType(MediaType.APPLICATION_JSON).content("{\"completed\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Original"))
                .andExpect(jsonPath("$.completed").value(true));
        mvc.perform(patch(url).contentType(MediaType.APPLICATION_JSON).content("{\"title\":\" Renamed \"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Renamed"))
                .andExpect(jsonPath("$.completed").value(true));
        mvc.perform(get("/api/tasks/1")).andExpect(jsonPath("$.completed").value(false));
        mvc.perform(get("/api/users/me")).andExpect(jsonPath("$.points").value(0));
        mvc.perform(patch(url).contentType(MediaType.APPLICATION_JSON).content("{\"completed\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.completed").value(false));
        mvc.perform(patch(url).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Renamed"));
        mvc.perform(patch("/api/tasks/1/completion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"completed\":true}"))
                .andExpect(status().isOk());
        mvc.perform(get(path(1))).andExpect(jsonPath("$[0].completed").value(false));
        mvc.perform(delete(url)).andExpect(status().isNoContent());
        mvc.perform(get("/api/tasks/1")).andExpect(status().isOk()).andExpect(jsonPath("$.completed").value(true));
        mvc.perform(get("/api/users/me")).andExpect(jsonPath("$.points").value(20));
    }

    @Test
    void deletingParentCascadesAndDoesNotAffectOtherTasks() throws Exception {
        create(1, "Child");
        create(2, "Survivor");
        mvc.perform(delete("/api/tasks/1")).andExpect(status().isNoContent());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM subtasks WHERE task_id = 1", Integer.class));
        mvc.perform(get(path(2))).andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void ownershipParentMismatchAndMissingResourcesReturn404() throws Exception {
        long id = create(1, "Private");
        jdbc.update("INSERT INTO users(id,name,points) VALUES (8765,'Other',0)");
        jdbc.update("UPDATE tasks SET user_id = 8765 WHERE id = 1");
        try {
            for (long task : new long[]{1, 999999}) {
                mvc.perform(get(path(task))).andExpect(status().isNotFound());
                mvc.perform(post(path(task)).contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"New\"}"))
                        .andExpect(status().isNotFound());
            }
            for (String url : new String[]{path(1) + "/" + id, path(2) + "/" + id,
                    path(2) + "/999999", path(999999) + "/" + id}) {
                mvc.perform(patch(url).contentType(MediaType.APPLICATION_JSON).content("{\"completed\":true}"))
                        .andExpect(status().isNotFound());
                mvc.perform(delete(url)).andExpect(status().isNotFound());
            }
        } finally {
            jdbc.update("UPDATE tasks SET user_id = 1 WHERE id = 1");
            jdbc.update("DELETE FROM users WHERE id = 8765");
        }
    }

    @Test
    void concurrentCreatesAllocateDistinctConsecutivePositions() throws Exception {
        int count = 6;
        var ready = new CountDownLatch(count);
        var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(count)) {
            var futures = IntStream.range(0, count).mapToObj(i -> pool.submit(() -> {
                ready.countDown();
                assertTrue(start.await(10, TimeUnit.SECONDS));
                return create(1, "Concurrent " + i);
            })).toList();
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            for (var future : futures) future.get(20, TimeUnit.SECONDS);
        }
        assertEquals(IntStream.range(0, count).boxed().toList(), jdbc.queryForList(
                "SELECT position FROM subtasks WHERE task_id = 1 ORDER BY position", Integer.class));
    }
}
