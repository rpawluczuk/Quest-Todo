package pl.questtodo.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:registration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
class RegistrationTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;

    @BeforeEach
    void reset() {
        jdbc.update("DELETE FROM users WHERE id <> 1");
    }

    @Test
    void registeredAccountCanLogInAndStartsEmptyWithoutChangingOwner() throws Exception {
        var owner = jdbc.queryForMap("SELECT * FROM users WHERE id = 1");
        register(" New.User ", "12345678").andExpect(status().isCreated());
        var account = jdbc.queryForMap("SELECT * FROM users WHERE login = 'new.user'");
        assertTrue(passwords.matches("12345678", (String) account.get("password_hash")));
        var result = mvc.perform(post("/api/auth/login").with(csrf())
                        .param("username", "NEW.USER").param("password", "12345678"))
                .andExpect(status().isNoContent()).andReturn();
        var session = (MockHttpSession) result.getRequest().getSession(false);
        mvc.perform(get("/api/users/me").session(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("new.user"))
                .andExpect(jsonPath("$.points").value(0))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
        for (String path : new String[]{"/api/tasks", "/api/rewards", "/api/rewards/purchases"}) {
            mvc.perform(get(path).session(session)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(0));
        }
        mvc.perform(delete("/api/tasks/1").session(session).with(csrf())).andExpect(status().isNotFound());
        assertEquals(owner, jdbc.queryForMap("SELECT * FROM users WHERE id = 1"));
    }

    @Test
    void duplicateLoginIsCaseInsensitiveAndDoesNotReplacePassword() throws Exception {
        register("someone", "12345678").andExpect(status().isCreated());
        register(" SOMEONE ", "different-password").andExpect(status().isConflict());
        assertTrue(passwords.matches("12345678", jdbc.queryForObject(
                "SELECT password_hash FROM users WHERE login = 'someone'", String.class)));
    }

    @Test
    void invalidInputsCreateNoAccounts() throws Exception {
        for (String login : new String[]{"ab", "_invalid", "has space", "a".repeat(65)}) {
            register(login, "12345678").andExpect(status().isBadRequest());
        }
        register("valid", "1234567").andExpect(status().isBadRequest());
        register("valid", "ą".repeat(37)).andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{}" )).andExpect(status().isBadRequest());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM users", Integer.class));
    }

    @Test
    void registrationRequiresCsrfAndDoesNotAuthenticateSession() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"login\":\"valid\",\"password\":\"12345678\"}"))
                .andExpect(status().isForbidden());
        var session = new MockHttpSession();
        mvc.perform(post("/api/auth/register").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"login\":\"valid\",\"password\":\"12345678\"}"))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/users/me").session(session)).andExpect(status().isUnauthorized());
    }

    private org.springframework.test.web.servlet.ResultActions register(String login, String password) throws Exception {
        return mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"login\":\"" + login + "\",\"password\":\"" + password + "\"}"));
    }
}
