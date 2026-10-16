package pl.questtodo.task;

import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.doReturn;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:taskpriorities;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
@Transactional
class TaskPriorityTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired jakarta.persistence.EntityManager em;
    @MockitoSpyBean TaskPriorityService priorities;
    private final LocalDate today = LocalDate.of(2026, 10, 13);

    @BeforeEach
    void prepare() {
        jdbc.update("DELETE FROM tasks");
        doReturn(today).when(priorities).today();
    }

    private void task(long id, LocalDate due, boolean completed, boolean focus) {
        jdbc.update("INSERT INTO tasks(id,user_id,title,points,due_date,completed,in_focus) VALUES (?,1,'Task',10,?,?,?)",
                id, due, completed, focus);
    }

    @Test
    void overviewPromotesWithinSevenCalendarDaysAndOverdueButNotUndatedOrCompleted() throws Exception {
        task(101, today.plusDays(7), false, false);
        task(102, today.plusDays(8), false, false);
        task(103, today.minusDays(10), false, false);
        task(104, null, false, false);
        task(105, today, true, false);
        task(106, today.plusDays(30), false, true);
        jdbc.update("UPDATE tasks SET due_time = TIME '23:59:00' WHERE id = 101");
        long balance = jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Long.class);
        mvc.perform(get("/api/tasks/overview")).andExpect(status().isOk())
                .andExpect(jsonPath("$.tasks[?(@.inFocus == true)]").value(org.hamcrest.Matchers.hasSize(3)))
                .andExpect(jsonPath("$.completedCount").value(1));
        em.flush();
        for (long id : new long[]{101, 103, 106}) assertEquals(true, focus(id));
        for (long id : new long[]{102, 104, 105}) assertEquals(false, focus(id));
        assertEquals(balance, jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Long.class));
        mvc.perform(get("/api/tasks")).andExpect(status().isOk());
        assertEquals(balance, jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Long.class));
    }

    @Test
    void creationEditingAndUndoCompletionImmediatelyApplyRule() throws Exception {
        mvc.perform(post("/api/tasks").contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"New\",\"points\":10,\"dueDate\":\"2026-10-20\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.inFocus").value(true));
        task(201, today.plusDays(30), false, false);
        mvc.perform(patch("/api/tasks/201").contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Edited\",\"points\":10,\"dueDate\":\"2026-10-14\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.inFocus").value(true));
        mvc.perform(patch("/api/tasks/201").contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Edited\",\"points\":10,\"dueDate\":\"2026-12-14\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.inFocus").value(true));
        task(202, today, true, false);
        mvc.perform(patch("/api/tasks/202/completion").contentType(MediaType.APPLICATION_JSON)
                .content("{\"completed\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.inFocus").value(true));
    }

    @Test
    void scheduledPromotionAndReadCatchUpWorkAfterDateAdvances() throws Exception {
        task(301, today.plusDays(8), false, false);
        priorities.promoteDueTasks();
        assertEquals(false, focus(301));
        doReturn(today.plusDays(1)).when(priorities).today();
        priorities.promoteDueTasks();
        assertEquals(true, focus(301));
        task(302, today.plusDays(8), false, false);
        mvc.perform(get("/api/tasks/302")).andExpect(status().isOk())
                .andExpect(jsonPath("$.inFocus").value(true));
    }

    @Test
    void userReadDoesNotPromoteOtherUsersTasksAndManualDemotionOverridesCurrentDeadline() throws Exception {
        jdbc.update("INSERT INTO users(id,name,points) VALUES (9876,'Other',0)");
        jdbc.update("INSERT INTO tasks(id,user_id,title,points,due_date) VALUES (401,9876,'Private',10,?)", today);
        task(402, today, false, true);
        mvc.perform(get("/api/tasks/overview")).andExpect(status().isOk());
        assertEquals(false, focus(401));
        mvc.perform(patch("/api/tasks/402/focus").contentType(MediaType.APPLICATION_JSON)
                .content("{\"inFocus\":false}")).andExpect(status().isOk())
                .andExpect(jsonPath("$.inFocus").value(false));
        mvc.perform(get("/api/tasks/overview")).andExpect(status().isOk());
        assertEquals(false, focus(402));
        priorities.promoteDueTasks();
        assertEquals(false, focus(402));
        mvc.perform(patch("/api/tasks/402").contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Renamed\",\"points\":10,\"dueDate\":\"2026-10-13\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.inFocus").value(false));
        mvc.perform(patch("/api/tasks/402").contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Renamed\",\"points\":10,\"dueDate\":\"2026-10-14\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.inFocus").value(true));
    }

    private boolean focus(long id) {
        return jdbc.queryForObject("SELECT in_focus FROM tasks WHERE id = ?", Boolean.class, id);
    }
}
