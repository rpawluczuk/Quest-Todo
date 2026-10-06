package pl.questtodo.email;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import static org.junit.jupiter.api.Assertions.*;

class EmailMigrationTests {
    @Test
    void addsEmailTablesWithoutChangingExistingData() {
        String url = "jdbc:h2:mem:email_migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").target("8").load().migrate();
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(url, "sa", ""));
        jdbc.update("UPDATE users SET login='owner', password_hash='existing-hash', points=32 WHERE id=1");
        var users = jdbc.queryForList("SELECT * FROM users ORDER BY id");
        var tasks = jdbc.queryForList("SELECT * FROM tasks ORDER BY id");
        var rewards = jdbc.queryForList("SELECT * FROM rewards ORDER BY id");
        var purchases = jdbc.queryForList("SELECT * FROM purchases ORDER BY id");
        Flyway.configure().dataSource(url, "sa", "").target("9").load().migrate();
        assertEquals(users, jdbc.queryForList("SELECT * FROM users ORDER BY id"));
        assertEquals(tasks, jdbc.queryForList("SELECT * FROM tasks ORDER BY id"));
        assertEquals(rewards, jdbc.queryForList("SELECT * FROM rewards ORDER BY id"));
        assertEquals(purchases, jdbc.queryForList("SELECT * FROM purchases ORDER BY id"));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM account_email", Integer.class));
    }
}
