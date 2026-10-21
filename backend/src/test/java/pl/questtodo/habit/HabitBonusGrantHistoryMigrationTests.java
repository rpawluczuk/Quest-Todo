package pl.questtodo.habit;

import java.sql.DriverManager;
import java.sql.SQLException;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class HabitBonusGrantHistoryMigrationTests {
    @Test
    void preservesBalancesAndMarksAmbiguousInactiveHistoryAsUnknown() throws Exception {
        String url = "jdbc:h2:mem:habit_bonus_history_migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").target("40").load().migrate();
        try (var connection = DriverManager.getConnection(url, "sa", ""); var sql = connection.createStatement()) {
            sql.executeUpdate("UPDATE users SET points=123 WHERE id=1");
            sql.executeUpdate("INSERT INTO habits(id,user_id,name,created_on,completion_limit,completion_bonus_points) "
                    + "VALUES(1001,1,'Paid','2026-10-01',10,20),(1002,1,'Unknown count','2026-10-01',10,20)");
            sql.executeUpdate("INSERT INTO habits(id,user_id,name,created_on,end_date,completion_bonus_points,required_success_percent) "
                    + "VALUES(1003,1,'Unknown dated','2026-10-01','2026-10-10',20,80)");
            sql.executeUpdate("INSERT INTO habit_completion_bonus_awards(habit_id,points,active) VALUES(1001,20,true),(1002,20,false)");
            sql.executeUpdate("INSERT INTO habit_completion_bonus_awards(habit_id,points,active,settled_on,successful_weeks,total_weeks) "
                    + "VALUES(1003,20,false,'2026-10-11',1,2)");
            Flyway.configure().dataSource(url, "sa", "").target("41").load().migrate();
            try (var rows = sql.executeQuery("SELECT habit_id,ever_granted,active,points FROM habit_completion_bonus_awards ORDER BY habit_id")) {
                assertTrue(rows.next());
                assertEquals(Boolean.TRUE, rows.getObject("ever_granted"));
                assertTrue(rows.getBoolean("active"));
                assertEquals(20, rows.getInt("points"));
                for (int i=0;i<2;i++) {
                    assertTrue(rows.next());
                    assertNull(rows.getObject("ever_granted"));
                    assertFalse(rows.getBoolean("active"));
                    assertEquals(20, rows.getInt("points"));
                }
            }
            try (var row = sql.executeQuery("SELECT points FROM users WHERE id=1")) {
                assertTrue(row.next()); assertEquals(123, row.getLong(1));
            }
            assertThrows(SQLException.class, () -> sql.executeUpdate(
                    "UPDATE habit_completion_bonus_awards SET ever_granted=false WHERE habit_id=1001"));
        }
    }
}
