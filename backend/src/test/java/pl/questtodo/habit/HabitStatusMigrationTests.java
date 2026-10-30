package pl.questtodo.habit;

import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.Instant;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class HabitStatusMigrationTests {
    @Test void migratesExistingHabitsWithoutInventingHistoryOrChangingRewards() throws Exception {
        String url = "jdbc:h2:mem:habit_status_migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").target("44").load().migrate();
        try (var connection = DriverManager.getConnection(url, "sa", ""); var sql = connection.createStatement()) {
            sql.executeUpdate("INSERT INTO habits(id,user_id,name,created_on,reward_points,completion_limit,completion_bonus_points) "
                    + "VALUES(1001,1,'Existing','2020-01-01',3,10,20)");
            sql.executeUpdate("INSERT INTO habit_completions(habit_id,completion_date) VALUES(1001,'2026-10-01')");
            sql.executeUpdate("INSERT INTO habit_completion_bonus_awards(habit_id,points,active,ever_granted) VALUES(1001,20,true,true)");
            sql.executeUpdate("UPDATE users SET points=20 WHERE id=1");
            Instant before = Instant.now().minusSeconds(1);
            Flyway.configure().dataSource(url, "sa", "").load().migrate();
            Instant after = Instant.now().plusSeconds(1);
            try (var rows = sql.executeQuery("SELECT h.activity_status,p.status,p.started_at,p.ended_at FROM habits h "
                    + "JOIN habit_status_periods p ON p.habit_id=h.id WHERE h.id=1001")) {
                assertTrue(rows.next());
                assertEquals("ACTIVE", rows.getString(1)); assertEquals("ACTIVE", rows.getString(2));
                var started = rows.getTimestamp(3).toInstant();
                assertFalse(started.isBefore(before)); assertFalse(started.isAfter(after));
                assertNull(rows.getObject(4)); assertFalse(rows.next());
            }
            try (var row = sql.executeQuery("SELECT points FROM users WHERE id=1")) { row.next(); assertEquals(20, row.getInt(1)); }
            try (var row = sql.executeQuery("SELECT COUNT(*) FROM habit_completions WHERE habit_id=1001")) { row.next(); assertEquals(1, row.getInt(1)); }
            try (var row = sql.executeQuery("SELECT active,points FROM habit_completion_bonus_awards WHERE habit_id=1001")) {
                row.next(); assertTrue(row.getBoolean(1)); assertEquals(20, row.getInt(2));
            }
            assertThrows(SQLException.class, () -> sql.executeUpdate("INSERT INTO habit_status_periods(habit_id,status,started_at,open_slot) "
                    + "VALUES(1001,'PAUSED',CURRENT_TIMESTAMP,1)"));
            assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE habit_status_periods SET ended_at=started_at-INTERVAL '1' SECOND,open_slot=NULL WHERE habit_id=1001"));
            assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE habit_status_periods SET open_slot=NULL WHERE habit_id=1001"));
            assertThrows(SQLException.class, () -> sql.executeUpdate("INSERT INTO habit_status_periods(habit_id,status,started_at,open_slot) "
                    + "VALUES(999999,'ACTIVE',CURRENT_TIMESTAMP,1)"));
            // Re-initializing Flyway leaves the persisted history intact (not a backend restart test).
            Flyway.configure().dataSource(url, "sa", "").load().migrate();
            try (var row = sql.executeQuery("SELECT COUNT(*) FROM habit_status_periods WHERE habit_id=1001")) { row.next(); assertEquals(1, row.getInt(1)); }
        }
    }
}
