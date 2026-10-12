package pl.questtodo.user;

import java.sql.DriverManager;
import java.sql.SQLException;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class UserThemeMigrationTests {
    @Test
    void preservesExistingAccountsAndDefaultsNewAccountsToPurple() throws Exception {
        String url = "jdbc:h2:mem:user_theme_migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").target("16").load().migrate();
        try (var connection = DriverManager.getConnection(url, "sa", "");
             var sql = connection.createStatement()) {
            sql.executeUpdate("INSERT INTO users(id, name, login, password_hash, points) VALUES (999, 'Owner', 'owner', 'existing-hash', 123)");
            Flyway.configure().dataSource(url, "sa", "").target("17").load().migrate();
            try (var result = sql.executeQuery("SELECT name, login, password_hash, points, theme FROM users WHERE id = 999")) {
                assertTrue(result.next());
                assertEquals("Owner", result.getString("name"));
                assertEquals("owner", result.getString("login"));
                assertEquals("existing-hash", result.getString("password_hash"));
                assertEquals(123, result.getLong("points"));
                assertEquals("PURPLE", result.getString("theme"));
            }
            sql.executeUpdate("INSERT INTO users(id, name, points) VALUES (1000, 'New user', 0)");
            try (var result = sql.executeQuery("SELECT theme FROM users WHERE id = 1000")) {
                assertTrue(result.next());
                assertEquals("PURPLE", result.getString(1));
            }
            assertEquals(1, sql.executeUpdate("UPDATE users SET theme = 'PINK' WHERE id = 999"));
            assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE users SET theme = 'BLUE' WHERE id = 999"));
            assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE users SET theme = NULL WHERE id = 999"));
        }
    }

    @Test
    void registrationInitializesPurpleThemeBeforePersistence() {
        assertEquals(UserTheme.PURPLE, UserEntity.registered("new-user", "hash").getTheme());
    }
}
