package pl.questtodo.habit;

import java.sql.DriverManager;
import java.sql.SQLException;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class HabitScheduleMigrationTests {
    @Test void preservesExistingAndBackdatedHistoryAndConstrainsSchedule() throws Exception {
        String url = "jdbc:h2:mem:habit_schedule_migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").target("27").load().migrate();
        try (var connection = DriverManager.getConnection(url, "sa", ""); var sql = connection.createStatement()) {
            sql.executeUpdate("INSERT INTO habits(id,user_id,name,created_on) VALUES (1001,1,'Existing','2026-10-14'), (1002,1,'Backdated','2026-10-14')");
            sql.executeUpdate("INSERT INTO habit_completions(habit_id,completion_date) VALUES (1002,'2026-10-01')");
            Flyway.configure().dataSource(url, "sa", "").target("28").load().migrate();
            try (var result = sql.executeQuery("SELECT start_date,end_date,completion_limit FROM habits ORDER BY id")) {
                assertTrue(result.next());
                assertEquals("2026-10-14", result.getString(1));
                assertNull(result.getObject(2));
                assertNull(result.getObject(3));
                assertTrue(result.next());
                assertEquals("2026-10-01", result.getString(1));
            }
            assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE habits SET completion_limit = 0 WHERE id = 1001"));
            assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE habits SET end_date = '2026-10-01' WHERE id = 1001"));
            assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE habits SET end_date = '2026-11-01', completion_limit = 3 WHERE id = 1001"));
            try (var result = sql.executeQuery("SELECT count(*) FROM habit_completions WHERE habit_id = 1002")) {
                result.next();
                assertEquals(1, result.getInt(1));
            }
        }
    }
}
