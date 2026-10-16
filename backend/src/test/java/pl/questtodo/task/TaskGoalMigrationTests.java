package pl.questtodo.task;

import java.sql.DriverManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TaskGoalMigrationTests {
    @Test
    void movesExistingGoalLinkToTaskAndDetachesTaskWhenGoalIsDeleted() throws Exception {
        String url = "jdbc:h2:mem:task_goal_migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").target("36").load().migrate();

        try (var connection = DriverManager.getConnection(url, "sa", ""); var sql = connection.createStatement()) {
            sql.executeUpdate("INSERT INTO goals(id, user_id, title) VALUES (1001, 1, 'Existing goal')");
            sql.executeUpdate("INSERT INTO goal_tasks(goal_id, task_id) VALUES (1001, 1)");

            Flyway.configure().dataSource(url, "sa", "").target("37").load().migrate();

            try (var result = sql.executeQuery("SELECT goal_id FROM tasks WHERE id = 1")) {
                assertTrue(result.next());
                assertEquals(1001L, result.getLong("goal_id"));
            }
            try (var result = sql.executeQuery(
                    "SELECT count(*) FROM information_schema.tables WHERE table_name = 'GOAL_TASKS'")) {
                assertTrue(result.next());
                assertEquals(0, result.getInt(1));
            }

            sql.executeUpdate("DELETE FROM goals WHERE id = 1001");
            try (var result = sql.executeQuery("SELECT goal_id FROM tasks WHERE id = 1")) {
                assertTrue(result.next());
                assertNull(result.getObject("goal_id"));
            }
        }
    }
}
