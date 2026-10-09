package pl.questtodo.user;

import java.util.List;
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
import pl.questtodo.auth.ExistingAccountBootstrap;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:accountdelete;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "app.mail.notification-delay=3600000"})
@AutoConfigureMockMvc
class AccountDeletionTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    @Autowired AccountDeletionService deletion;
    @Autowired UserRepository users;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    static final List<String> OWNED = List.of("purchases", "tasks", "rewards", "habits", "account_email", "password_reset", "email_send_event", "email_notification");
    static final String BODY = "{\"password\":\"password123\",\"loginConfirmation\":\"owner\",\"irreversibleConfirmation\":true}";

    @BeforeEach void setup() {
        for (var table : OWNED) jdbc.update("DELETE FROM " + table);
        jdbc.update("DELETE FROM users");
        for (int id = 1; id <= 2; id++) {
            jdbc.update("INSERT INTO users(id, name, login, password_hash, points) VALUES (?, ?, ?, ?, 100)",
                    id, "Name", id == 1 ? "owner" : "second", passwords.encode("password123"));
            jdbc.update("INSERT INTO tasks(id, title, points, user_id) VALUES (?, 'Task', 10, ?)", id, id);
            jdbc.update("INSERT INTO rewards(id, title, cost, user_id, deleted) VALUES (?, 'Reward', 20, ?, TRUE)", id, id);
            jdbc.update("INSERT INTO habits(id, name, user_id) VALUES (?, 'Habit', ?)", id, id);
            jdbc.update("INSERT INTO habit_targets(habit_id, target_days, effective_from) SELECT id, 7, created_on FROM habits WHERE id = ?", id);
            jdbc.update("INSERT INTO habit_completions(habit_id, completion_date) SELECT id, created_on FROM habits WHERE id = ?", id);
            jdbc.update("INSERT INTO purchases(id, title, cost, reward_id, user_id) VALUES (?, 'Reward', 20, ?, ?)", id, id, id);
            jdbc.update("INSERT INTO account_email(user_id, verified_email, pending_email, token_hash) VALUES (?, ?, ?, ?)",
                    id, "user" + id + "@example.com", "pending" + id + "@example.com", "verify" + id);
            jdbc.update("INSERT INTO password_reset(user_id, token_hash, email, password_hash, expires_at) VALUES (?, ?, ?, 'hash', CURRENT_TIMESTAMP)",
                    id, "reset" + id, "user" + id + "@example.com");
            jdbc.update("INSERT INTO email_send_event(user_id, recipient_hash, sent_at) VALUES (?, 'hash', CURRENT_TIMESTAMP)", id);
            jdbc.update("INSERT INTO email_notification(id, recipient, created_at, next_attempt_at, user_id) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)",
                    "notice" + id, "old" + id + "@example.com", java.sql.Timestamp.valueOf("2099-01-01 00:00:00"), id);
        }
    }
    MockHttpSession login(String login) throws Exception {
        return (MockHttpSession) mvc.perform(post("/api/auth/login").with(csrf())
                .param("username", login).param("password", "password123")).andExpect(status().isNoContent())
                .andReturn().getRequest().getSession(false);
    }
    @Test void requiresSessionCsrfPasswordAndExplicitConfirmations() throws Exception {
        mvc.perform(delete("/api/users/me").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized());
        var session = login("owner");
        mvc.perform(delete("/api/users/me").session(session).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isForbidden());
        for (var body : List.of(BODY.replace("password123", "wrong"), BODY.replace("owner", "second"),
                BODY.replace("true", "false"), "{}", BODY.replace("password123", "a".repeat(73)))) {
            mvc.perform(delete("/api/users/me").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM users", Integer.class));
        for (var table : OWNED) assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class), table);
        mvc.perform(get("/api/users/me").session(session)).andExpect(status().isOk());
    }
    @Test void deletesOnlyOwnDataAndRevokesAllOwnSessions() throws Exception {
        var session = login("owner");
        var otherDevice = login("owner");
        var second = login("second");
        var otherBefore = jdbc.queryForMap("SELECT * FROM users WHERE id = 2");
        var snapshots = OWNED.stream().map(table -> jdbc.queryForList("SELECT * FROM " + table + " WHERE user_id = 2")).toList();
        mvc.perform(delete("/api/users/me").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(BODY.substring(0, BODY.length() - 1) + ",\"userId\":2}")).andExpect(status().isNoContent());
        assertTrue(session.isInvalid());
        mvc.perform(get("/api/users/me").session(otherDevice)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/users/me").session(second)).andExpect(status().isOk());
        for (int i = 0; i < OWNED.size(); i++) {
            var table = OWNED.get(i);
            assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM " + table + " WHERE user_id = 1", Integer.class), table);
            assertEquals(snapshots.get(i), jdbc.queryForList("SELECT * FROM " + table + " WHERE user_id = 2"), table);
        }
        assertEquals(otherBefore, jdbc.queryForMap("SELECT * FROM users WHERE id = 2"));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM habit_targets WHERE habit_id = 1", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM habit_targets WHERE habit_id = 2", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM habit_completions WHERE habit_id = 1", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM habit_completions WHERE habit_id = 2", Integer.class));
        mvc.perform(post("/api/auth/login").with(csrf()).param("username", "owner").param("password", "password123"))
                .andExpect(status().isUnauthorized());
        assertDoesNotThrow(() -> new org.springframework.transaction.support.TransactionTemplate(transactions)
                .executeWithoutResult(status -> new ExistingAccountBootstrap(users, passwords, "owner", "password123").run(null)));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM users WHERE id = 1", Integer.class));
    }
    @Test void transactionRollsBackIfAReferencedRewardCannotBeDeleted() {
        // Simulate legacy inconsistent ownership: never delete another account's purchase to force deletion through.
        jdbc.update("UPDATE purchases SET reward_id = 1 WHERE user_id = 2");
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> deletion.delete(1, "password123", "owner", true));
        for (var table : OWNED) assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class), table);
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM users", Integer.class));
    }
}
