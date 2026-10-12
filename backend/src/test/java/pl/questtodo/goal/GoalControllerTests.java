package pl.questtodo.goal;

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

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:goals;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
@Transactional
class GoalControllerTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean CurrentUserProvider currentUser;

    @BeforeEach
    void prepare() {
        jdbc.update("DELETE FROM goals");
        jdbc.update("DELETE FROM users WHERE id = 2");
        jdbc.update("INSERT INTO users(id, name, points) VALUES (2, 'Second user', 0)");
        when(currentUser.getUserId()).thenReturn(1L);
    }

    @Test
    void createsListsUpdatesAndDeletesOwnGoal() throws Exception {
        mvc.perform(post("/api/goals").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"  Przebiec 5 km  \"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.title").value("Przebiec 5 km"));
        long id = jdbc.queryForObject("SELECT id FROM goals WHERE user_id = 1", Long.class);
        mvc.perform(get("/api/goals"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(id));
        mvc.perform(get("/api/goals/{id}", id))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Przebiec 5 km"));
        mvc.perform(put("/api/goals/{id}", id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"  Nowy cel  \"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Nowy cel"));
        mvc.perform(delete("/api/goals/{id}", id)).andExpect(status().isNoContent());
        mvc.perform(get("/api/goals")).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void rejectsInvalidTitlesWithoutChangingData() throws Exception {
        for (String title : new String[]{"", "   ", "x".repeat(121)}) {
            mvc.perform(post("/api/goals").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"" + title + "\"}"))
                    .andExpect(status().isBadRequest());
        }
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM goals", Integer.class));
    }

    @Test
    void otherUsersGoalsAreInvisibleAndCannotBeModified() throws Exception {
        jdbc.update("INSERT INTO goals(id, user_id, title) VALUES (1001, 1, 'Own goal'), (2001, 2, 'Other goal')");
        mvc.perform(get("/api/goals"))
                .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].title").value("Own goal"));
        mvc.perform(get("/api/goals/2001")).andExpect(status().isNotFound());
        mvc.perform(put("/api/goals/2001").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Changed\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/goals/2001")).andExpect(status().isNotFound());
        assertEquals("Other goal", jdbc.queryForObject("SELECT title FROM goals WHERE id = 2001", String.class));
        when(currentUser.getUserId()).thenReturn(2L);
        mvc.perform(get("/api/goals"))
                .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].title").value("Other goal"));
    }
}
