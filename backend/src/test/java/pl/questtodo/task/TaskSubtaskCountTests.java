package pl.questtodo.task;

import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
@Sql("/reset-tasks.sql")
class TaskSubtaskCountTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManagerFactory emf;

    @Test
    void countsReflectChangesAndArePresentInOverviewHistoryAndMutationResponses() throws Exception {
        mvc.perform(get("/api/tasks/1")).andExpect(jsonPath("$.subtaskCount").value(0))
                .andExpect(jsonPath("$.completedSubtaskCount").value(0));
        jdbc.update("INSERT INTO subtasks(task_id,title,position,completed) VALUES (1,'First',0,true),(1,'Second',1,false)");
        mvc.perform(get("/api/tasks/overview"))
                .andExpect(jsonPath("$.tasks[0].subtaskCount").value(2))
                .andExpect(jsonPath("$.tasks[0].completedSubtaskCount").value(1))
                .andExpect(jsonPath("$.tasks[1].subtaskCount").value(0));
        mvc.perform(patch("/api/tasks/1/focus").contentType(MediaType.APPLICATION_JSON).content("{\"inFocus\":true}"))
                .andExpect(jsonPath("$.subtaskCount").value(2));
        mvc.perform(patch("/api/tasks/1/completion").contentType(MediaType.APPLICATION_JSON).content("{\"completed\":true}"))
                .andExpect(jsonPath("$.completedSubtaskCount").value(1));
        mvc.perform(get("/api/tasks/history"))
                .andExpect(jsonPath("$.tasks[0].subtaskCount").value(2))
                .andExpect(jsonPath("$.tasks[0].completedSubtaskCount").value(1));
        jdbc.update("UPDATE subtasks SET completed = true WHERE task_id = 1");
        mvc.perform(get("/api/tasks/1")).andExpect(jsonPath("$.completedSubtaskCount").value(2));
        jdbc.update("DELETE FROM subtasks WHERE task_id = 1 AND position = 0");
        mvc.perform(get("/api/tasks/1")).andExpect(jsonPath("$.subtaskCount").value(1))
                .andExpect(jsonPath("$.completedSubtaskCount").value(1));
    }

    @Test
    void addingTasksDoesNotIncreaseQueryCountOrLoadSubtaskEntities() throws Exception {
        var statistics = emf.unwrap(SessionFactory.class).getStatistics();
        boolean enabled = statistics.isStatisticsEnabled();
        statistics.setStatisticsEnabled(true);
        try {
            jdbc.update("INSERT INTO subtasks(task_id,title,position) VALUES (1,'First',0)");
            statistics.clear();
            mvc.perform(get("/api/tasks")).andExpect(status().isOk());
            long smallListQueries = statistics.getPrepareStatementCount();
            for (int i = 100; i < 110; i++) {
                jdbc.update("INSERT INTO tasks(id,user_id,title,points,completed) VALUES (?,1,'Task',1,false)", i);
                jdbc.update("INSERT INTO subtasks(task_id,title,position) VALUES (?,'Child',0)", i);
            }
            statistics.clear();
            mvc.perform(get("/api/tasks")).andExpect(status().isOk())
                    .andExpect(jsonPath("$[12].subtaskCount").value(1));
            assertEquals(smallListQueries, statistics.getPrepareStatementCount());
            assertEquals(0, statistics.getEntityStatistics(SubtaskEntity.class.getName()).getLoadCount());
            assertEquals(0, statistics.getCollectionLoadCount());
        } finally {
            statistics.setStatisticsEnabled(enabled);
        }
    }
}
