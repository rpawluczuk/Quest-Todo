package pl.questtodo.habit;

import java.sql.DriverManager;
import java.sql.SQLException;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class HabitEndingMigrationTests {
    @Test void addsAnOptionalConsistentManualEnding() throws Exception {
        String url = "jdbc:h2:mem:habit_ending_migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").target("28").load().migrate();
        try (var connection = DriverManager.getConnection(url, "sa", ""); var sql = connection.createStatement()) {
            sql.executeUpdate("INSERT INTO habits(id,user_id,name,created_on,start_date) VALUES "
                    + "(1001,1,'Existing','2026-10-14','2026-10-14'),"
                    + "(1002,1,'Missing reason','2026-10-14','2026-10-14'),"
                    + "(1003,1,'Invalid reason','2026-10-14','2026-10-14')");
        }
        Flyway.configure().dataSource(url, "sa", "").target("29").load().migrate();
        try (var connection = DriverManager.getConnection(url, "sa", ""); var sql = connection.createStatement()) {
            try (var result = sql.executeQuery("SELECT ended_on,end_reason FROM habits WHERE id = 1001")) {
                assertTrue(result.next());
                assertNull(result.getObject(1));
                assertNull(result.getObject(2));
            }
            sql.executeUpdate("UPDATE habits SET ended_on = '2026-10-14', end_reason = 'ACHIEVED' WHERE id = 1001");
            assertThrows(SQLException.class,
                    () -> sql.executeUpdate("UPDATE habits SET ended_on = '2026-10-14' WHERE id = 1002"));
            assertThrows(SQLException.class,
                    () -> sql.executeUpdate("UPDATE habits SET ended_on = '2026-10-14', end_reason = 'INVALID' WHERE id = 1003"));
        }
    }
}
