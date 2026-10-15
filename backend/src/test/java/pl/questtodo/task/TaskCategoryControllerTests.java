package pl.questtodo.task;

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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:task_categories;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
@Transactional
class TaskCategoryControllerTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean CurrentUserProvider currentUser;

    @BeforeEach
    void prepare() {
        jdbc.update("DELETE FROM tasks");
        jdbc.update("DELETE FROM categories");
        jdbc.update("DELETE FROM users WHERE id = 2");
        jdbc.update("INSERT INTO users(id, name, points) VALUES (2, 'Second user', 0)");
        jdbc.update("INSERT INTO categories(id, user_id, name, name_key, icon, color) VALUES "
                + "(1001, 1, 'Zdrowie', 'zdrowie', 'HEART', 'GREEN'), "
                + "(1002, 1, 'Praca', 'praca', 'BRIEFCASE', 'BLUE'), "
                + "(2001, 2, 'Prywatna', 'prywatna', 'OTHER', 'RED')");
        when(currentUser.getUserId()).thenReturn(1L);
    }

    @Test
    void createsUpdatesPreservesAndClearsTaskCategory() throws Exception {
        String created = mvc.perform(post("/api/tasks").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Trening\",\"points\":10,\"categoryId\":1001}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category.id").value(1001))
                .andExpect(jsonPath("$.category.name").value("Zdrowie"))
                .andExpect(jsonPath("$.category.icon").value("HEART"))
                .andExpect(jsonPath("$.category.color").value("GREEN"))
                .andReturn().getResponse().getContentAsString();
        int taskId = com.jayway.jsonpath.JsonPath.read(created, "$.id");

        mvc.perform(patch("/api/tasks/{id}", taskId).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Praca nad raportem\",\"points\":10,\"categoryId\":1002}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category.id").value(1002))
                .andExpect(jsonPath("$.category.name").value("Praca"));
        mvc.perform(patch("/api/tasks/{id}", taskId).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Bez zmiany kategorii\",\"points\":10}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category.id").value(1002));
        mvc.perform(patch("/api/tasks/{id}", taskId).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Bez kategorii\",\"points\":10,\"clearCategory\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category").doesNotExist());
        assertNull(jdbc.queryForObject("SELECT category_id FROM tasks WHERE id = ?", Long.class, taskId));
    }

    @Test
    void rejectsAnotherUsersCategoryAtomically() throws Exception {
        mvc.perform(post("/api/tasks").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Nie zapisuj\",\"points\":10,\"categoryId\":2001}"))
                .andExpect(status().isNotFound());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM tasks", Integer.class));

        jdbc.update("INSERT INTO tasks(id, user_id, title, points, category_id) VALUES (1001, 1, 'Oryginał', 10, 1001)");
        mvc.perform(patch("/api/tasks/1001").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Nie zmieniaj\",\"points\":20,\"categoryId\":2001}"))
                .andExpect(status().isNotFound());
        assertEquals("Oryginał", jdbc.queryForObject("SELECT title FROM tasks WHERE id = 1001", String.class));
        assertEquals(1001L, jdbc.queryForObject("SELECT category_id FROM tasks WHERE id = 1001", Long.class));
    }

    @Test
    void deletingCategoryDetachesTaskWithoutDeletingIt() throws Exception {
        jdbc.update("INSERT INTO tasks(id, user_id, title, points, category_id) VALUES (1001, 1, 'Task', 10, 1001)");
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/api/categories/1001"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/tasks/1001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category").doesNotExist());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM tasks WHERE id = 1001", Integer.class));
    }

    @Test
    void rejectsInvalidCategoryIdentifier() throws Exception {
        mvc.perform(post("/api/tasks").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Task\",\"points\":10,\"categoryId\":0}"))
                .andExpect(status().isBadRequest());
    }
}
