package pl.questtodo.task;

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
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
@Sql("/reset-tasks.sql")
class SubtaskOrderTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManagerFactory emf;

    void seed() {
        jdbc.update("INSERT INTO subtasks(id,task_id,title,position,completed) VALUES (800,1,'First',0,true),(801,1,'Second',2,false),(802,2,'Other',0,false)");
    }

    @Test
    void persistsOrderWithoutChangingStatusTitlePointsOrParentAndRetryDoesNotUpdateRows() throws Exception {
        seed();
        mvc.perform(put("/api/tasks/1/subtasks/order").contentType(MediaType.APPLICATION_JSON).content("{\"subtaskIds\":[801,800]}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(801))
                .andExpect(jsonPath("$[0].position").value(0)).andExpect(jsonPath("$[0].title").value("Second"))
                .andExpect(jsonPath("$[0].completed").value(false)).andExpect(jsonPath("$[1].completed").value(true));
        mvc.perform(get("/api/tasks/1/subtasks")).andExpect(jsonPath("$[0].id").value(801))
                .andExpect(jsonPath("$[1].position").value(1));
        var stats = emf.unwrap(SessionFactory.class).getStatistics();
        boolean enabled = stats.isStatisticsEnabled();
        stats.setStatisticsEnabled(true);
        try {
            stats.clear();
            mvc.perform(put("/api/tasks/1/subtasks/order").contentType(MediaType.APPLICATION_JSON).content("{\"subtaskIds\":[801,800]}"))
                    .andExpect(status().isOk());
            assertEquals(0, stats.getEntityUpdateCount());
        } finally { stats.setStatisticsEnabled(enabled); }
        mvc.perform(get("/api/tasks/1")).andExpect(jsonPath("$.completed").value(false));
        mvc.perform(get("/api/users/me")).andExpect(jsonPath("$.points").value(0));
        mvc.perform(post("/api/tasks/1/subtasks").contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Last\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.position").value(2));
    }

    @ParameterizedTest
    @ValueSource(strings = {"[800,800]", "[800]", "[800,801,802]", "[801,802]", "[800,999999]", "[]"})
    void invalidOrStaleMembershipIsRejectedAtomically(String ids) throws Exception {
        seed();
        mvc.perform(put("/api/tasks/1/subtasks/order").contentType(MediaType.APPLICATION_JSON)
                .content("{\"subtaskIds\":" + ids + "}" )).andExpect(status().isConflict());
        mvc.perform(get("/api/tasks/1/subtasks")).andExpect(jsonPath("$[0].id").value(800))
                .andExpect(jsonPath("$[1].id").value(801)).andExpect(jsonPath("$[1].position").value(2));
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"subtaskIds\":null}", "{\"subtaskIds\":[null]}", "{\"subtaskIds\":[-1]}"})
    void validatesRequest(String body) throws Exception {
        mvc.perform(put("/api/tasks/1/subtasks/order").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void emptyAndSingleListsAndChangesSinceRead() throws Exception {
        mvc.perform(put("/api/tasks/1/subtasks/order").contentType(MediaType.APPLICATION_JSON).content("{\"subtaskIds\":[]}"))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        seed();
        mvc.perform(put("/api/tasks/2/subtasks/order").contentType(MediaType.APPLICATION_JSON).content("{\"subtaskIds\":[802]}"))
                .andExpect(status().isOk());
        // A second client adds an item after the first client read its list.
        mvc.perform(post("/api/tasks/1/subtasks").contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Concurrent addition\"}"))
                .andExpect(status().isCreated());
        mvc.perform(put("/api/tasks/1/subtasks/order").contentType(MediaType.APPLICATION_JSON).content("{\"subtaskIds\":[801,800]}"))
                .andExpect(status().isConflict());
        mvc.perform(get("/api/tasks/1/subtasks")).andExpect(jsonPath("$.length()").value(3));
        mvc.perform(delete("/api/tasks/2/subtasks/802")).andExpect(status().isNoContent());
        mvc.perform(put("/api/tasks/2/subtasks/order").contentType(MediaType.APPLICATION_JSON).content("{\"subtaskIds\":[802]}"))
                .andExpect(status().isConflict());
    }

    @Test
    void rejectsOtherOwnersAndMissingTasks() throws Exception {
        seed();
        jdbc.update("INSERT INTO users(id,name,points) VALUES (8765,'Other',0)");
        jdbc.update("UPDATE tasks SET user_id=8765 WHERE id=1");
        try {
            for (long task : new long[]{1, 999999}) mvc.perform(put("/api/tasks/" + task + "/subtasks/order")
                    .contentType(MediaType.APPLICATION_JSON).content("{\"subtaskIds\":[801,800]}"))
                    .andExpect(status().isNotFound());
        } finally {
            jdbc.update("UPDATE tasks SET user_id=1 WHERE id=1");
            jdbc.update("DELETE FROM users WHERE id=8765");
        }
    }
}
