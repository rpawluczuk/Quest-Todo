package pl.questtodo.habit;

import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.ZoneId;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class HabitTargetMigrationTests {
    @Test
    void alignsCurrentAndPendingTargetsWithoutRewritingEarlierWeeks() throws Exception {
        String url = "jdbc:h2:mem:habit_week_migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").target("14").load().migrate();
        LocalDate monday = LocalDate.now(ZoneId.of("Europe/Warsaw"))
                .with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
        try (var connection = DriverManager.getConnection(url, "sa", ""); var sql = connection.createStatement()) {
            sql.executeUpdate("INSERT INTO habits(id, user_id, name, created_on) VALUES (1001, 1, 'Existing', '2026-01-01'), (1002, 1, 'New', '2026-01-01')");
            sql.executeUpdate("INSERT INTO habit_targets(habit_id, target_days, effective_from) VALUES "
                    + "(1001, 7, '" + monday.minusWeeks(1) + "'), (1001, 5, '" + monday + "'), "
                    + "(1001, 3, '" + monday.plusWeeks(1) + "'), (1002, 2, '" + monday.plusDays(4) + "')");
            Flyway.configure().dataSource(url, "sa", "").load().migrate();
            try (var result = sql.executeQuery("SELECT habit_id, target_days, effective_from FROM habit_targets ORDER BY habit_id, effective_from")) {
                assertTrue(result.next());
                assertEquals(7, result.getInt("target_days"));
                assertEquals(monday.minusWeeks(1), result.getObject("effective_from", LocalDate.class));
                assertTrue(result.next());
                assertEquals(3, result.getInt("target_days"));
                assertEquals(monday, result.getObject("effective_from", LocalDate.class));
                assertTrue(result.next());
                assertEquals(1002, result.getLong("habit_id"));
                assertEquals(2, result.getInt("target_days"));
                assertEquals(monday, result.getObject("effective_from", LocalDate.class));
                assertFalse(result.next());
            }
        }
    }

    @Test
    void backfillsDailyTargetsWithoutChangingHabitsOrCompletions() throws Exception {
        String url = "jdbc:h2:mem:habit_target_migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").target("13").load().migrate();
        try (var connection = DriverManager.getConnection(url, "sa", ""); var sql = connection.createStatement()) {
            sql.executeUpdate("INSERT INTO habits(id, user_id, name, created_on) VALUES (1001, 1, 'Existing', '2026-01-01')");
            sql.executeUpdate("INSERT INTO habit_completions(habit_id, completion_date) VALUES (1001, '2026-01-01')");
            LocalDate before = LocalDate.now(ZoneId.of("Europe/Warsaw"));
            Flyway.configure().dataSource(url, "sa", "").target("14").load().migrate();
            LocalDate after = LocalDate.now(ZoneId.of("Europe/Warsaw"));
            try (var result = sql.executeQuery("SELECT h.name, h.created_on, t.target_days, t.effective_from FROM habits h JOIN habit_targets t ON t.habit_id = h.id WHERE h.id = 1001")) {
                assertTrue(result.next());
                assertEquals("Existing", result.getString("name"));
                assertEquals(LocalDate.of(2026, 1, 1), result.getObject("created_on", LocalDate.class));
                assertEquals(7, result.getInt("target_days"));
                var date = result.getObject("effective_from", LocalDate.class);
                assertTrue(date.equals(before) || date.equals(after));
                assertFalse(result.next());
            }
            try (var result = sql.executeQuery("SELECT count(*) FROM habit_completions WHERE habit_id = 1001")) {
                result.next();
                assertEquals(1, result.getInt(1));
            }
            assertThrows(SQLException.class, () -> sql.executeUpdate("INSERT INTO habit_targets(habit_id, target_days, effective_from) VALUES (1001, 8, '2027-01-01')"));
            assertThrows(SQLException.class, () -> sql.executeUpdate("INSERT INTO habit_targets(habit_id, target_days, effective_from) SELECT habit_id, 2, effective_from FROM habit_targets"));
            sql.executeUpdate("DELETE FROM habits WHERE id = 1001");
            try (var result = sql.executeQuery("SELECT count(*) FROM habit_targets")) {
                result.next();
                assertEquals(0, result.getInt(1));
            }
        }
    }
}
