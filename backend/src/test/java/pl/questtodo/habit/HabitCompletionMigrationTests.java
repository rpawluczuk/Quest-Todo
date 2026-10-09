package pl.questtodo.habit;

import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.ZoneId;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class HabitCompletionMigrationTests {
    @Test
    void preservesExistingHabitsAndBackfillsStartDateAndEnforcesUniqueCompletions() throws Exception {
        String url = "jdbc:h2:mem:habit_migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").target("12").load().migrate();
        try (var connection = DriverManager.getConnection(url, "sa", ""); var sql = connection.createStatement()) {
            sql.executeUpdate("INSERT INTO habits(id, user_id, name) VALUES (1001, 1, 'Existing')");
            LocalDate before = LocalDate.now(ZoneId.of("Europe/Warsaw"));
            Flyway.configure().dataSource(url, "sa", "").target("13").load().migrate();
            LocalDate after = LocalDate.now(ZoneId.of("Europe/Warsaw"));
            try (var result = sql.executeQuery("SELECT * FROM habits WHERE id = 1001")) {
                assertTrue(result.next());
                assertEquals("Existing", result.getString("name"));
                assertEquals(1, result.getLong("user_id"));
                LocalDate created = result.getObject("created_on", LocalDate.class);
                assertTrue(created.equals(before) || created.equals(after));
            }
            sql.executeUpdate("INSERT INTO habit_completions(habit_id, completion_date) VALUES (1001, '2026-10-09')");
            assertThrows(SQLException.class, () -> sql.executeUpdate(
                    "INSERT INTO habit_completions(habit_id, completion_date) VALUES (1001, '2026-10-09')"));
            sql.executeUpdate("DELETE FROM habits WHERE id = 1001");
            try (var result = sql.executeQuery("SELECT count(*) FROM habit_completions")) {
                assertTrue(result.next());
                assertEquals(0, result.getInt(1));
            }
        }
    }
}
