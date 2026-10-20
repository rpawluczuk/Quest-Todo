package pl.questtodo.habit;

import java.sql.DriverManager;
import java.sql.SQLException;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class HabitDatedBonusMigrationTests {
    @Test
    void preservesExistingCountAwardAndValidatesSettlementSnapshot() throws Exception {
        String url = "jdbc:h2:mem:habit_dated_bonus_migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").target("39").load().migrate();
        try (var connection = DriverManager.getConnection(url, "sa", "");
             var sql = connection.createStatement()) {
            sql.executeUpdate("INSERT INTO habits(id,user_id,name,created_on,completion_limit,completion_bonus_points) "
                    + "VALUES(1001,1,'Existing','2026-10-01',10,20)");
            sql.executeUpdate("INSERT INTO habit_completion_bonus_awards(habit_id,points,active) VALUES(1001,20,true)");
            Flyway.configure().dataSource(url, "sa", "").target("40").load().migrate();
            try (var row = sql.executeQuery("SELECT active,points,settled_on,successful_weeks,total_weeks "
                    + "FROM habit_completion_bonus_awards WHERE habit_id=1001")) {
                assertTrue(row.next());
                assertTrue(row.getBoolean(1));
                assertEquals(20, row.getInt(2));
                assertNull(row.getObject(3));
                assertNull(row.getObject(4));
                assertNull(row.getObject(5));
            }
            assertThrows(SQLException.class, () -> sql.executeUpdate(
                    "UPDATE habit_completion_bonus_awards SET settled_on='2026-10-20' WHERE habit_id=1001"));
            sql.executeUpdate("UPDATE habit_completion_bonus_awards SET settled_on='2026-10-20',"
                    + "successful_weeks=8,total_weeks=10 WHERE habit_id=1001");
        }
    }
}
