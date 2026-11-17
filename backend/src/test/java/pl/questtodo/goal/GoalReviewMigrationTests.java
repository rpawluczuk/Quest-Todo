package pl.questtodo.goal;

import java.sql.DriverManager;
import java.sql.SQLException;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class GoalReviewMigrationTests {
    @Test void upgradesExistingGoalsWithoutChangingJournalOrMilestones() throws Exception {
        String url = "jdbc:h2:mem:goal_reviews_migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
        try (var connection = DriverManager.getConnection(url, "sa", ""); var sql = connection.createStatement()) {
            var source = new org.springframework.jdbc.datasource.SingleConnectionDataSource(connection, true);
            // Keep the CHECK-IN comparator session alive (H2 caches it during migration).
            Flyway.configure().dataSource(source).target("48").load().migrate();
            sql.executeUpdate("INSERT INTO goals(id,user_id,title) VALUES(1001,1,'Existing')");
            sql.executeUpdate("INSERT INTO milestones(goal_id,title,position) VALUES(1001,'Milestone',0)");
            sql.executeUpdate("INSERT INTO goal_entries(goal_id,type,content,created_at,updated_at) VALUES(1001,'NOTE','Existing entry',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
            Flyway.configure().dataSource(source).load().migrate();
            Flyway.configure().dataSource(source).load().validate();
            try (var row = sql.executeQuery("SELECT title,review_frequency,next_review_date FROM goals WHERE id=1001")) {
                assertTrue(row.next()); assertEquals("Existing", row.getString(1));
                assertNull(row.getString(2)); assertNull(row.getDate(3));
            }
            try (var row = sql.executeQuery("SELECT content FROM goal_entries WHERE goal_id=1001")) {
                assertTrue(row.next()); assertEquals("Existing entry", row.getString(1)); assertFalse(row.next());
            }
            try (var row = sql.executeQuery("SELECT title FROM milestones WHERE goal_id=1001")) {
                assertTrue(row.next()); assertEquals("Milestone", row.getString(1));
            }
            assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE goals SET review_frequency='INVALID' WHERE id=1001"));
            sql.executeUpdate("UPDATE goals SET review_frequency='MONTHLY',next_review_date=DATE '2026-12-17' WHERE id=1001");
        }
    }
}
