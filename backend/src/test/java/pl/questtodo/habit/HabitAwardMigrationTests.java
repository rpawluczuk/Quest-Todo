package pl.questtodo.habit;

import java.sql.DriverManager;
import java.sql.SQLException;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class HabitAwardMigrationTests {
    @Test void preservesExistingDataAndConstrainsAwards() throws Exception {
        String url = "jdbc:h2:mem:habit_award_migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").target("15").load().migrate();
        try (var c = DriverManager.getConnection(url, "sa", ""); var s = c.createStatement()) {
            s.executeUpdate("INSERT INTO users(id, name, points) VALUES (999, 'Existing user', 0)");
            s.executeUpdate("INSERT INTO habits(id, user_id, name, created_on) VALUES (1001, 999, 'Existing', '2026-10-01')");
            s.executeUpdate("INSERT INTO habit_completions(id, habit_id, completion_date) VALUES (1001, 1001, '2026-10-09')");
            Flyway.configure().dataSource(url, "sa", "").target("16").load().migrate();
            try (var r = s.executeQuery("SELECT h.reward_points, c.completion_date FROM habits h JOIN habit_completions c ON h.id = c.habit_id")) {
                assertTrue(r.next());
                assertEquals(0, r.getInt(1));
                assertEquals("2026-10-09", r.getString(2));
            }
            String insert = "INSERT INTO habit_weekly_awards(id, habit_id, week_start, points, completion_id, completion_date, undo_until) VALUES ('%s', 1001, '2026-10-05', 100, 1001, '2026-10-09', '2026-10-09T12:00:08Z')";
            s.executeUpdate(insert.formatted(java.util.UUID.randomUUID()));
            assertThrows(SQLException.class, () -> s.executeUpdate(insert.formatted(java.util.UUID.randomUUID())));
            assertThrows(SQLException.class, () -> s.executeUpdate("UPDATE habits SET reward_points = -1"));
            s.executeUpdate("DELETE FROM habit_completions");
            try (var r = s.executeQuery("SELECT count(*) FROM habit_weekly_awards")) {
                r.next(); assertEquals(1, r.getInt(1));
            }
            s.executeUpdate("DELETE FROM users WHERE id = 999");
            try (var r = s.executeQuery("SELECT count(*) FROM habit_weekly_awards")) {
                r.next(); assertEquals(0, r.getInt(1));
            }
        }
    }
}
