package pl.questtodo.habit;

import java.sql.DriverManager;
import java.sql.SQLException;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class HabitNeutralSettlementMigrationTests {
    @Test void preservesPaidSnapshotAndAllowsOnlyUnpaidZeroWeekSettlement() throws Exception {
        String url = "jdbc:h2:mem:habit_neutral_settlement;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").target("44").load().migrate();
        try (var connection = DriverManager.getConnection(url, "sa", ""); var sql = connection.createStatement()) {
            sql.executeUpdate("INSERT INTO habits(id,user_id,name) VALUES(1001,1,'Paid'),(1002,1,'Neutral')");
            sql.executeUpdate("INSERT INTO habit_completion_bonus_awards(habit_id,points,active,ever_granted,settled_on,successful_weeks,total_weeks) "
                    + "VALUES(1001,20,true,true,'2026-10-01',8,10)");
            sql.executeUpdate("UPDATE users SET points=20 WHERE id=1");
            Flyway.configure().dataSource(url, "sa", "").target("45").load().migrate();
            Flyway.configure().dataSource(url, "sa", "").load().migrate();
            try (var row = sql.executeQuery("SELECT points,active,successful_weeks,total_weeks FROM habit_completion_bonus_awards WHERE habit_id=1001")) {
                assertTrue(row.next()); assertEquals(20, row.getInt(1)); assertTrue(row.getBoolean(2));
                assertEquals(8, row.getLong(3)); assertEquals(10, row.getLong(4));
            }
            try (var row = sql.executeQuery("SELECT points FROM users WHERE id=1")) { row.next(); assertEquals(20, row.getInt(1)); }
            sql.executeUpdate("INSERT INTO habit_completion_bonus_awards(habit_id,points,active,ever_granted,settled_on,successful_weeks,total_weeks) "
                    + "VALUES(1002,20,false,false,'2026-10-01',0,0)");
            assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE habit_completion_bonus_awards SET active=true WHERE habit_id=1002"));
            assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE habit_completion_bonus_awards SET total_weeks=-1 WHERE habit_id=1002"));
            assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE habit_completion_bonus_awards SET successful_weeks=1 WHERE habit_id=1002"));
        }
    }
}
