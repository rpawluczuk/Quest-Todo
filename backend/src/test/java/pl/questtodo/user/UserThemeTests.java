package pl.questtodo.user;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.EntityManager;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:user_themes;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@Transactional
class UserThemeTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager entities;

    @BeforeEach
    void prepare() {
        jdbc.update("UPDATE users SET theme = 'PURPLE', points = 123 WHERE id = 1");
        jdbc.update("INSERT INTO users(id, name, points, theme) VALUES (999, 'Other', 42, 'PURPLE')");
    }

    @Test
    void savesOnlyAuthenticatedUsersThemeAndPreservesBalance() throws Exception {
        mvc.perform(get("/api/users/me").with(user("1")))
                .andExpect(jsonPath("$.theme").value("PURPLE"));
        mvc.perform(put("/api/users/me/theme").with(user("1")).with(csrf())
                        .param("userId", "999").header("X-User-Id", "999")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"theme\":\"PINK\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.theme").value("PINK"))
                .andExpect(jsonPath("$.points").value(123));
        entities.flush();
        entities.clear();
        mvc.perform(get("/api/users/me").with(user("1"))).andExpect(jsonPath("$.theme").value("PINK"));
        mvc.perform(get("/api/users/me").with(user("999")))
                .andExpect(jsonPath("$.theme").value("PURPLE"))
                .andExpect(jsonPath("$.points").value(42));
        mvc.perform(put("/api/users/me/theme").with(user("1")).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"theme\":\"PURPLE\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.theme").value("PURPLE"));
    }

    @Test
    void rejectsMissingAndUnsupportedThemes() throws Exception {
        for (String body : new String[]{"{}", "{\"theme\":null}", "{\"theme\":\"BLUE\"}"}) {
            mvc.perform(put("/api/users/me/theme").with(user("1")).with(csrf())
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        assertEquals("PURPLE", jdbc.queryForObject("SELECT theme FROM users WHERE id = 1", String.class));
    }

    @Test
    void requiresAuthenticationAndCsrf() throws Exception {
        mvc.perform(put("/api/users/me/theme").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"theme\":\"PINK\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(put("/api/users/me/theme").with(user("1"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"theme\":\"PINK\"}"))
                .andExpect(status().isForbidden());
        assertEquals("PURPLE", jdbc.queryForObject("SELECT theme FROM users WHERE id = 1", String.class));
    }
}
