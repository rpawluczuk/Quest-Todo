package pl.questtodo.auth;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:authentication;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@Sql("/reset-tasks.sql")
class AuthenticationTests {
    private static final String PASSWORD = "Test-password-123!";
    private static final String HASH = new BCryptPasswordEncoder(4).encode(PASSWORD);
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void credentials() {
        jdbc.update("UPDATE users SET login = 'owner', password_hash = ?, points = 100 WHERE id = 1", HASH);
    }

    @AfterEach
    void removeSecondAccount() {
        jdbc.update("DELETE FROM purchases WHERE user_id = 2");
        jdbc.update("DELETE FROM tasks WHERE user_id = 2");
        jdbc.update("DELETE FROM rewards WHERE user_id = 2");
        jdbc.update("DELETE FROM users WHERE id = 2");
    }

    @Test
    void anonymousRequestsCannotReadOrChangePrivateData() throws Exception {
        for (String path : new String[]{"/api/users/me", "/api/tasks", "/api/rewards", "/api/rewards/purchases"}) {
            mvc.perform(get(path).header("X-User-Id", "1").param("userId", "1"))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/api/tasks").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Unauthorized\",\"points\":10}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/health")).andExpect(status().isOk());
    }

    @Test
    void loginKeepsExistingAccountAndRotatesSessionId() throws Exception {
        var before = token(null);
        String oldSessionId = before.session().getId();
        var result = mvc.perform(post("/api/auth/login").session(before.session())
                        .header("X-CSRF-TOKEN", before.value())
                        .param("username", " OWNER ").param("password", PASSWORD))
                .andExpect(status().isNoContent()).andReturn();
        var session = (MockHttpSession) result.getRequest().getSession(false);
        assertNotNull(session);
        assertNotEquals(oldSessionId, session.getId());
        mvc.perform(get("/api/users/me").session(session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.login").value("owner"))
                .andExpect(jsonPath("$.points").value(100))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
        mvc.perform(get("/api/tasks").session(session)).andExpect(jsonPath("$.length()").value(3));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM users", Integer.class));
    }

    @Test
    void wrongAndUnknownCredentialsHaveTheSameResponse() throws Exception {
        for (String username : new String[]{"owner", "unknown"}) {
            var csrf = token(null);
            mvc.perform(post("/api/auth/login").session(csrf.session())
                            .header("X-CSRF-TOKEN", csrf.value()).param("username", username)
                            .param("password", "incorrect-password"))
                    .andExpect(status().isUnauthorized()).andExpect(content().string(""));
            mvc.perform(get("/api/users/me").session(csrf.session())).andExpect(status().isUnauthorized());
        }
    }

    @Test
    void loginAndMutationsRequireValidCsrfAndLoginInvalidatesOldToken() throws Exception {
        mvc.perform(post("/api/auth/login").param("username", "owner").param("password", PASSWORD))
                .andExpect(status().isForbidden());
        var before = token(null);
        mvc.perform(post("/api/auth/login").session(before.session())
                        .header("X-CSRF-TOKEN", before.value()).param("username", "owner").param("password", PASSWORD))
                .andExpect(status().isNoContent());
        for (String staleToken : new String[]{"invalid", before.value()}) {
            mvc.perform(post("/api/tasks").session(before.session()).header("X-CSRF-TOKEN", staleToken)
                            .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Task\",\"points\":10}"))
                    .andExpect(status().isForbidden());
        }
        var fresh = token(before.session());
        mvc.perform(post("/api/tasks").session(fresh.session()).header("X-CSRF-TOKEN", fresh.value())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Task\",\"points\":10}"))
                .andExpect(status().isCreated());
    }

    @Test
    void logoutInvalidatesSessionAndRequiresCsrf() throws Exception {
        var session = login("owner");
        mvc.perform(post("/api/auth/logout").session(session)).andExpect(status().isForbidden());
        mvc.perform(get("/api/users/me").session(session)).andExpect(status().isOk());
        var csrf = token(session);
        mvc.perform(post("/api/auth/logout").session(session).header("X-CSRF-TOKEN", csrf.value()))
                .andExpect(status().isNoContent());
        assertTrue(session.isInvalid());
        mvc.perform(get("/api/users/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void separateAuthenticatedSessionsCannotAccessEachOthersData() throws Exception {
        jdbc.update("INSERT INTO users (id, name, points, login, password_hash) VALUES (2, 'Second', 50, 'second', ?)", HASH);
        jdbc.update("INSERT INTO tasks (id, title, points, user_id) VALUES (90001, 'Private second task', 10, 2)");
        jdbc.update("INSERT INTO rewards (id, title, cost, user_id) VALUES (90001, 'Private second reward', 20, 2)");
        var owner = login("owner");
        var second = login("second");
        mvc.perform(get("/api/users/me").session(second)).andExpect(jsonPath("$.id").value(2));
        mvc.perform(get("/api/tasks").session(second)).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(90001));
        mvc.perform(get("/api/rewards").session(second)).andExpect(jsonPath("$.length()").value(1));
        var secondCsrf = token(second);
        mvc.perform(delete("/api/tasks/1").session(second).header("X-CSRF-TOKEN", secondCsrf.value()))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/rewards/1/purchases").session(second).header("X-CSRF-TOKEN", secondCsrf.value()))
                .andExpect(status().isNotFound());
        var ownerCsrf = token(owner);
        mvc.perform(delete("/api/rewards/90001").session(owner).header("X-CSRF-TOKEN", ownerCsrf.value()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/users/me").session(owner).param("userId", "2"))
                .andExpect(jsonPath("$.id").value(1)).andExpect(jsonPath("$.points").value(100));
    }

    @Test
    void passwordChangeRevokesAllOwnerSessionsButKeepsOtherUsersAndData() throws Exception {
        jdbc.update("INSERT INTO users (id, name, points, login, password_hash) VALUES (2, 'Second', 50, 'second', ?)", HASH);
        var ownerBefore = jdbc.queryForMap("SELECT id, name, points, login FROM users WHERE id = 1");
        var tasksBefore = jdbc.queryForList("SELECT * FROM tasks ORDER BY id");
        var owner = login("owner");
        var otherDevice = login("owner");
        var second = login("second");
        mvc.perform(post("/api/auth/password").session(owner).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"new-pass-123\",\"confirmation\":\"new-pass-123\"}"))
                .andExpect(status().isNoContent());
        assertTrue(owner.isInvalid());
        mvc.perform(get("/api/users/me").session(otherDevice)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/users/me").session(second)).andExpect(status().isOk());
        mvc.perform(post("/api/auth/login").with(csrf()).param("username", "owner").param("password", PASSWORD))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").with(csrf()).param("username", "owner").param("password", "new-pass-123"))
                .andExpect(status().isNoContent());
        assertEquals(ownerBefore, jdbc.queryForMap("SELECT id, name, points, login FROM users WHERE id = 1"));
        assertEquals(tasksBefore, jdbc.queryForList("SELECT * FROM tasks ORDER BY id"));
    }

    @Test
    void rejectedPasswordChangesKeepPasswordAndSessions() throws Exception {
        var owner = login("owner");
        for (String body : new String[]{
                "{}",
                "{\"currentPassword\":\"wrong\",\"newPassword\":\"new-pass-123\",\"confirmation\":\"new-pass-123\"}",
                "{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"1234567\",\"confirmation\":\"1234567\"}",
                "{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"new-pass-123\",\"confirmation\":\"different\"}",
                "{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"" + PASSWORD + "\",\"confirmation\":\"" + PASSWORD + "\"}",
                "{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"" + "ą".repeat(37) + "\",\"confirmation\":\"" + "ą".repeat(37) + "\"}"
        }) {
            mvc.perform(post("/api/auth/password").session(owner).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        }
        assertEquals(HASH, jdbc.queryForObject("SELECT password_hash FROM users WHERE id = 1", String.class));
        mvc.perform(get("/api/users/me").session(owner)).andExpect(status().isOk());
    }

    @Test
    void passwordChangeRequiresAuthenticationAndCsrf() throws Exception {
        mvc.perform(post("/api/auth/password").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/password").session(login("owner"))
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
    }

    private MockHttpSession login(String username) throws Exception {
        var csrf = token(null);
        var result = mvc.perform(post("/api/auth/login").session(csrf.session())
                        .header("X-CSRF-TOKEN", csrf.value()).param("username", username).param("password", PASSWORD))
                .andExpect(status().isNoContent()).andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private Token token(MockHttpSession session) throws Exception {
        var request = get("/api/auth/csrf");
        if (session != null) request.session(session);
        var result = mvc.perform(request).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")))
                .andReturn();
        return new Token((MockHttpSession) result.getRequest().getSession(false),
                JsonPath.read(result.getResponse().getContentAsString(), "$.token"));
    }

    private record Token(MockHttpSession session, String value) {}
}
