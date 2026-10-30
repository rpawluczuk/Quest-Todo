package pl.questtodo.habit;

import java.time.LocalDate;
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
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:habit_categories;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
@Transactional
class HabitCategoryControllerTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean CurrentUserProvider currentUser;
    @MockitoBean HabitCalendar calendar;

    @BeforeEach
    void prepare() {
        when(currentUser.getUserId()).thenReturn(1L);
        when(calendar.today()).thenReturn(LocalDate.of(2026, 10, 15));
        when(calendar.now()).thenReturn(java.time.Instant.parse("2026-10-15T12:00:00Z"));
        jdbc.update("DELETE FROM habits");
        jdbc.update("DELETE FROM categories");
        jdbc.update("DELETE FROM users WHERE id = 2");
        jdbc.update("INSERT INTO users(id, name, points) VALUES (2, 'Second user', 0)");
        jdbc.update("INSERT INTO categories(id, user_id, name, name_key, icon, color) VALUES "
                + "(1001, 1, 'Zdrowie', 'zdrowie', 'HEART', 'GREEN'), "
                + "(1002, 1, 'Rozwój', 'rozwój', 'BOOK', 'INDIGO'), "
                + "(2001, 2, 'Prywatna', 'prywatna', 'OTHER', 'RED')");
    }

    @Test
    void createsUpdatesAndClearsHabitCategory() throws Exception {
        String created = mvc.perform(post("/api/habits").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Spacer\",\"categoryId\":1001}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category.id").value(1001))
                .andExpect(jsonPath("$.category.name").value("Zdrowie"))
                .andExpect(jsonPath("$.category.icon").value("HEART"))
                .andReturn().getResponse().getContentAsString();
        int id = com.jayway.jsonpath.JsonPath.read(created, "$.id");
        assertEquals(1001L, jdbc.queryForObject("SELECT category_id FROM habits WHERE id = ?", Long.class, id));

        mvc.perform(put("/api/habits/{id}/configuration", id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Spacer\",\"categoryId\":1002}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.habit.category.id").value(1002))
                .andExpect(jsonPath("$.habit.category.color").value("INDIGO"));

        mvc.perform(put("/api/habits/{id}/configuration", id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Spacer\",\"categoryId\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.habit.category").doesNotExist());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM habits WHERE id = ? AND category_id IS NOT NULL",
                Integer.class, id));
    }

    @Test
    void rejectsAnotherUsersCategoryWithoutChangingHabit() throws Exception {
        mvc.perform(post("/api/habits").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Nie zapisuj\",\"categoryId\":2001}"))
                .andExpect(status().isNotFound());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM habits", Integer.class));

        mvc.perform(post("/api/habits").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Oryginał\",\"categoryId\":1001}"))
                .andExpect(status().isCreated());
        long id = jdbc.queryForObject("SELECT id FROM habits", Long.class);
        mvc.perform(put("/api/habits/{id}/configuration", id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Nie zmieniaj\",\"categoryId\":2001}"))
                .andExpect(status().isNotFound());
        assertEquals("Oryginał", jdbc.queryForObject("SELECT name FROM habits WHERE id = ?", String.class, id));
        assertEquals(1001L, jdbc.queryForObject("SELECT category_id FROM habits WHERE id = ?", Long.class, id));
    }

    @Test
    void deletingCategoryDetachesItWithoutDeletingHabit() throws Exception {
        jdbc.update("INSERT INTO habits(id, user_id, name, category_id) VALUES (3001, 1, 'Spacer', 1001)");

        mvc.perform(delete("/api/categories/1001")).andExpect(status().isNoContent());
        mvc.perform(get("/api/habits").param("date", "2026-10-15"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].category").doesNotExist());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM habits WHERE id = 3001", Integer.class));
        assertEquals(0, jdbc.queryForObject(
                "SELECT count(*) FROM habits WHERE id = 3001 AND category_id IS NOT NULL", Integer.class));
    }

    @Test
    void validatesCategoryIdentifier() throws Exception {
        mvc.perform(post("/api/habits").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Spacer\",\"categoryId\":0}"))
                .andExpect(status().isBadRequest());
    }
}
