package pl.questtodo.goal;

import java.sql.DriverManager;
import java.sql.SQLException;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class GoalEntryMigrationTests {
    @Test void addsJournalWithoutChangingExistingGoalsOrLinksAndEnforcesForeignKeyCascade() throws Exception {
        String url = "jdbc:h2:mem:goal_entries_migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").target("46").load().migrate();
        try (var connection = DriverManager.getConnection(url, "sa", ""); var sql = connection.createStatement()) {
            // H2 caches the CHECK-IN comparator's creating session. Keep that session alive
            // throughout migration assertions instead of closing Flyway's standalone connection.
            var dataSource = new org.springframework.jdbc.datasource.SingleConnectionDataSource(connection, true);
            sql.executeUpdate("INSERT INTO goals(id,user_id,title,current_state,desired_outcome) VALUES(1001,1,'Existing','Before','After')");
            sql.executeUpdate("INSERT INTO milestones(goal_id,title,position) VALUES(1001,'Existing milestone',0)");
            sql.executeUpdate("UPDATE users SET points=37 WHERE id=1");
            Flyway.configure().dataSource(dataSource).load().migrate();
            try (var row = sql.executeQuery("SELECT title,current_state,desired_outcome,completed FROM goals WHERE id=1001")) {
                assertTrue(row.next()); assertEquals("Existing", row.getString(1));
                assertEquals("Before", row.getString(2)); assertEquals("After", row.getString(3)); assertFalse(row.getBoolean(4));
            }
            try (var row = sql.executeQuery("SELECT count(*) FROM goal_entries")) { row.next(); assertEquals(0, row.getInt(1)); }
            try (var row = sql.executeQuery("SELECT count(*) FROM milestones WHERE goal_id=1001")) { row.next(); assertEquals(1, row.getInt(1)); }
            try (var row = sql.executeQuery("SELECT points FROM users WHERE id=1")) { row.next(); assertEquals(37, row.getInt(1)); }
            String insert = "INSERT INTO goal_entries(goal_id,type,content,created_at,updated_at) VALUES";
            assertThrows(SQLException.class, () -> sql.executeUpdate(insert + "(9999,'NOTE','Orphan',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"));
            assertThrows(SQLException.class, () -> sql.executeUpdate(insert + "(1001,'INVALID','Content',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"));
            assertThrows(SQLException.class, () -> sql.executeUpdate(insert + "(1001,'NOTE',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"));
            assertThrows(SQLException.class, () -> sql.executeUpdate(insert + "(1001,'NOTE','',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"));
            assertThrows(SQLException.class, () -> sql.executeUpdate(insert + "(1001,'NOTE','Content',NULL,CURRENT_TIMESTAMP)"));
            assertThrows(SQLException.class, () -> sql.executeUpdate(insert + "(1001,'NOTE','Content',CURRENT_TIMESTAMP,NULL)"));
            sql.executeUpdate(insert + "(1001,'NOTE','Content',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
            Flyway.configure().dataSource(dataSource).load().migrate();
            try (var row = sql.executeQuery("SELECT count(*) FROM goal_entries")) { row.next(); assertEquals(1, row.getInt(1)); }
            sql.executeUpdate("DELETE FROM goals WHERE id=1001");
            try (var row = sql.executeQuery("SELECT count(*) FROM goal_entries")) { row.next(); assertEquals(0, row.getInt(1)); }
        }
    }
}
