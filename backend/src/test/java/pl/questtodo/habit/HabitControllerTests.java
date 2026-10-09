package pl.questtodo.habit;

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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:habits;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
@Transactional
class HabitControllerTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean CurrentUserProvider currentUser;

    @BeforeEach
    void prepare() {
        jdbc.update("DELETE FROM habits");
        jdbc.update("DELETE FROM users WHERE id = 2");
        jdbc.update("INSERT INTO users(id, name, points) VALUES (2, 'Second user', 0)");
    }

    @Test
    void createsReadsUpdatesAndDeletesHabit() throws Exception {
        when(currentUser.getUserId()).thenReturn(1L);
        mvc.perform(post("/api/habits").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  Poranny spacer  \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Poranny spacer"));
        long id = jdbc.queryForObject("SELECT id FROM habits WHERE user_id = 1", Long.class);
        mvc.perform(get("/api/habits"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(id))
                .andExpect(jsonPath("$[0].name").value("Poranny spacer"));
        mvc.perform(put("/api/habits/{id}", id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  Czytanie  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Czytanie"));
        mvc.perform(delete("/api/habits/{id}", id)).andExpect(status().isNoContent());
        mvc.perform(get("/api/habits")).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void validatesNameWithoutSaving() throws Exception {
        when(currentUser.getUserId()).thenReturn(1L);
        for (String name : new String[]{"", "   ", "x".repeat(121)}) {
            mvc.perform(post("/api/habits").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"" + name + "\"}"))
                    .andExpect(status().isBadRequest());
        }
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM habits", Integer.class));
    }

    @Test
    void isolatesHabitsBetweenUsers() throws Exception {
        jdbc.update("INSERT INTO habits(id, user_id, name) VALUES (1001, 1, 'Owner habit'), (2001, 2, 'Other habit')");
        when(currentUser.getUserId()).thenReturn(1L);
        mvc.perform(get("/api/habits"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(1001));
        mvc.perform(put("/api/habits/2001").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Changed\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/habits/2001")).andExpect(status().isNotFound());
        assertEquals("Other habit", jdbc.queryForObject("SELECT name FROM habits WHERE id = 2001", String.class));
    }
}
