package pl.questtodo.habit;

import java.sql.DriverManager;
import java.sql.SQLException;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class HabitCompletionBonusMigrationTests {
    @Test
    void existingHabitsStayWithoutBonusAndDatabaseRejectsInvalidConfigurations() throws Exception {
        String url = "jdbc:h2:mem:habit_completion_bonus_migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").target("37").load().migrate();
        try (var connection = DriverManager.getConnection(url, "sa", ""); var sql = connection.createStatement()) {
            sql.executeUpdate("INSERT INTO habits(id,user_id,name,created_on,start_date) VALUES (1001,1,'Existing','2026-10-09','2026-10-09')");
            Flyway.configure().dataSource(url, "sa", "").target("38").load().migrate();
            try (var result = sql.executeQuery("SELECT completion_bonus_points,required_success_percent FROM habits WHERE id = 1001")) {
                assertTrue(result.next());
                assertNull(result.getObject(1));
                assertNull(result.getObject(2));
            }
            assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE habits SET completion_bonus_points = 10 WHERE id = 1001"));
            assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE habits SET end_date = '2026-11-09', completion_bonus_points = 10 WHERE id = 1001"));
            assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE habits SET end_date = '2026-11-09', required_success_percent = 101 WHERE id = 1001"));
            sql.executeUpdate("UPDATE habits SET completion_limit = 4, completion_bonus_points = 10 WHERE id = 1001");
            sql.executeUpdate("UPDATE habits SET completion_limit = NULL, end_date = '2026-11-09', required_success_percent = 75 WHERE id = 1001");
        }
    }
}
