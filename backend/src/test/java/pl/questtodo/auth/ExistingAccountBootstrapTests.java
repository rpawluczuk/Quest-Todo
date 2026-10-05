package pl.questtodo.auth;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import pl.questtodo.user.UserRepository;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class ExistingAccountBootstrapTests {
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired JdbcTemplate jdbc;

    @Test
    void initializesOriginalAccountOnceAndPreservesItsData() {
        jdbc.update("UPDATE users SET login = NULL, password_hash = NULL, points = -7 WHERE id = 1");
        var tasksBefore = jdbc.queryForList("SELECT * FROM tasks ORDER BY id");
        var rewardsBefore = jdbc.queryForList("SELECT * FROM rewards ORDER BY id");
        var purchasesBefore = jdbc.queryForList("SELECT * FROM purchases ORDER BY id");
        new ExistingAccountBootstrap(users, passwords, " My.Login ", "Strong-first-password!").run(null);
        users.flush();
        var account = users.findById(1L).orElseThrow();
        assertEquals("my.login", account.getLogin());
        assertTrue(passwords.matches("Strong-first-password!", account.getPasswordHash()));
        String originalHash = account.getPasswordHash();
        new ExistingAccountBootstrap(users, passwords, "different", "Other-strong-password!").run(null);
        users.flush();
        assertEquals(originalHash, account.getPasswordHash());
        assertEquals("my.login", account.getLogin());
        assertEquals(-7, account.getPoints());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM users", Integer.class));
        assertEquals(tasksBefore, jdbc.queryForList("SELECT * FROM tasks ORDER BY id"));
        assertEquals(rewardsBefore, jdbc.queryForList("SELECT * FROM rewards ORDER BY id"));
        assertEquals(purchasesBefore, jdbc.queryForList("SELECT * FROM purchases ORDER BY id"));
    }

    @Test
    void noConfigurationDoesNotCreateDefaultCredentials() {
        new ExistingAccountBootstrap(users, passwords, "", "").run(null);
        assertNull(users.findById(1L).orElseThrow().getLogin());
    }

    @Test
    void acceptsEightCharacterPassword() {
        jdbc.update("UPDATE users SET login = NULL, password_hash = NULL WHERE id = 1");
        new ExistingAccountBootstrap(users, passwords, "owner", "12345678").run(null);
        users.flush();
        assertTrue(passwords.matches("12345678", users.findById(1L).orElseThrow().getPasswordHash()));
    }

    @Test
    void rejectsWeakOrIncompleteInitialCredentials() {
        assertThrows(IllegalStateException.class,
                () -> new ExistingAccountBootstrap(users, passwords, "owner", "1234567").run(null));
        assertThrows(IllegalStateException.class,
                () -> new ExistingAccountBootstrap(users, passwords, "", "Long-password-123!").run(null));
        assertThrows(IllegalStateException.class,
                () -> new ExistingAccountBootstrap(users, passwords, "owner", "a".repeat(73)).run(null));
        assertNull(users.findById(1L).orElseThrow().getLogin());
    }
}
