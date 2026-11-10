package pl.questtodo.habit;

import java.sql.DriverManager;
import java.sql.SQLException;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class HabitEntryMigrationTests {
    @Test void addsJournalWithoutChangingExistingHabitsOrLinksAndEnforcesForeignKeyCascade() throws Exception {
        String url = "jdbc:h2:mem:habit_entries_migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
        try (var connection = DriverManager.getConnection(url, "sa", ""); var sql = connection.createStatement()) {
            // H2 caches the CHECK-IN comparator's creating session. Keep that session alive
            // throughout migration assertions instead of closing Flyway's standalone connection.
            var dataSource = new org.springframework.jdbc.datasource.SingleConnectionDataSource(connection, true);
            Flyway.configure().dataSource(dataSource).target("47").load().migrate();
            sql.executeUpdate("INSERT INTO habits(id,user_id,name) VALUES(1001,1,'Existing')");
            sql.executeUpdate("INSERT INTO habit_completions(habit_id,completion_date) VALUES(1001,CURRENT_DATE)");
            sql.executeUpdate("UPDATE users SET points=37 WHERE id=1");
            Flyway.configure().dataSource(dataSource).load().migrate();
            try (var row = sql.executeQuery("SELECT name FROM habits WHERE id=1001")) {
                assertTrue(row.next()); assertEquals("Existing", row.getString(1));

            }
            try (var row = sql.executeQuery("SELECT count(*) FROM habit_entries")) { row.next(); assertEquals(0, row.getInt(1)); }
            try (var row = sql.executeQuery("SELECT count(*) FROM habit_completions WHERE habit_id=1001")) { row.next(); assertEquals(1, row.getInt(1)); }
            try (var row = sql.executeQuery("SELECT points FROM users WHERE id=1")) { row.next(); assertEquals(37, row.getInt(1)); }
            String insert = "INSERT INTO habit_entries(habit_id,type,content,created_at,updated_at) VALUES";
            assertThrows(SQLException.class, () -> sql.executeUpdate(insert + "(9999,'NOTE','Orphan',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"));
            assertThrows(SQLException.class, () -> sql.executeUpdate(insert + "(1001,'INVALID','Content',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"));
            assertThrows(SQLException.class, () -> sql.executeUpdate(insert + "(1001,'NOTE',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"));
            assertThrows(SQLException.class, () -> sql.executeUpdate(insert + "(1001,'NOTE','',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"));
            assertThrows(SQLException.class, () -> sql.executeUpdate(insert + "(1001,'NOTE','Content',NULL,CURRENT_TIMESTAMP)"));
            assertThrows(SQLException.class, () -> sql.executeUpdate(insert + "(1001,'NOTE','Content',CURRENT_TIMESTAMP,NULL)"));
            sql.executeUpdate(insert + "(1001,'NOTE','Content',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
            Flyway.configure().dataSource(dataSource).load().migrate();
            try (var row = sql.executeQuery("SELECT count(*) FROM habit_entries")) { row.next(); assertEquals(1, row.getInt(1)); }
            sql.executeUpdate("DELETE FROM habits WHERE id=1001");
            try (var row = sql.executeQuery("SELECT count(*) FROM habit_entries")) { row.next(); assertEquals(0, row.getInt(1)); }
        }
    }
}
