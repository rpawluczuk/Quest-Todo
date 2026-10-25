package pl.questtodo.task;

import java.sql.DriverManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class SubtaskMigrationTests {
    @Test
    void upgradesExistingTasksAndEnforcesIntegrityAndCascade() throws Exception {
        String url = "jdbc:h2:mem:subtask_migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").target("43").load().migrate();
        try (var connection = DriverManager.getConnection(url, "sa", ""); var sql = connection.createStatement()) {
            sql.executeUpdate("INSERT INTO tasks(id,user_id,title,points,completed) VALUES (8765,1,'Existing',5,false)");
            Flyway.configure().dataSource(url, "sa", "").target("44").load().migrate();
            sql.executeUpdate("INSERT INTO subtasks(task_id,title,position) VALUES (8765,'Child',0)");
            try (var rows = sql.executeQuery("SELECT completed FROM subtasks WHERE task_id = 8765")) {
                assertTrue(rows.next());
                assertFalse(rows.getBoolean(1));
            }
            for (String values : new String[]{"999999,'Child',0", "NULL,'Child',0", "8765,NULL,0", "8765,' ',0", "8765,'Child',-1"}) {
                assertThrows(java.sql.SQLException.class, () -> sql.executeUpdate(
                        "INSERT INTO subtasks(task_id,title,position) VALUES (" + values + ")"));
            }
            sql.executeUpdate("DELETE FROM tasks WHERE id = 8765");
            try (var rows = sql.executeQuery("SELECT count(*) FROM subtasks WHERE task_id = 8765")) {
                assertTrue(rows.next());
                assertEquals(0, rows.getInt(1));
            }
        }
    }
}
